/**
 * Planilla TSB — columnas alineadas al Excel Delfos / export Arianna.
 * Genera 2 filas por remito (Orden 1 = carga, Orden 2 = descarga).
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";

export const PLANILLA_TSB_COLUMNS = [
  { key: "nro_viaje", header: "Nro Viaje", width: 72 },
  { key: "orden", header: "Orden", width: 56 },
  { key: "fecha_inicio", header: "Fecha Inicio", width: 96 },
  { key: "tipo_viaje", header: "Tipo Viaje", width: 88 },
  { key: "producto", header: "Producto", width: 88 },
  { key: "nro_documento", header: "Nro Documento", width: 108 },
  { key: "coef_distrib", header: "Coef. Distrib.", width: 88 },
  { key: "suc_origen", header: "Suc. Origen", width: 80 },
  { key: "nro_cta_origen", header: "Nro Cta Origen", width: 100 },
  { key: "dir_entrega_origen", header: "Dir. Entrega Origen", width: 120 },
  { key: "razon_social_origen", header: "Razón Social Origen", width: 160 },
  { key: "id_camion", header: "ID Camión", width: 80 },
  { key: "nro_op", header: "Nro OP", width: 72 },
  { key: "nro_cta_destino", header: "Nro Cta Destino", width: 108 },
  { key: "dir_entrega_destino", header: "Dir. Entrega Destino", width: 120 },
  { key: "razon_social_destino", header: "Razón Social Destino", width: 160 },
  { key: "producto_pla", header: "Producto Pla", width: 88 },
  { key: "cantidad", header: "Cantidad", width: 80 },
  { key: "hora_inicio", header: "Hora Inicio", width: 88 },
  { key: "fecha_fin", header: "Fecha Fin", width: 96 },
  { key: "hora_fin", header: "Hora Fin", width: 88 },
  { key: "tractor_patente", header: "Tractor Patente", width: 108 },
  { key: "semi_patente", header: "Semi Patente", width: 100 },
  { key: "chofer", header: "Chofer", width: 120 },
  { key: "unidad_medida", header: "Unidad Medida", width: 100 },
];

function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findLocalidad(localidades, nombre) {
  if (!nombre) return null;
  const n = norm(nombre);
  return (
    localidades.find((l) => norm(l.codigo) === n) ??
    localidades.find((l) => norm(l.nombre) === n) ??
    localidades.find((l) => n.includes(norm(l.nombre)) || norm(l.nombre).includes(n)) ??
    null
  );
}

function findChofer(choferes, telefono, nombreFallback) {
  const tel = master.normalizePhone(telefono);
  if (tel) {
    const c = choferes.find((x) => master.normalizePhone(x.telefono) === tel);
    if (c) return c.nombre;
  }
  return nombreFallback ?? "";
}

function formatoChoferPlanilla(nombre) {
  if (!nombre) return "";
  const clean = String(nombre).replace(/\s+/g, " ").trim();
  if (clean.includes(",")) {
    const [ap, nom] = clean.split(",").map((s) => s.trim());
    const ini = nom?.[0]?.toUpperCase() ?? "";
    return `${ap.toUpperCase()}, ${ini}`.trim();
  }
  const parts = clean.split(" ");
  if (parts.length >= 2) {
    const apellido = parts[0].toUpperCase();
    const ini = parts[parts.length - 1][0]?.toUpperCase() ?? "";
    return `${apellido}, ${ini}`;
  }
  return clean.toUpperCase();
}

function nroDocumento(d) {
  const raw = d.nro_guia ?? d.nro_remito ?? "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return `R.${digits.padStart(7, "0")}`;
}

function fechaDdMmYyyy(fecha) {
  if (!fecha) return "";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(fecha))) return String(fecha);
  return String(fecha);
}

function horaSlot(slot) {
  return slot?.hora ?? "";
}

function toneladas(pesoKg) {
  const n = Number(pesoKg);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n / 1000).toFixed(2).replace(".", ",");
}

function parseFechaRemito(remito) {
  const d = remito.datos ?? {};
  return d.fecha_guia ?? d.fecha ?? d.fecha_remito ?? remito.created_at?.slice(0, 10) ?? "";
}

function remitoEnRango(remito, { desde, hasta }) {
  const f = parseFechaRemito(remito);
  if (!f) return true;
  const iso = f.match(/^\d{4}-\d{2}-\d{2}/) ? f.slice(0, 10) : null;
  if (!iso) return true;
  if (desde && iso < desde) return false;
  if (hasta && iso > hasta) return false;
  return true;
}

function baseFila({ nroViaje, orden, remito, ctx, horaInicio, horaFin }) {
  const d = remito.datos ?? {};
  const hor = d.horarios?.horarios ?? {};
  const fecha = fechaDdMmYyyy(parseFechaRemito(remito));
  const origenNom = d.procedencia ?? d.origen ?? "";
  const destinoNom = d.destino ?? d.destino_nombre ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.conductor ?? d.chofer);
  const chasis = d.chasis ?? d.tractor ?? d.patente_chasis ?? "";
  const semi = d.acoplado ?? d.semi ?? d.patente_acoplado ?? "";
  const tons = toneladas(d.peso_kg ?? d.peso);

  return {
    remito_id: remito.id,
    nro_viaje: nroViaje,
    orden,
    fecha_inicio: fecha,
    tipo_viaje: ctx.tipoViaje,
    producto: ctx.producto,
    nro_documento: nroDocumento(d),
    coef_distrib: "",
    suc_origen: "",
    nro_cta_origen: locOrig?.codigo ?? "",
    dir_entrega_origen: "000",
    razon_social_origen: locOrig?.nombre ?? origenNom,
    id_camion: "",
    nro_op: "",
    nro_cta_destino: locDest?.codigo ?? "",
    dir_entrega_destino: "000",
    razon_social_destino: locDest?.nombre ?? destinoNom,
    producto_pla: tons,
    cantidad: "",
    hora_inicio: horaInicio,
    fecha_fin: fecha,
    hora_fin: horaFin,
    tractor_patente: String(chasis).toUpperCase(),
    semi_patente: String(semi).toUpperCase(),
    chofer: formatoChoferPlanilla(choferNom),
    unidad_medida: tons ? "Tonelada" : "",
  };
}

export function remitoAFilasPlanilla(remito, nroViaje, ctx) {
  const hor = remito.datos?.horarios?.horarios ?? {};

  const fila1 = baseFila({
    nroViaje,
    orden: 1,
    remito,
    ctx,
    horaInicio: horaSlot(hor.carga_entrada),
    horaFin: horaSlot(hor.carga_salida),
  });

  const fila2 = baseFila({
    nroViaje,
    orden: 2,
    remito,
    ctx,
    horaInicio: horaSlot(hor.descarga_llegada) || horaSlot(hor.descarga_inicio),
    horaFin: horaSlot(hor.descarga_fin),
  });

  return [fila1, fila2];
}

const ESTADOS_PLANILLA = new Set(["confirmado", "pendiente_revision"]);

export async function buildPlanillaTsb(opts = {}) {
  const {
    tipoViaje = "ARENA",
    producto = "Sin Definir",
    estados = "confirmado,pendiente_revision",
    desde,
    hasta,
    limit = 200,
  } = opts;

  const estadosSet = new Set(
    String(estados)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (estadosSet.size === 0) ESTADOS_PLANILLA.forEach((e) => estadosSet.add(e));

  const [remitos, choferes, localidades] = await Promise.all([
    remitoStore.listRemitos({ tenant: "tsb", limit: 500 }),
    master.listCollection("choferes", { tenant: "tsb", activo: true }),
    master.listCollection("localidades", { tenant: "tsb", activo: true }),
  ]);

  const ctx = { tipoViaje, producto, choferes, localidades };

  let filtrados = remitos.filter((r) => estadosSet.has(r.estado));
  filtrados = filtrados.filter((r) => remitoEnRango(r, { desde, hasta }));
  filtrados.sort((a, b) => {
    const fa = parseFechaRemito(a);
    const fb = parseFechaRemito(b);
    return fa.localeCompare(fb) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  filtrados = filtrados.slice(0, limit);

  const filas = [];
  let nroViaje = 1;
  for (const remito of filtrados) {
    filas.push(...remitoAFilasPlanilla(remito, nroViaje, ctx));
    nroViaje += 1;
  }

  return {
    tenant: "tsb",
    formato: "delfos",
    tipo_viaje: tipoViaje,
    columnas: PLANILLA_TSB_COLUMNS,
    filas,
    meta: {
      remitos: filtrados.length,
      filas: filas.length,
      desde: desde ?? null,
      hasta: hasta ?? null,
    },
  };
}

export function filasAoa(filas) {
  const headers = PLANILLA_TSB_COLUMNS.map((c) => c.header);
  const keys = PLANILLA_TSB_COLUMNS.map((c) => c.key);
  return [headers, ...filas.map((f) => keys.map((k) => f[k] ?? ""))];
}
