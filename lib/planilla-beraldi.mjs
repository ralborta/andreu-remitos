/**
 * Planilla Beraldi — Delfos + Proforma.
 * Diferencias vs TSB: Nro Docume sin prefijo R., Cantidad en Km, chofer nombre completo.
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";
import {
  ESTADOS_PLANILLA,
  columnasParaFormato,
  filasAoa,
  findLocalidad,
  findDistancia,
  fechaDdMmYyyy,
  horaSlot,
  parseFechaRemito,
  remitoEnRango,
  formatoDecimalEs,
  patentePlanilla,
  buildPlanillaFromRemitos,
  PLANILLA_DELFOS_COLUMNS,
} from "./planilla-common.mjs";

export {
  PLANILLA_DELFOS_COLUMNS as PLANILLA_BERALDI_DELFOS_COLUMNS,
  PLANILLA_DELFOS_COLUMNS as PLANILLA_BERALDI_COLUMNS,
} from "./planilla-common.mjs";
export { PLANILLA_PROFORMA_COLUMNS as PLANILLA_BERALDI_PROFORMA_COLUMNS } from "./planilla-common.mjs";

const TRANSPORTISTA = "Andreu";
const CLIENTE = "Veraldi";

function findChofer(choferes, telefono, nombreFallback) {
  const tel = master.normalizePhone(telefono);
  if (tel) {
    const c = choferes.find((x) => master.normalizePhone(x.telefono) === tel);
    if (c) return c.nombre;
  }
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

/** Beraldi: número de remito plano (ej. 2355786), sin prefijo R. */
function nroDocumentoBeraldi(d) {
  const raw = d.nro_remito ?? d.nro_guia ?? "";
  const digits = String(raw).replace(/\D/g, "");
  return digits || String(raw).trim();
}

function datosComunes(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.origen ?? d.procedencia ?? "";
  const destinoNom = d.destino_locacion ?? d.destino_nombre ?? d.destino ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.chofer);

  const dist = findDistancia(ctx.distancias ?? [], locOrig, locDest);
  let km = dist?.km;
  if (km == null && d.km != null) km = d.km;
  if (km == null && d.distancia_km != null) km = d.distancia_km;

  return {
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    doc: nroDocumentoBeraldi(d),
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
    cantidad: soloOrden1 ? c.cantidad : "",
    hora_inicio: horaInicio,
    fecha_fin: c.fecha,
    hora_fin: horaFin,
    tractor_patente: c.tractor,
    semi_patente: c.semi,
    chofer: c.chofer,
    unidad_medida: soloOrden1 && c.cantidad ? c.unidad : "",
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

export { columnasParaFormato, filasAoa };

export async function buildPlanillaBeraldi(opts = {}) {
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

  const [remitos, choferes, localidades, distancias] = await Promise.all([
    remitoStore.listRemitos({ tenant: "beraldi", limit: 500 }),
    master.listCollection("choferes", { tenant: "beraldi", activo: true }),
    master.listCollection("localidades", { tenant: "beraldi", activo: true }),
    master.listCollection("distancias", { tenant: "beraldi", activo: true }),
  ]);

  const ctx = { tipoViaje, producto };
  let filtrados = remitos.filter((r) => estadosSet.has(r.estado));
  filtrados = filtrados.filter((r) => remitoEnRango(r, { desde, hasta }));
  filtrados.sort((a, b) => {
    const fa = parseFechaRemito(a);
    const fb = parseFechaRemito(b);
    return fa.localeCompare(fb) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  filtrados = filtrados.slice(0, limit);

  const mapRemito = (remito, nroViaje, fullCtx) =>
    formato === "proforma"
      ? remitoAFilasProforma(remito, nroViaje, fullCtx)
      : remitoAFilasDelfos(remito, nroViaje, fullCtx);

  const base = await buildPlanillaFromRemitos({
    tenant: "beraldi",
    remitos: filtrados,
    choferes,
    localidades,
    distancias,
    ctx,
    formato,
    mapRemito,
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
