/**
 * Export Torre de Control / QM (nuevo TMS).
 * Plantilla Excel: 22 columnas fijas, 2 filas por remito (Carga + Descarga, sin retorno).
 */

import {
  findLocalidad,
  fechaDdMmYyyy,
  horaSlot,
  parseFechaRemito,
  formatoDecimalEs,
  patentePlanilla,
} from "./planilla-common.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

/** Headers exactos — plantilla Gisela / importador TMS (22 cols A–V). */
export const PLANILLA_TMS_QM_COLUMNS = [
  { key: "codigo_viaje", header: "Código de Viaje (Obligatorio)", width: 120 },
  { key: "tipo_viaje", header: "Tipo de Viaje (Obligatorio)", width: 120 },
  { key: "inicio_programado", header: "Inicio programado (Obligatorio)", width: 140 },
  { key: "hora_inicio_programado", header: "Hora de inicio programada (Obligatorio)", width: 160 },
  { key: "codigo_parada", header: "Código de Parada (Obligatorio)", width: 140 },
  { key: "tipo_parada", header: "Tipo de Parada (Obligatorio)", width: 120 },
  { key: "numero_parada", header: "Número de Parada (Obligatorio)", width: 120 },
  { key: "codigo_orden", header: "Código de Orden (Opcional)", width: 120 },
  { key: "cliente", header: "Cliente (Opcional)", width: 160 },
  { key: "transportista", header: "Transportista (Opcional)", width: 160 },
  { key: "patente", header: "Patente (Opcional)", width: 100 },
  { key: "conductor", header: "Conductor (Opcional)", width: 140 },
  { key: "semirremolque", header: "Semirremolque (Opcional)", width: 120 },
  { key: "codigo_tarifa", header: "Código de Tarifa (Opcional)", width: 120 },
  { key: "etiquetas", header: "Etiquetas (Opcional)", width: 100 },
  { key: "tipo_orden", header: "Tipo de Orden (Opcional)", width: 120 },
  { key: "codigo_producto", header: "Código de Producto (Opcional)", width: 140 },
  { key: "descripcion_producto", header: "Descripción de Producto (Opcional)", width: 160 },
  { key: "cantidad_producto", header: "Cantidad de Producto (Opcional)", width: 140 },
  { key: "peso_producto", header: "Peso de Producto (Opcional)", width: 120 },
  { key: "pallets", header: "Pallets (Opcional)", width: 100 },
  { key: "comentarios", header: "Comentarios (Opcional)", width: 140 },
];

/** Nombre TMS esperado por cliente interno (tenant). */
export const TMS_QM_CLIENTE_POR_TENANT = {
  tsb: "Compañía TCB Cuyana",
  beraldi: "Transporte José Beraldi S.A.",
  mye: "MYE S.A.",
};

export const TMS_QM_TRANSPORTISTA_DEFAULT = "Felipe Andreu e Hijos";

/** Gisela/cliente: "Arenas" con mayúscula (no "arenas"). */
const TIPO_VIAJE_TMS = {
  ARENA: "Arenas",
  GNL: "GNL",
  "Corta Distancia": "Corta Distancia",
};

export function tipoViajeTmsQm(tipoViaje) {
  if (TIPO_VIAJE_TMS[tipoViaje]) return TIPO_VIAJE_TMS[tipoViaje];
  const raw = String(tipoViaje ?? "").trim();
  if (!raw) return "Arenas";
  if (/^arena/i.test(raw)) return "Arenas";
  return raw;
}

