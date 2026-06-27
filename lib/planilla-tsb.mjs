/**
 * Planilla TSB — formatos Delfos (Excel Arianna) y Proforma (QuadMy TMS).
 * 2 filas por remito: Orden 1 = carga, Orden 2 = descarga.
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";

/** Columnas A–Y exactas del Excel Delfos / export Arianna TSB. */
export const PLANILLA_TSB_DELFOS_COLUMNS = [
  { key: "nro_viaje", header: "Nro Viaje", width: 72 },
  { key: "orden", header: "Orden", width: 56 },
  { key: "fecha_inicio", header: "Fecha Inicio", width: 96 },
  { key: "tipo_viaje", header: "Tipo Viaje", width: 88 },
  { key: "producto", header: "Producto", width: 88 },
  { key: "nro_documento", header: "Nro Docume", width: 108 },
  { key: "coef_distrib", header: "Coef. Distrib.", width: 88 },
  { key: "suc_origen", header: "Suc. Origen", width: 80 },
  { key: "nro_cta_origen", header: "Nro Cta Orig", width: 100 },
  { key: "dir_entrega_origen", header: "Dir. Entrega", width: 100 },
  { key: "razon_social_origen", header: "Razón Social", width: 160 },
  { key: "id_camion", header: "ID Camión", width: 80 },
  { key: "nro_op", header: "Nro OP", width: 72 },
  { key: "nro_cta_destino", header: "Nro Cta Dest", width: 108 },
  { key: "dir_entrega_destino", header: "Dir. Entrega", width: 100 },
  { key: "razon_social_destino", header: "Razón Social", width: 160 },
  { key: "producto_pla", header: "Producto Pla", width: 88 },
  { key: "cantidad", header: "Cantidad", width: 80 },
  { key: "hora_inicio", header: "Hora Inicio", width: 88 },
  { key: "fecha_fin", header: "Fecha Fin", width: 96 },
  { key: "hora_fin", header: "Hora Fin", width: 88 },
  { key: "tractor_patente", header: "Tractor Paten", width: 108 },
  { key: "semi_patente", header: "Semi Patente", width: 100 },
  { key: "chofer", header: "Chofer", width: 120 },
  { key: "unidad_medida", header: "Unidad Medida", width: 100 },
];

/** Proforma Torre de Control → import QuadMy (reunión 23/jun). */
export const PLANILLA_TSB_PROFORMA_COLUMNS = [
  { key: "codigo_viaje", header: "Código Viaje", width: 96 },
  { key: "tipo_viaje", header: "Tipo Viaje", width: 88 },
  { key: "inicio_programado", header: "Inicio Programado", width: 120 },
  { key: "hora_inicio_programado", header: "Hora Inicio Programado", width: 140 },
  { key: "codigo_parada", header: "Código Parada", width: 108 },
  { key: "nro_documento", header: "Nro Documento", width: 108 },
  { key: "cliente", header: "Cliente", width: 88 },
  { key: "transportista", header: "Transportista", width: 120 },
  { key: "patente", header: "Patente", width: 100 },
  { key: "chofer", header: "Chofer", width: 120 },
  { key: "semirremolque", header: "Semirremolque", width: 108 },
];

/** @deprecated usar PLANILLA_TSB_DELFOS_COLUMNS */
export const PLANILLA_TSB_COLUMNS = PLANILLA_TSB_DELFOS_COLUMNS;

const TRANSPORTISTA_TSB = "Felipe Andreu";
const CLIENTE_TSB = "TSB";

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

function datosComunes(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.procedencia ?? d.origen ?? "";
  const destinoNom = d.destino ?? d.destino_nombre ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.conductor ?? d.chofer);
  const chasis = String(d.chasis ?? d.tractor ?? d.patente_chasis ?? "").toUpperCase();
  const semi = String(d.acoplado ?? d.semi ?? d.patente_acoplado ?? "").toUpperCase();
  const fecha = fechaDdMmYyyy(parseFechaRemito(remito));
  const doc = nroDocumento(d);
  const tons = toneladas(d.peso_kg ?? d.peso);

  return {
    d,
    fecha,
    doc,
    tons,
    locOrig,
    locDest,
    origenNom,
    destinoNom,
    chofer: formatoChoferPlanilla(choferNom),
    chasis,
    semi,
  };
}

