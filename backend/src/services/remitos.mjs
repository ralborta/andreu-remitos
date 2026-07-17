import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { leerRemito, calcularEstado } from "../../../lib/lectura.mjs";
import { normalizarFecha, normalizarHora, validarOrdenHorarios } from "../../../lib/horarios.mjs";
import { normalizarPeso } from "../../../lib/extract-cold.mjs";
import {
  destinoDesdeDatos,
  validarDestinoConMaestros,
  validarUnidadesConMaestros,
  mergeValidacionRemito,
} from "../../../lib/validacion-maestros.mjs";
import { canonicalizarConMaestros } from "../../../lib/maestros-match.mjs";
import { evaluarProcesable, remitoListoParaPlanilla } from "../../../lib/remito-procesable.mjs";
import { normalizarDatosRemito } from "../../../lib/normalizar-remito.mjs";
import { enriquecerCorinaDesdeOcr } from "../../../lib/corina-reglas.mjs";
import * as master from "../db/master-data-store.mjs";
import * as store from "../db/file-store.mjs";

function uploadDir() {
  const dir = process.env.UPLOAD_DIR || "./uploads";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function validacionCompleta(datos, tenant, opts = {}) {
  const [localidades, choferes, unidades] = await Promise.all([
    opts.localidades ?? master.listCollection("localidades", { tenant, activo: true }),
    opts.choferes ?? master.listCollection("choferes", { tenant, activo: true }),
    opts.unidades ?? master.listCollection("unidades", { tenant, activo: true }),
  ]);

  const datosCanon = canonicalizarConMaestros(datos, tenant, {
    localidades,
    choferes,
    unidades,
    telefono: opts.telefono,
    choferDesdeTelefono: opts.choferDesdeTelefono,
  });

  const destinoVal = validarDestinoConMaestros(datosCanon, tenant, localidades);
  const unidadesVal = validarUnidadesConMaestros(datosCanon, tenant, unidades);
  const validacionHorarios = datosCanon.horarios?.validacion ?? null;
  const validacion = mergeValidacionRemito(validacionHorarios, destinoVal, unidadesVal);
  return { validacion, datos: datosCanon };
}

function remitoConDatosLimpios(row) {
  if (!row?.datos) return row;
  const datos = normalizarDatosRemito({ ...row.datos }, row.tenant);
  const dirty = JSON.stringify(datos) !== JSON.stringify(row.datos);
  if (!dirty) return row;
  // Sin revalidar: solo para callers síncronos legacy. Preferir remitoConDatosLimpiosAsync.
  return { ...row, datos };
}

/**
 * Normaliza datos y recalcula validación cuando hace falta.
 * Caso clave Beraldi: destino ya corregido en `datos` pero `validacion` sigue
 * con error OCR viejo (Trom 23 / Lach.874) porque los datos no cambiaron al listar.
 */
async function remitoConDatosLimpiosAsync(row, { persistir = false, maestros } = {}) {
  if (!row?.datos) return row;
  let datosNorm = normalizarDatosRemito({ ...row.datos }, row.tenant);
  if (row.tenant === "corina" && row.texto_ocr) {
    datosNorm = enriquecerCorinaDesdeOcr(datosNorm, row.texto_ocr);
    datosNorm = normalizarDatosRemito(datosNorm, row.tenant);
  }
  const dirtyDatos = JSON.stringify(datosNorm) !== JSON.stringify(row.datos);
  const needsReval =
    dirtyDatos ||
    !row.validacion ||
    row.validacion.valido === false ||
    validacionDestinoStale(row, datosNorm);

  if (!needsReval) return row;

  const { validacion, datos } = await validacionCompleta(datosNorm, row.tenant, maestros ?? {});
  let estado = calcularEstado(datos, validacion, row.tenant);
  if (row.estado === "confirmado") {
    const candidato = { ...row, datos, validacion, estado };
    if (remitoListoParaPlanilla(candidato)) estado = "confirmado";
  }

  const dirtyVal = JSON.stringify(validacion) !== JSON.stringify(row.validacion);
  const dirtyEstado = estado !== row.estado;
  if (!dirtyDatos && !dirtyVal && !dirtyEstado) return row;

  if (persistir) {
    return store.updateRemito(row.id, { datos, validacion, estado });
  }
  return { ...row, datos, validacion, estado };
}

/** True si el error de destino cita un texto distinto al destino actual de `datos`. */
function validacionDestinoStale(row, datos) {
  const errores = row.validacion?.errores ?? [];
  const actual = String(destinoDesdeDatos(datos, row.tenant) ?? "").trim();
  if (!actual) return false;
  for (const e of errores) {
    const m = String(e).match(/Destino "([^"]+)"/);
    if (m && m[1].trim() !== actual) return true;
  }
  return false;
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

  let choferDesdeTelefono = false;
  if (telefono) {
    const chofer = await master.resolverChoferPorTelefono(telefono);
    if (chofer?.nombre) {
      choferDesdeTelefono = true;
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

  const { validacion, datos: datosCanon } = await validacionCompleta(resultado.lectura, resultado.tenant, {
    telefono,
    choferDesdeTelefono,
  });
  resultado.lectura = datosCanon;
  const estado = calcularEstado(datosCanon, validacion, resultado.tenant);

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

/** Vuelve a correr Document AI sobre la foto guardada (sin crear remito nuevo). */
export async function reprocesarRemito(id) {
  const row = await store.getRemito(id);
  if (!row) return null;
  if (!row.imagen_path || !fs.existsSync(row.imagen_path)) {
    throw new Error("No hay imagen guardada para reprocesar");
  }

  const buffer = fs.readFileSync(row.imagen_path);
  const filename = path.basename(row.imagen_path);

  const resultado = await leerRemito(buffer, {
    filename,
    telefono: row.telefono_chofer ?? undefined,
    tenantForzado: row.tenant,
  });

  const lectura = normalizarDatosRemito(resultado.lectura, resultado.tenant);

  let choferDesdeTelefono = false;
  if (row.telefono_chofer) {
    const chofer = await master.resolverChoferPorTelefono(row.telefono_chofer);
    if (chofer?.nombre) {
      choferDesdeTelefono = true;
      if (resultado.tenant === "tsb" || resultado.tenant === "corina") lectura.conductor = chofer.nombre;
      else lectura.chofer = chofer.nombre;
    }
  }

  const { validacion, datos: datosCanon } = await validacionCompleta(lectura, resultado.tenant, {
    telefono: row.telefono_chofer ?? undefined,
    choferDesdeTelefono,
  });
  let estado = calcularEstado(datosCanon, validacion, resultado.tenant);

  if (row.estado === "confirmado") {
    const candidato = { ...row, tenant: resultado.tenant, datos: datosCanon, validacion, estado };
    if (remitoListoParaPlanilla(candidato)) estado = "confirmado";
  }

  const updated = await store.updateRemito(id, {
    tenant: resultado.tenant,
    datos: datosCanon,
    validacion,
    estado,
    texto_ocr: resultado.ocr?.texto ?? row.texto_ocr,
  });

  return remitoConDatosLimpiosAsync(updated, { persistir: false });
}

export async function listarRemitos(opts) {
  const rows = await store.listRemitos(opts);
  if (!rows.length) return rows;

  // Precargar maestros por tenant para revalidar remitos dirty sin N×3 queries.
  const tenants = [...new Set(rows.map((r) => r.tenant).filter(Boolean))];
  const maestrosPorTenant = Object.fromEntries(
    await Promise.all(
      tenants.map(async (tenant) => {
        const [localidades, choferes, unidades] = await Promise.all([
          master.listCollection("localidades", { tenant, activo: true }),
          master.listCollection("choferes", { tenant, activo: true }),
          master.listCollection("unidades", { tenant, activo: true }),
        ]);
        return [tenant, { localidades, choferes, unidades }];
      }),
    ),
  );

  return Promise.all(
    rows.map((row) =>
      remitoConDatosLimpiosAsync(row, {
        persistir: true,
        maestros: maestrosPorTenant[row.tenant],
      }),
    ),
  );
}

export async function obtenerRemito(id) {
  const row = await store.getRemito(id);
  if (!row) return null;
  return remitoConDatosLimpiosAsync(row, { persistir: true });
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
    const horariosRaw = { ...(datos.horarios?.horarios ?? {}) };
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
  let estado = calcularEstado(datos, validacion, row.tenant);
  if (row.estado === "confirmado") {
    const candidato = { ...row, datos, validacion, estado };
    if (remitoListoParaPlanilla(candidato)) estado = "confirmado";
  }

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
    let row = await store.getRemito(id);
    if (!row) {
      errores.push({ id, motivos: ["Remito no encontrado"] });
      continue;
    }
    // Sanar destino/validación stale antes de evaluar (mismo fix que al listar).
    row = await remitoConDatosLimpiosAsync(row, { persistir: true });
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
  const estado = calcularEstado(datosCanon, validacion, nuevoTenant);

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
