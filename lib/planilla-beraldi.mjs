/**
 * Planilla Beraldi — Delfos + Proforma.
 * Diferencias vs TSB: NroDocumento = OT, Cantidad en Km, tramos ida/vuelta, headers con _.
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";
import {
  ESTADOS_PLANILLA,
  filasAoa,
  findLocalidad,
  findDistancia,
  findUnidadInterna,
  fechaDdMmYyyy,
  horaSlot,
  parseFechaRemito,
  remitoEnRango,
  remitoListoParaPlanilla,
  dedupeRemitosPlanilla,
  formatoDecimalEs,
  patentePlanilla,
  buildPlanillaFromRemitos,
  PLANILLA_DIARIA_COLUMNS,
  PLANILLA_PROFORMA_TORRE_COLUMNS,
} from "./planilla-common.mjs";

/** Headers Delfos Beraldi — importación QuadMy (guiones bajos, sin espacios). */
export const PLANILLA_DELFOS_BERALDI_COLUMNS = [
  { key: "nro_viaje", header: "NroViajePlanilla", width: 96 },
  { key: "orden", header: "Orden", width: 56 },
  { key: "fecha_inicio", header: "FechaInicio", width: 96 },
  { key: "tipo_viaje", header: "TipoViaje", width: 88 },
  { key: "producto", header: "Producto", width: 88 },
  { key: "nro_documento", header: "NroDocumento", width: 108 },
  { key: "coef_distrib", header: "CoeficienteDistribucion", width: 120 },
  { key: "suc_origen", header: "Suc_Origen", width: 88 },
  { key: "nro_cta_origen", header: "NroCta_Origen", width: 100 },
  { key: "dir_entrega_origen", header: "Dir_Entrega_Origen", width: 140 },
  { key: "razon_social_origen", header: "RazonSocial_Origen", width: 160 },
  { key: "id_camion", header: "ID Camión", width: 80 },
  { key: "nro_op", header: "Nº OP", width: 72 },
  { key: "nro_cta_destino", header: "NroCta_Destino", width: 108 },
  { key: "dir_entrega_destino", header: "Dir_Entrega_Destino", width: 140 },
  { key: "razon_social_destino", header: "RazonSocial_Destino", width: 160 },
  { key: "producto_pla", header: "Producto planilla", width: 100 },
  { key: "cantidad", header: "Cantidad", width: 80 },
  { key: "hora_inicio", header: "HoraInicio", width: 88 },
  { key: "fecha_fin", header: "FechaFin", width: 96 },
  { key: "hora_fin", header: "HoraFin", width: 88 },
  { key: "tractor_patente", header: "Tractor_Patente", width: 108 },
  { key: "semi_patente", header: "Semi_Patente", width: 100 },
  { key: "chofer", header: "Chofer", width: 120 },
  { key: "unidad_medida", header: "UnidadDeMedida", width: 100 },
];

export {
  PLANILLA_DELFOS_BERALDI_COLUMNS as PLANILLA_BERALDI_DELFOS_COLUMNS,
  PLANILLA_DELFOS_BERALDI_COLUMNS as PLANILLA_BERALDI_COLUMNS,
};
export { PLANILLA_PROFORMA_COLUMNS as PLANILLA_BERALDI_PROFORMA_COLUMNS } from "./planilla-common.mjs";
export { PLANILLA_DIARIA_COLUMNS, PLANILLA_PROFORMA_TORRE_COLUMNS } from "./planilla-common.mjs";

const TRANSPORTISTA = "Andreu";
const CLIENTE = "Veraldi";

function findChofer(choferes, telefono, nombreFallback) {
  const c = master.findChoferByPhone(choferes, telefono);
  if (c) return c.nombre;
  return nombreFallback ?? "";
}

/** Beraldi: "BENGOLEA, DAVID DANIEL" — apellido + nombres completos. */
function formatoChoferBeraldi(nombre) {
  if (!nombre) return "";
  const clean = String(nombre).replace(/\s+/g, " ").trim();
  if (clean.includes(",")) {
    const [ap, ...rest] = clean.split(",").map((s) => s.trim());
    return `${ap.toUpperCase()}, ${rest.join(" ").toUpperCase()}`.trim();
  }
  const parts = clean.split(" ");
  if (parts.length >= 2) {
    return `${parts[0].toUpperCase()}, ${parts.slice(1).join(" ").toUpperCase()}`;
  }
  return clean.toUpperCase();
}

/** Delfos Beraldi: NroDocumento = OT (no nro de remito). */
function nroOtBeraldi(d) {
  const raw = d.ot ?? "";
  return String(raw).replace(/\D/g, "") || "";
}

/** Planilla diaria / torre: RT.N = remito plano sin prefijo 00009. */
function nroRemitoBeraldi(d) {
  const raw = d.nro_remito ?? d.nro_guia ?? "";
  const n = normalizarNroRemitoGuia(raw, { tenant: "beraldi" }) ?? String(raw).trim();
  return String(n).replace(/\D/g, "") || String(raw).trim();
}