function baseFilaDelfos({ nroViaje, orden, remito, ctx, horaInicio, horaFin }) {
  const c = datosComunes(remito, ctx);
  const soloOrden1 = orden === 1;

  return {
    remito_id: remito.id,
    nro_viaje: nroViaje,
    orden,
    fecha_inicio: c.fecha,
    tipo_viaje: ctx.tipoViaje,
    producto: ctx.producto,
    nro_documento: soloOrden1 ? c.doc : "",
    coef_distrib: "",
    suc_origen: "",
    nro_cta_origen: c.locOrig?.codigo ?? "",
    dir_entrega_origen: "000",
    razon_social_origen: c.locOrig?.nombre ?? c.origenNom,
    id_camion: "",
    nro_op: "",
    nro_cta_destino: c.locDest?.codigo ?? "",
    dir_entrega_destino: "000",
    razon_social_destino: c.locDest?.nombre ?? c.destinoNom,
    producto_pla: "",
    cantidad: soloOrden1 ? c.tons : "",
    hora_inicio: horaInicio,
    fecha_fin: c.fecha,
    hora_fin: horaFin,
    tractor_patente: c.chasis,
    semi_patente: c.semi,
    chofer: c.chofer,
    unidad_medida: soloOrden1 && c.tons ? "Tonelada" : "",
  };
}

export function remitoAFilasDelfos(remito, nroViaje, ctx) {
  const hor = remito.datos?.horarios?.horarios ?? {};

  return [
    baseFilaDelfos({
      nroViaje,
      orden: 1,
      remito,
      ctx,
      horaInicio: horaSlot(hor.carga_entrada),
      horaFin: horaSlot(hor.carga_salida),
    }),
    baseFilaDelfos({
      nroViaje,
      orden: 2,
      remito,
      ctx,
      horaInicio: horaSlot(hor.descarga_llegada) || horaSlot(hor.descarga_inicio),
      horaFin: horaSlot(hor.descarga_fin),
    }),
  ];
}

function filaProforma(remito, ctx, { orden, codigoParada, horaInicio }) {
  const c = datosComunes(remito, ctx);

  return {
    remito_id: remito.id,
    codigo_viaje: "",
    tipo_viaje: ctx.tipoViaje,
    inicio_programado: c.fecha,
    hora_inicio_programado: horaInicio,
    codigo_parada: codigoParada,
    nro_documento: c.doc,
    cliente: CLIENTE_TSB,
    transportista: TRANSPORTISTA_TSB,
    patente: c.chasis,
    chofer: c.chofer,
    semirremolque: c.semi,
  };
}

export function remitoAFilasProforma(remito, _nroViaje, ctx) {
  const hor = remito.datos?.horarios?.horarios ?? {};
  const c = datosComunes(remito, ctx);

  return [
    filaProforma(remito, ctx, {
      orden: 1,
      codigoParada: c.locOrig?.codigo ?? "1",
      horaInicio: horaSlot(hor.carga_entrada) || horaSlot(hor.carga_salida),
    }),
    filaProforma(remito, ctx, {
      orden: 2,
      codigoParada: c.locDest?.codigo ?? "2",
      horaInicio: horaSlot(hor.descarga_llegada) || horaSlot(hor.descarga_inicio) || horaSlot(hor.descarga_fin),
    }),
  ];
}

/** @deprecated */
export function remitoAFilasPlanilla(remito, nroViaje, ctx) {
  return remitoAFilasDelfos(remito, nroViaje, ctx);
}

const ESTADOS_PLANILLA = new Set(["confirmado", "pendiente_revision"]);

export function columnasParaFormato(formato) {
  return formato === "proforma" ? PLANILLA_TSB_PROFORMA_COLUMNS : PLANILLA_TSB_DELFOS_COLUMNS;
}

export async function buildPlanillaTsb(opts = {}) {
  const {
    formato = "delfos",
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
  const esProforma = formato === "proforma";
  const columnas = columnasParaFormato(formato);

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
    const filasRemito = esProforma
      ? remitoAFilasProforma(remito, nroViaje, ctx)
      : remitoAFilasDelfos(remito, nroViaje, ctx);
    filas.push(...filasRemito);
    nroViaje += 1;
  }

  return {
    tenant: "tsb",
    formato,
    tipo_viaje: tipoViaje,
    columnas,
    filas,
    meta: {
      remitos: filtrados.length,
      filas: filas.length,
      desde: desde ?? null,
      hasta: hasta ?? null,
    },
  };
}

export function filasAoa(filas, columnas = PLANILLA_TSB_DELFOS_COLUMNS) {
  const headers = columnas.map((c) => c.header);
  const keys = columnas.map((c) => c.key);
  return [headers, ...filas.map((f) => keys.map((k) => f[k] ?? ""))];
}
