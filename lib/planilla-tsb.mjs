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
  findUnidadInterna,
  fechaDdMmYyyy,
  horaSlot,
  parseFechaRemito,
  remitoEnRango,
  remitoListoParaPlanilla,
  formatoDecimalEs,
  patentePlanilla,
  buildPlanillaFromRemitos,
  PLANILLA_DIARIA_COLUMNS,
  PLANILLA_PROFORMA_TORRE_COLUMNS,
} from "./planilla-common.mjs";

export {
  PLANILLA_DELFOS_COLUMNS as PLANILLA_TSB_DELFOS_COLUMNS,
  PLANILLA_DELFOS_COLUMNS as PLANILLA_TSB_COLUMNS,
  PLANILLA_PROFORMA_COLUMNS as PLANILLA_TSB_PROFORMA_COLUMNS,
  PLANILLA_DIARIA_COLUMNS,
  PLANILLA_PROFORMA_TORRE_COLUMNS,
} from "./planilla-common.mjs";

const TRANSPORTISTA = "Felipe Andreu";
const CLIENTE = "TSB";

function normalizeChoferKey(nombre) {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function findChoferByNombre(choferes, nombre) {
  const key = normalizeChoferKey(nombre);
  if (!key || key.length < 3) return null;
  const exact = choferes.find((c) => normalizeChoferKey(c.nombre) === key);
  if (exact) return exact;
  const tokens = key.split(" ").filter(Boolean);
  if (tokens.length < 1) return null;
  return (
    choferes.find((c) => {
      const ck = normalizeChoferKey(c.nombre);
      return tokens.every((t) => ck.includes(t));
    }) ?? null
  );
}

function findChofer(choferes, telefono, nombreFallback) {
  const byPhone = master.findChoferByPhone(choferes, telefono);
  if (byPhone) return byPhone.nombre;
  const byName = findChoferByNombre(choferes, nombreFallback);
  if (byName) return byName.nombre;
  return nombreFallback ?? "";
}

/** TSB: nombre completo desde parámetros (ej. "ARABENA, SERGIO"), no solo inicial. */
function formatoChoferTsb(nombre) {
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
  // Orden 1 = ida (origen→destino). Orden 2 = vuelta (destino→origen), con códigos de parámetros.
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
    nro_documento: soloOrden1 ? c.doc : "",
    coef_distrib: "",
    suc_origen: "",
    nro_cta_origen: locDesde?.codigo ?? "",
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
    // Importación Delfos: "Tonelada" en toda la columna (cada fila del viaje).
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

function toneladasTn(pesoKg) {
  const n = Number(pesoKg);
  if (!Number.isFinite(n) || n <= 0) return "";
  const tn = n / 1000;
  if (Math.abs(tn - Math.round(tn)) < 0.05) return String(Math.round(tn));
  return formatoDecimalEs(tn);
}

function datosTorre(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.procedencia ?? d.origen ?? "";
  const destinoNom = d.destino ?? d.destino_nombre ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);
  const choferNom = findChofer(ctx.choferes, remito.telefono_chofer, d.conductor ?? d.chofer);
  const tractorPat = patentePlanilla(d.chasis ?? d.tractor ?? d.patente_chasis);
  const semiPat = patentePlanilla(d.acoplado ?? d.semi ?? d.patente_acoplado);

  return {
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    origen: locOrig?.nombre ?? origenNom,
    destino: locDest?.nombre ?? destinoNom,
    patente_tractor: tractorPat,
    int_tractor: findUnidadInterna(ctx.unidades ?? [], tractorPat, "tractor"),
    semi: semiPat,
    chofer: formatoChoferTsb(choferNom),
    tn: toneladasTn(d.peso_kg ?? d.peso),
    rt_n: nroDocumentoTsb(d),
    observaciones: "",
  };
}

export function remitoAFilaPlanillaDiaria(remito, _nroViaje, ctx) {
  const c = datosTorre(remito, ctx);
  return [{ remito_id: remito.id, ...c }];
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
    limit = 5000,
  } = opts;

  const estadosSet = new Set(
    String(estados)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (estadosSet.size === 0) ESTADOS_PLANILLA.forEach((e) => estadosSet.add(e));

  const [remitos, choferes, localidades, unidades] = await Promise.all([
    remitoStore.listRemitos({ tenant: "tsb", limit: Math.max(limit, 5000) }),
    master.listCollection("choferes", { tenant: "tsb", activo: true }),
    master.listCollection("localidades", { tenant: "tsb", activo: true }),
    master.listCollection("unidades", { tenant: "tsb", activo: true }),
  ]);

  const ctx = { tipoViaje, producto, choferes, localidades, unidades };
  let filtrados = remitos.filter((r) => estadosSet.has(r.estado) && remitoListoParaPlanilla(r));
  filtrados = filtrados.filter((r) => remitoEnRango(r, { desde, hasta }));
  filtrados.sort((a, b) => {
    const fa = parseFechaRemito(a);
    const fb = parseFechaRemito(b);
    return fa.localeCompare(fb) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  filtrados = filtrados.slice(0, limit);

  if (formato === "proforma") {
    const filasDiaria = [];
    const filasProforma = [];
    let nroViaje = 1;
    for (const remito of filtrados) {
      filasDiaria.push(...remitoAFilaPlanillaDiaria(remito, nroViaje, ctx));
      filasProforma.push(...remitoAFilasProformaTorre(remito, nroViaje, ctx));
      nroViaje += 1;
    }
    return {
      tenant: "tsb",
      formato,
      tipo_viaje: tipoViaje,
      columnas: PLANILLA_PROFORMA_TORRE_COLUMNS,
      filas: filasProforma,
      hojas: {
        diaria: { columnas: PLANILLA_DIARIA_COLUMNS, filas: filasDiaria },
        proforma: { columnas: PLANILLA_PROFORMA_TORRE_COLUMNS, filas: filasProforma },
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