function datosComunes(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.origen ?? d.procedencia ?? "";
  const destinoNom = d.destino ?? d.destino_nombre ?? d.destino_locacion ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.chofer);

  const dist = findDistancia(ctx.distancias ?? [], locOrig, locDest);
  let km = dist?.km;
  if (km == null && d.km != null) km = d.km;
  if (km == null && d.distancia_km != null) km = d.distancia_km;

  return {
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    ot: nroOtBeraldi(d),
    doc: nroRemitoBeraldi(d),
    cantidad: formatoDecimalEs(km),
    unidad: "Km",
    locOrig,
    locDest,
    origenNom,
    destinoNom,
    chofer: formatoChoferBeraldi(choferNom),
    tractor: patentePlanilla(d.tractor ?? d.patente_chasis ?? d.chasis),
    semi: patentePlanilla(d.semi ?? d.patente_acoplado ?? d.acoplado),
  };
}

function baseFilaDelfos({ nroViaje, orden, remito, ctx, horaInicio, horaFin }) {
  const c = datosComunes(remito, ctx);
  const soloOrden1 = orden === 1;
  // Orden 1 = ida (origen→destino). Orden 2 = vuelta (destino→origen).
  const locDesde = soloOrden1 ? c.locOrig : c.locDest;
  const locHasta = soloOrden1 ? c.locDest : c.locOrig;
  const nomDesde = soloOrden1 ? c.origenNom : c.destinoNom;
  const nomHasta = soloOrden1 ? c.destinoNom : c.origenNom;

  return {
    remito_id: remito.id,
    nro_viaje: nroViaje,
    orden,
    fecha_inicio: c.fecha,
    tipo_viaje: ctx.tipoViaje,
    producto: ctx.producto,
    nro_documento: soloOrden1 ? c.ot : "",
    coef_distrib: "",
    suc_origen: locDesde?.codigo ?? "",
    nro_cta_origen: "000",
    dir_entrega_origen: "000",
    razon_social_origen: locDesde?.nombre ?? nomDesde,
    id_camion: "",
    nro_op: "",
    nro_cta_destino: locHasta?.codigo ?? "",
    dir_entrega_destino: "000",
    razon_social_destino: locHasta?.nombre ?? nomHasta,
    producto_pla: "",
    cantidad: soloOrden1 ? c.cantidad : "",
    hora_inicio: horaInicio,
    fecha_fin: c.fecha,
    hora_fin: horaFin,
    tractor_patente: c.tractor,
    semi_patente: c.semi,
    chofer: c.chofer,
    unidad_medida: c.unidad,
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

function columnasConKm(columns) {
  return columns.map((c) => (c.key === "tn" ? { ...c, header: "KM" } : c));
}

function datosTorre(remito, ctx) {
  const c = datosComunes(remito, ctx);
  return {
    fecha: c.fecha,
    origen: c.locOrig?.nombre ?? c.origenNom,
    destino: c.locDest?.nombre ?? c.destinoNom,
    patente_tractor: c.tractor,
    int_tractor: findUnidadInterna(ctx.unidades ?? [], c.tractor, "tractor"),
    semi: c.semi,
    chofer: c.chofer,
    tn: c.cantidad,
    rt_n: c.doc,
    observaciones: "",
  };
}

export function remitoAFilasPlanillaDiaria(remito, _nroViaje, ctx) {
  const c = datosTorre(remito, ctx);
  // Orden 1 = ida (origen→destino, km + RT.N). Orden 2 = vuelta (destino→origen, vacío).
  return [
    { remito_id: remito.id, ...c },
    {
      remito_id: remito.id,
      fecha: c.fecha,
      origen: c.destino,
      destino: c.origen,
      patente_tractor: c.patente_tractor,
      int_tractor: c.int_tractor,
      semi: c.semi,
      chofer: c.chofer,
      tn: "",
      rt_n: "",
      observaciones: "",
    },
  ];
}

/** @deprecated Alias — devuelve 2 filas (ida + vuelta). */
export function remitoAFilaPlanillaDiaria(remito, nroViaje, ctx) {
  return remitoAFilasPlanillaDiaria(remito, nroViaje, ctx);
}

export function remitoAFilasProformaTorre(remito, nroViaje, ctx) {
  const c = datosTorre(remito, ctx);
  return [
    {
      remito_id: remito.id,
      ...c,
      nro_viaje: String(nroViaje),
      rt_n_2: "",
    },
    {
      remito_id: remito.id,
      fecha: c.fecha,
      origen: c.destino,
      destino: c.origen,
      patente_tractor: c.patente_tractor,
      int_tractor: c.int_tractor,
      semi: c.semi,
      chofer: c.chofer,
      nro_viaje: "",
      tn: "",
      rt_n: "",
      observaciones: "",
      rt_n_2: "",
    },
  ];
}

function filaProforma(remito, ctx, { codigoParada, horaInicio }) {
  const c = datosComunes(remito, ctx);
  return {
    remito_id: remito.id,
    codigo_viaje: "",
    tipo_viaje: ctx.tipoViaje,
    inicio_programado: c.fecha,
    hora_inicio_programado: horaInicio,
    codigo_parada: codigoParada,
    nro_documento: c.doc,
    cliente: CLIENTE,
    transportista: TRANSPORTISTA,
    patente: c.tractor,
    chofer: c.chofer,
    semirremolque: c.semi,
  };
}

export function remitoAFilasProforma(remito, _nroViaje, ctx) {
  const hor = remito.datos?.horarios?.horarios ?? {};
  const c = datosComunes(remito, ctx);
  return [
    filaProforma(remito, ctx, {
      codigoParada: c.locOrig?.codigo ?? "1",
      horaInicio: horaSlot(hor.carga_entrada) || horaSlot(hor.carga_salida),
    }),
    filaProforma(remito, ctx, {
      codigoParada: c.locDest?.codigo ?? "2",
      horaInicio: horaSlot(hor.descarga_llegada) || horaSlot(hor.descarga_inicio) || horaSlot(hor.descarga_fin),
    }),
  ];
}

export function columnasParaFormatoBeraldi(formato) {
  if (formato === "proforma") return PLANILLA_PROFORMA_TORRE_COLUMNS;
  if (formato === "diaria") return PLANILLA_DIARIA_COLUMNS;
  return PLANILLA_DELFOS_BERALDI_COLUMNS;
}

export { columnasParaFormatoBeraldi as columnasParaFormato, filasAoa };

export async function buildPlanillaBeraldi(opts = {}) {
  const {
    formato = "delfos",
    tipoViaje = "ARENA",
    producto = "Sin Definir",
    estados = "confirmado,pendiente_revision",
    desde,
    hasta,
    limit = 5000,
  } = opts;

  const estadosSet = new Set(
    String(estados)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (estadosSet.size === 0) ESTADOS_PLANILLA.forEach((e) => estadosSet.add(e));

  const [remitos, choferes, localidades, distancias, unidades] = await Promise.all([
    remitoStore.listRemitos({ tenant: "beraldi", limit: Math.max(limit, 5000) }),
    master.listCollection("choferes", { tenant: "beraldi", activo: true }),
    master.listCollection("localidades", { tenant: "beraldi", activo: true }),
    master.listCollection("distancias", { tenant: "beraldi", activo: true }),
    master.listCollection("unidades", { tenant: "beraldi", activo: true }),
  ]);

  const ctx = { tipoViaje, producto, choferes, localidades, distancias, unidades };
  let filtrados = remitos.filter((r) => estadosSet.has(r.estado) && remitoListoParaPlanilla(r));
  filtrados = filtrados.filter((r) => remitoEnRango(r, { desde, hasta }));
  filtrados = dedupeRemitosPlanilla(filtrados);
  filtrados.sort((a, b) => {
    const fa = parseFechaRemito(a);
    const fb = parseFechaRemito(b);
    return fa.localeCompare(fb) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  filtrados = filtrados.slice(0, limit);

  if (formato === "proforma") {
    const diariaCols = columnasConKm(PLANILLA_DIARIA_COLUMNS);
    const proformaCols = columnasConKm(PLANILLA_PROFORMA_TORRE_COLUMNS);
    const filasDiaria = [];
    const filasProforma = [];
    let nroViaje = 1;
    for (const remito of filtrados) {
      filasDiaria.push(...remitoAFilasPlanillaDiaria(remito, nroViaje, ctx));
      filasProforma.push(...remitoAFilasProformaTorre(remito, nroViaje, ctx));
      nroViaje += 1;
    }
    return {
      tenant: "beraldi",
      formato,
      tipo_viaje: tipoViaje,
      columnas: proformaCols,
      filas: filasProforma,
      hojas: {
        diaria: { columnas: diariaCols, filas: filasDiaria },
        proforma: { columnas: proformaCols, filas: filasProforma },
      },
      meta: {
        remitos: filtrados.length,
        filas: filasProforma.length,
        filas_diaria: filasDiaria.length,
        desde: desde ?? null,
        hasta: hasta ?? null,
      },
    };
  }

  const mapRemito = (remito, nroViaje, fullCtx) => remitoAFilasDelfos(remito, nroViaje, fullCtx);

  const base = await buildPlanillaFromRemitos({
    tenant: "beraldi",
    remitos: filtrados,
    choferes,
    localidades,
    distancias,
    ctx,
    formato,
    mapRemito,
    columnas: formato === "delfos" ? PLANILLA_DELFOS_BERALDI_COLUMNS : undefined,
  });

  return {
    ...base,
    meta: {
      remitos: filtrados.length,
      filas: base.filas.length,
      desde: desde ?? null,
      hasta: hasta ?? null,
    },
  };
}
