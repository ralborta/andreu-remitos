/**
 * Planillas Corina — viajes cortos / Local.
 *
 * Dos vistas como el CRM viejo (Empliados):
 *  - local       → Planilla Local (operativa mesa de control)
 *  - importacion → Planilla Importación Local (Delfos 25 cols A–Y)
 */

import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as master from "../backend/src/db/master-data-store.mjs";
import {
  ESTADOS_PLANILLA,
  PLANILLA_DELFOS_COLUMNS,
  columnasParaFormato,
  filasAoa,
  findLocalidad,
  fechaDdMmYyyy,
  formatoDecimalEs,
  horaSlot,
  parseFechaRemito,
  patentePlanilla,
  remitoEnRango,
  remitoListoParaPlanilla,
  buildPlanillaFromRemitos,
} from "./planilla-common.mjs";

export { PLANILLA_DELFOS_COLUMNS as PLANILLA_CORINA_DELFOS_COLUMNS } from "./planilla-common.mjs";

/** Planilla Local — vista operativa (como CRM Corina - Local). */
export const PLANILLA_LOCAL_COLUMNS = [
  { key: "fecha", header: "Fecha", width: 96 },
  { key: "origen", header: "Origen", width: 180 },
  { key: "destino", header: "Destino", width: 180 },
  { key: "tractor", header: "Tractor", width: 96 },
  { key: "semi", header: "Semi", width: 96 },
  { key: "chofer", header: "Chofer", width: 140 },
  { key: "tramos", header: "Tramos", width: 100 },
  { key: "hora_inicio", header: "Hora Inicio", width: 96 },
  { key: "hora_fin", header: "Hora Fin", width: 96 },
  { key: "bultos", header: "Bultos", width: 80 },
  { key: "remito", header: "Remito", width: 120 },
];

const TIPO_VIAJE = "Nacional";
const PRODUCTO = "Corta Distancia";
const UNIDAD = "Pallet";

function findChofer(choferes, telefono, nombreFallback) {
  const c = master.findChoferByPhone(choferes, telefono);
  if (c) return c.nombre;
  return nombreFallback ?? "";
}

function nroRemitoDisplay(d) {
  const raw = d.nro_remito ?? d.nro_guia ?? "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 10 ? digits : `R. ${digits}`;
}

function datosCorina(remito, ctx) {
  const d = remito.datos ?? {};
  const origenNom = d.origen ?? d.procedencia ?? d.direccion_origen ?? "";
  const destinoNom = d.destino ?? d.cliente ?? d.destino_nombre ?? "";
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);

  const tractor = patentePlanilla(d.tractor ?? d.chasis ?? d.patente ?? d.patente_chasis);
  const semi = patentePlanilla(d.semi ?? d.acoplado ?? d.patente_acoplado);
  const chofer = findChofer(ctx.choferes, remito.telefono_chofer, d.conductor ?? d.chofer);
  const codOrig = locOrig?.codigo ?? d.cod_origen ?? "";
  const codDest = locDest?.codigo ?? d.cod_cliente?.replace(/\D/g, "") ?? "";
  const tramos =
    d.tramos ?? (codOrig && codDest ? `${codOrig} - ${codDest}` : codOrig || codDest || "");

  const bultos = d.total_bultos ?? d.bultos ?? null;
  const horaInicio = d.hora_inicio ?? d.hora_carga ?? horaSlot(d.horarios?.horarios?.carga_entrada);
  const horaFin = d.hora_fin ?? d.hora_descarga ?? horaSlot(d.horarios?.horarios?.descarga_fin);

  return {
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    origen: locOrig?.nombre ?? origenNom,
    destino: locDest?.nombre ?? destinoNom,
    tractor,
    semi,
    chofer: chofer?.toUpperCase() ?? "",
    tramos,
    hora_inicio: horaInicio ?? "",
    hora_fin: horaFin ?? "",
    bultos: bultos != null ? formatoDecimalEs(bultos) : "",
    remito: nroRemitoDisplay(d),
    locOrig,
    locDest,
    bultosNum: bultos,
    doc: String(d.nro_remito ?? d.nro_guia ?? "").replace(/\D/g, "") || String(d.nro_remito ?? ""),
  };
}

