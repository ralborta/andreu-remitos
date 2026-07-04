import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { leerRemito, calcularEstado } from "../../../lib/lectura.mjs";
import { normalizarFecha, normalizarHora, validarOrdenHorarios } from "../../../lib/horarios.mjs";
import { normalizarPeso } from "../../../lib/extract-cold.mjs";
import { validarDestinoConMaestros, mergeValidacionRemito, canonicalizarLocalidadesEnDatos } from "../../../lib/validacion-maestros.mjs";
import { evaluarProcesable } from "../../../lib/remito-procesable.mjs";
import { normalizarDatosRemito } from "../../../lib/normalizar-remito.mjs";
import * as master from "../db/master-data-store.mjs";
import * as store from "../db/file-store.mjs";

function uploadDir() {
  const dir = process.env.UPLOAD_DIR || "./uploads";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function validacionCompleta(datos, tenant, localidadesPrecargadas) {
  const localidades =
    localidadesPrecargadas ?? (await master.listCollection("localidades", { tenant, activo: true }));
  const datosCanon = canonicalizarLocalidadesEnDatos(datos, tenant, localidades);
  const destinoVal = validarDestinoConMaestros(datosCanon, tenant, localidades);
  const validacionHorarios = datosCanon.horarios?.validacion ?? null;
  const validacion = mergeValidacionRemito(validacionHorarios, destinoVal);
  return { validacion, datos: datosCanon };
}

export async function ingestarRemito(buffer, { filename, telefono, tenantForzado, tenantSugerido }) {
  const tenantPorChofer = telefono ? await master.resolverTenantPorTelefono(telefono) : null;
  const sugerido = tenantSugerido ?? tenantPorChofer ?? undefined;

  const resultado = await leerRemito(buffer, {
    filename,
    telefono,
    tenantForzado: tenantForzado || undefined,
    tenantSugerido: tenantForzado ? undefined : sugerido,
  });

  if (telefono) {
    const chofer = await master.resolverChoferPorTelefono(telefono);
    if (chofer?.nombre) {
      if (resultado.tenant === "tsb") resultado.lectura.conductor = chofer.nombre;
      else if (resultado.tenant === "corina") resultado.lectura.conductor = chofer.nombre;
      else resultado.lectura.chofer = chofer.nombre;
    }
  }

  resultado.lectura = normalizarDatosRemito(resultado.lectura, resultado.tenant);

  const id = randomUUID();
  const ext = path.extname(filename || ".jpg") || ".jpg";
  const imagenPath = path.join(uploadDir(), `${id}${ext}`);
  fs.writeFileSync(imagenPath, buffer);

  const { validacion, datos: datosCanon } = await validacionCompleta(resultado.lectura, resultado.tenant);
  resultado.lectura = datosCanon;
  const estado = calcularEstado(datosCanon, validacion);

  const row = {
    id,
    tenant: resultado.tenant,
    estado,
    telefono_chofer: telefono ?? null,
    imagen_path: imagenPath,
    texto_ocr: resultado.ocr.texto,
    datos: datosCanon,
    validacion,
  };

  await store.insertRemito(row);

  return { id, ...resultado, validacion, estado };
}

export async function listarRemitos(opts) {
  return store.listRemitos(opts);
}

export async function obtenerRemito(id) {
  return store.getRemito(id);
}

export async function ultimoRemitoPorTelefono(telefono, opts) {
  return store.ultimoRemitoPorTelefono(telefono, opts);
}

export async function actualizarCampos(id, datosParciales) {
  const row = await store.getRemito(id);
  if (!row) return null;

  const { horarios: horariosIncoming, ...resto } = datosParciales;
  let datos = { ...row.datos, ...resto, _editado_manual: true };
  datos = normalizarDatosRemito(datos, row.tenant);

  if ("peso_kg" in resto && resto.peso_kg != null && resto.peso_kg !== "") {
    const normalizado =
      typeof resto.peso_kg === "number" ? resto.peso_kg : normalizarPeso(String(resto.peso_kg));
    if (normalizado != null) datos.peso_kg = normalizado;
  }
  if ("peso" in resto && resto.peso != null && resto.peso !== "" && !("peso_kg" in resto)) {
    const normalizado =
      typeof resto.peso === "number" ? resto.peso : normalizarPeso(String(resto.peso));
    if (normalizado != null) datos.peso_kg = normalizado;
  }

  if (horariosIncoming?.horarios) {
    const fechaBase =
      normalizarFecha(horariosIncoming.fecha_remito) ??
      normalizarFecha(datos.fecha_guia) ??
      normalizarFecha(datos.fecha_remito) ??
      datos.horarios?.fecha_remito ??
      null;

    /** @type {Record<string, { fecha?: string|null, hora?: string|null }>} */
    const horariosRaw = {};
    for (const [campo, slot] of Object.entries(horariosIncoming.horarios)) {
      horariosRaw[campo] = {
        fecha: normalizarFecha(slot?.fecha) ?? fechaBase,
        hora: normalizarHora(slot?.hora),
      };
    }

    const validacion = validarOrdenHorarios(horariosRaw);
    datos.horarios = {
      ...(datos.horarios ?? {}),
      tenant: datos.tenant ?? row.tenant,
      fecha_remito: fechaBase,
      horarios: horariosRaw,
      validacion,
    };
  }

  const { validacion, datos: datosCanon } = await validacionCompleta(datos, row.tenant);
  datos = datosCanon;
  const estado = calcularEstado(datos, validacion);

  return store.updateRemito(id, {
    datos,
    validacion,
    estado,
  });
}

function numeroRemitoRow(row) {
  const d = row.datos ?? {};
  return d.nro_guia || d.nro_remito || row.id.slice(0, 8);
}

export async function procesarRemitosBatch(ids, tenant) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { procesados: [], errores: [{ id: "", motivos: ["Lista de IDs vacía"] }] };
  }

  const procesados = [];
  const errores = [];

  for (const id of ids) {
    const row = await store.getRemito(id);
    if (!row) {
      errores.push({ id, motivos: ["Remito no encontrado"] });
      continue;
    }
    if (tenant && row.tenant !== tenant) {
      errores.push({ id, nro: numeroRemitoRow(row), motivos: ["Pertenece a otro cliente"] });
      continue;
    }

    const evaluacion = evaluarProcesable(row);
    if (!evaluacion.ok) {
      errores.push({ id, nro: numeroRemitoRow(row), motivos: evaluacion.motivos });
      continue;
    }

    const updated = await store.updateRemito(id, {
      estado: "confirmado",
      procesado_at: new Date().toISOString(),
    });
    procesados.push({
      id,
      nro: numeroRemitoRow(updated),
      tenant: updated.tenant,
      estado: updated.estado,
    });
  }

  return { procesados, errores, total: ids.length };
}

const TENANTS_VALIDOS = new Set(["tsb", "beraldi", "corina"]);

export async function cambiarTenantRemito(id, nuevoTenant) {
  if (!TENANTS_VALIDOS.has(nuevoTenant)) {
    throw new Error("Tenant inválido");
  }

  const row = await store.getRemito(id);
  if (!row) return null;
  if (row.tenant === nuevoTenant) return row;

  const datos = {
    ...row.datos,
    tenant: nuevoTenant,
    resumen: { ...(row.datos?.resumen ?? {}) },
  };
  delete datos.resumen.advertencia_tenant;

  const { validacion, datos: datosCanon } = await validacionCompleta(datos, nuevoTenant);
  const estado = calcularEstado(datosCanon, validacion);

  return store.updateRemito(id, {
    tenant: nuevoTenant,
    datos: datosCanon,
    validacion,
    estado,
  });
}

export async function eliminarRemito(id) {
  const row = await store.getRemito(id);
  if (!row) return null;

  if (row.imagen_path && fs.existsSync(row.imagen_path)) {
    try {
      fs.unlinkSync(row.imagen_path);
    } catch {
      /* ignore — el registro se borra igual */
    }
  }

  await store.deleteRemito(id);
  return { id, eliminado: true };
}
