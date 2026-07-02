/**
 * Planilla TSB — Delfos + Proforma QuadMy.
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";
import {
  ESTADOS_PLANILLA,
  columnasParaFormato,
  filasAoa,
  findLocalidad,
  fechaDdMmYyyy,
  horaSlot,
  parseFechaRemito,
  remitoEnRango,
  remitoListoParaPlanilla,
  formatoDecimalEs,
  patentePlanilla,
  buildPlanillaFromRemitos,
} from "./planilla-common.mjs";

export {
  PLANILLA_DELFOS_COLUMNS as PLANILLA_TSB_DELFOS_COLUMNS,
  PLANILLA_DELFOS_COLUMNS as PLANILLA_TSB_COLUMNS,
  PLANILLA_PROFORMA_COLUMNS as PLANILLA_TSB_PROFORMA_COLUMNS,
} from "./planilla-common.mjs";

const TRANSPORTISTA = "Felipe Andreu";
const CLIENTE = "TSB";

function findChofer(choferes, telefono, nombreFallback) {
  const c = master.findChoferByPhone(choferes, telefono);
  if (c) return c.nombre;
  return nombreFallback ?? "";
}

function formatoChoferTsb(nombre) {
  if (!nombre) return "";
  const clean = String(nombre).replace(/\s+/g, " ").trim();
  if (clean.includes(",")) {
    const [ap, nom] = clean.split(",").map((s) => s.trim());
    const ini = nom?.[0]?.toUpperCase() ?? "";
    return `${ap.toUpperCase()}, ${ini}`.trim();
  }
  const parts = clean.split(" ");
  if (parts.length >= 2) {
    return `${parts[0].toUpperCase()}, ${parts[parts.length - 1][0]?.toUpperCase() ?? ""}`;
  }
  return clean.toUpperCase();
}

function nroDocumentoTsb(d) {
  const raw = d.nro_guia ?? d.nro_remito ?? "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return `R.${digits.padStart(7, "0")}`;
}

function toneladas(pesoKg) {
  const n = Number(pesoKg);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatoDecimalEs(n / 1000);
}

function datosComunes(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.procedencia ?? d.origen ?? "";
  const destinoNom = d.destino ?? d.destino_nombre ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.conductor ?? d.chofer);

  return {
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    doc: nroDocumentoTsb(d),
    cantidad: toneladas(d.peso_kg ?? d.peso),
    unidad: "Tonelada",
    locOrig,
    locDest,
    origenNom,
    destinoNom,
    chofer: formatoChoferTsb(choferNom),
    tractor: patentePlanilla(d.chasis ?? d.tractor ?? d.patente_chasis),
    semi: patentePlanilla(d.acoplado ?? d.semi ?? d.patente_acoplado),
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

export function remitoAFilasPlanilla(remito, nroViaje, ctx) {
  return remitoAFilasDelfos(remito, nroViaje, ctx);
}

export { columnasParaFormato, filasAoa };

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

  const ctx = { tipoViaje, producto };
  let filtrados = remitos.filter((r) => estadosSet.has(r.estado) && remitoListoParaPlanilla(r));
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
    tenant: "tsb",
    remitos: filtrados,
    choferes,
    localidades,
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