export function remitoAFilaLocal(remito, _nroViaje, ctx) {
  const c = datosCorina(remito, ctx);
  return [
    {
      remito_id: remito.id,
      ...c,
    },
  ];
}

function baseFilaDelfos({ nroViaje, orden, remito, ctx, horaInicio, horaFin, incluirDoc = false }) {
  const c = datosCorina(remito, ctx);
  const esOrden1 = orden === 1;
  const orig = esOrden1 ? c.locOrig : c.locDest;
  const dest = esOrden1 ? c.locDest : c.locOrig;
  const origNom = esOrden1 ? c.origen : c.destino;
  const destNom = esOrden1 ? c.destino : c.origen;

  return {
    remito_id: remito.id,
    nro_viaje: nroViaje,
    orden,
    fecha_inicio: c.fecha,
    tipo_viaje: TIPO_VIAJE,
    producto: PRODUCTO,
    nro_documento: incluirDoc ? c.doc : "",
    coef_distrib: "",
    suc_origen: "",
    nro_cta_origen: orig?.codigo ?? "",
    dir_entrega_origen: "000",
    razon_social_origen: orig?.nombre ?? origNom,
    id_camion: "",
    nro_op: "",
    nro_cta_destino: dest?.codigo ?? "",
    dir_entrega_destino: "000",
    razon_social_destino: dest?.nombre ?? destNom,
    producto_pla: "",
    cantidad: esOrden1 && c.bultosNum != null ? formatoDecimalEs(c.bultosNum) : "",
    hora_inicio: horaInicio,
    fecha_fin: c.fecha,
    hora_fin: horaFin,
    tractor_patente: c.tractor,
    semi_patente: c.semi,
    chofer: c.chofer,
    unidad_medida: esOrden1 && c.bultosNum != null ? UNIDAD : "",
  };
}

/** Delfos: 2 filas por remito (ida y vuelta), como Excel legacy. */
export function remitoAFilasImportacion(remito, nroViaje, ctx) {
  const c = datosCorina(remito, ctx);
  return [
    baseFilaDelfos({
      nroViaje,
      orden: 1,
      remito,
      ctx,
      horaInicio: c.hora_inicio,
      horaFin: c.hora_fin || c.hora_inicio,
      incluirDoc: true,
    }),
    baseFilaDelfos({
      nroViaje,
      orden: 2,
      remito,
      ctx,
      horaInicio: c.hora_fin || c.hora_inicio,
      horaFin: c.hora_fin,
      incluirDoc: false,
    }),
  ];
}

export function columnasCorina(formato) {
  if (formato === "local") return PLANILLA_LOCAL_COLUMNS;
  return columnasParaFormato("delfos");
}

export { filasAoa };

export async function buildPlanillaCorina(opts = {}) {
  const {
    formato = "local",
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
    remitoStore.listRemitos({ tenant: "corina", limit: 500 }),
    master.listCollection("choferes", { tenant: "corina", activo: true }),
    master.listCollection("localidades", { tenant: "corina", activo: true }),
  ]);

  const ctx = { tipoViaje: TIPO_VIAJE, producto: PRODUCTO };
  let filtrados = remitos.filter((r) => estadosSet.has(r.estado) && remitoListoParaPlanilla(r));
  filtrados = filtrados.filter((r) => remitoEnRango(r, { desde, hasta }));
  filtrados.sort((a, b) => {
    const fa = parseFechaRemito(a);
    const fb = parseFechaRemito(b);
    return fa.localeCompare(fb) || (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  filtrados = filtrados.slice(0, limit);

  const esImportacion = formato === "importacion" || formato === "delfos";
  const mapRemito = esImportacion ? remitoAFilasImportacion : remitoAFilaLocal;

  const base = await buildPlanillaFromRemitos({
    tenant: "corina",
    remitos: filtrados,
    choferes,
    localidades,
    ctx,
    formato: esImportacion ? "delfos" : "local",
    mapRemito,
  });

  return {
    ...base,
    formato: esImportacion ? "importacion" : "local",
    columnas: columnasCorina(esImportacion ? "importacion" : "local"),
    meta: {
      remitos: filtrados.length,
      filas: base.filas.length,
      desde: desde ?? null,
      hasta: hasta ?? null,
    },
  };
}