/** Normaliza a HH:MM; acepta "9:5", "09:05", etc. */
export function normalizarHoraHhMm(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return "";
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Suma horas a HH:MM (regla reunión: descarga = carga + 3 h). */
export function horaSumarHoras(horaStr, horas = 3) {
  const base = normalizarHoraHhMm(horaStr);
  if (!base) return "";
  const m = base.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  const totalMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + horas * 60;
  const norm = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60);
  const min = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Hora de carga desde remito; si falta, default 00:00 para no dejar la columna vacía. */
export function horaInicioCargaTmsQm(datos) {
  const d = datos ?? {};
  const hor = d.horarios?.horarios ?? {};
  const candidatos = [
    horaSlot(hor.carga_entrada),
    horaSlot(hor.carga_salida),
    d.hora_carga,
    d.hora_inicio,
    d.hora,
    // Fallbacks OCR sueltos (MyESA / TSB a veces guardan en campos flat)
    d.hora_carga_entrada,
    d.hora_carga_salida,
  ];
  for (const c of candidatos) {
    const hh = normalizarHoraHhMm(c);
    if (hh) return hh;
  }
  return "00:00";
}

function pickField(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function codigoOrdenTsbMye(d) {
  const raw = d.nro_guia ?? d.nro_remito ?? "";
  const digits = String(raw).replace(/\D/g, "");
  return digits || String(raw).trim();
}

function codigoOrdenBeraldi(d) {
  const raw = d.nro_remito ?? d.nro_guia ?? "";
  const n = normalizarNroRemitoGuia(raw, { tenant: "beraldi" }) ?? String(raw).trim();
  return String(n).replace(/\D/g, "") || String(raw).trim();
}

function cantidadToneladas(pesoKg) {
  const n = Number(pesoKg);
  if (!Number.isFinite(n) || n <= 0) return "";
  const tn = n / 1000;
  if (Math.abs(tn - Math.round(tn)) < 0.05) return String(Math.round(tn));
  return formatoDecimalEs(tn);
}

function filaTmsQm(base, parada) {
  return {
    remito_id: base.remito_id,
    codigo_viaje: "",
    tipo_viaje: base.tipo_viaje,
    inicio_programado: base.fecha,
    hora_inicio_programado: parada.hora,
    codigo_parada: parada.codigo_parada,
    tipo_parada: parada.tipo_parada,
    numero_parada: parada.numero_parada,
    codigo_orden: base.codigo_orden,
    cliente: base.cliente,
    transportista: base.transportista,
    patente: base.patente,
    conductor: base.conductor,
    semirremolque: base.semirremolque,
    codigo_tarifa: "",
    etiquetas: "",
    tipo_orden: "",
    codigo_producto: "",
    descripcion_producto: "",
    cantidad_producto: parada.cantidad_producto ?? "",
    peso_producto: "",
    pallets: "",
    comentarios: "",
  };
}

/**
 * Genera 2 filas por remito: Carga (parada 1) + Descarga (parada 2). Sin retorno.
 * @param {object} remito
 * @param {object} ctx — tipoViaje, localidades, tenant, hooks opcionales
 */
export function remitoAFilasTmsQm(remito, ctx) {
  const d = remito.datos ?? {};
  const tenant = ctx.tenant ?? "tsb";
  const hooks = ctx.tmsQmHooks ?? {};

  const origenNom = pickField(d, hooks.origenFields ?? ["procedencia", "origen"]);
  const destinoNom = pickField(d, hooks.destinoFields ?? ["destino", "destino_nombre", "destino_locacion"]);
  const locOrig = findLocalidad(ctx.localidades, origenNom);
  const locDest = findLocalidad(ctx.localidades, destinoNom);

  const choferNom =
    hooks.findChofer?.(remito, d) ??
    pickField(d, hooks.choferFields ?? ["conductor", "chofer"]);
  const conductor = hooks.formatoChofer?.(choferNom) ?? String(choferNom ?? "").trim();

  const tractor = patentePlanilla(
    pickField(d, hooks.tractorFields ?? ["chasis", "tractor", "patente_chasis"]),
  );
  const semi = patentePlanilla(
    pickField(d, hooks.semiFields ?? ["acoplado", "semi", "patente_acoplado"]),
  );

  const codigoOrden =
    hooks.codigoOrden?.(d) ??
    (tenant === "beraldi" ? codigoOrdenBeraldi(d) : codigoOrdenTsbMye(d));

  const horaCarga = horaInicioCargaTmsQm(d);
  const horaDescarga = horaSumarHoras(horaCarga, 3) || "03:00";

  const cantidad = cantidadToneladas(d.peso_kg ?? d.peso);

  const base = {
    remito_id: remito.id,
    tipo_viaje: tipoViajeTmsQm(ctx.tipoViaje),
    fecha: fechaDdMmYyyy(parseFechaRemito(remito)),
    codigo_orden: codigoOrden,
    cliente: TMS_QM_CLIENTE_POR_TENANT[tenant] ?? tenant.toUpperCase(),
    transportista: hooks.transportista ?? TMS_QM_TRANSPORTISTA_DEFAULT,
    patente: tractor,
    conductor,
    semirremolque: semi,
  };

  return [
    filaTmsQm(base, {
      codigo_parada: locOrig?.codigo ?? "",
      tipo_parada: "Carga",
      numero_parada: "1",
      hora: horaCarga,
      cantidad_producto: cantidad,
    }),
    filaTmsQm(base, {
      codigo_parada: locDest?.codigo ?? "",
      tipo_parada: "Descarga",
      numero_parada: "2",
      hora: horaDescarga,
      cantidad_producto: "",
    }),
  ];
}

/** Bloque reutilizable desde buildPlanillaTsb / buildPlanillaBeraldi. */
export function buildPlanillaTmsQmResult({ tenant, filtrados, ctx, tmsQmHooks, metaExtra = {} }) {
  const fullCtx = { ...ctx, tenant, tmsQmHooks };
  const filas = [];
  for (const remito of filtrados) {
    filas.push(...remitoAFilasTmsQm(remito, fullCtx));
  }
  return {
    tenant,
    formato: "qm",
    tipo_viaje: ctx.tipoViaje,
    columnas: PLANILLA_TMS_QM_COLUMNS,
    filas,
    meta: {
      remitos: filtrados.length,
      filas: filas.length,
      ...metaExtra,
    },
  };
}
