/**
 * Utilidades y columnas compartidas — planillas Delfos / Proforma (TSB + Beraldi).
 */

import { remitoListoParaPlanilla } from "./remito-procesable.mjs";

export { remitoListoParaPlanilla };

/** Columnas A–Y del Excel Delfos / export Arianna. */
export const PLANILLA_DELFOS_COLUMNS = [
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

export const PLANILLA_PROFORMA_COLUMNS = [
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

/** Planilla Diaria — certificación (1 fila por remito). */
export const PLANILLA_DIARIA_COLUMNS = [
  { key: "fecha", header: "FECHA", width: 96 },
  { key: "origen", header: "ORIGEN", width: 180 },
  { key: "destino", header: "DESTINO", width: 180 },
  { key: "patente_tractor", header: "Patente Tractor", width: 108 },
  { key: "int_tractor", header: "INT TRACTOR", width: 96 },
  { key: "semi", header: "SEMI", width: 96 },
  { key: "chofer", header: "CHOFER", width: 140 },
  { key: "tn", header: "TN", width: 72 },
  { key: "rt_n", header: "RT. N", width: 108 },
  { key: "observaciones", header: "OBSERVACIONES", width: 140 },
];

/** Proforma Torre de Control / QuadMy — 2 filas por remito (ida + vuelta). */
export const PLANILLA_PROFORMA_TORRE_COLUMNS = [
  { key: "fecha", header: "FECHA", width: 96 },
  { key: "origen", header: "ORIGEN", width: 180 },
  { key: "destino", header: "DESTINO", width: 180 },
  { key: "patente_tractor", header: "Patente Tractor", width: 108 },
  { key: "int_tractor", header: "INT TRACTOR", width: 96 },
  { key: "semi", header: "SEMI", width: 96 },
  { key: "chofer", header: "CHOFER", width: 140 },
  { key: "nro_viaje", header: "N° de viaje", width: 96 },
  { key: "tn", header: "TN", width: 72 },
  { key: "rt_n", header: "RT. N", width: 108 },
  { key: "observaciones", header: "OBSERVACIONES", width: 140 },
  { key: "rt_n_2", header: "RT. N", width: 108 },
];

export const ESTADOS_PLANILLA = new Set(["confirmado", "pendiente_revision"]);

export function columnasParaFormato(formato) {
  if (formato === "proforma") return PLANILLA_PROFORMA_TORRE_COLUMNS;
  if (formato === "diaria") return PLANILLA_DIARIA_COLUMNS;
  return PLANILLA_DELFOS_COLUMNS;
}

export function findUnidadInterna(unidades, patente, tipo = "tractor") {
  if (!patente) return "";
  const p = patentePlanilla(patente);
  const u = unidades.find((x) => x.tipo === tipo && patentePlanilla(x.patente) === p);
  return u?.unidad_interna ? String(u.unidad_interna) : "";
}

export function filasAoa(filas, columnas = PLANILLA_DELFOS_COLUMNS) {
  const headers = columnas.map((c) => c.header);
  const keys = columnas.map((c) => c.key);
  return [headers, ...filas.map((f) => keys.map((k) => f[k] ?? ""))];
}

export function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function claveLocalidad(s) {
  return norm(s).replace(/[^A-Z0-9]/g, "");
}

/** Puntaje de coincidencia texto libre ↔ localidad maestro (mayor = mejor). */
export function puntajeLocalidad(loc, nombre) {
  if (!loc || !nombre) return 0;
  const n = norm(nombre);
  const k = claveLocalidad(nombre);
  const ln = norm(loc.nombre);
  const lk = claveLocalidad(loc.nombre);
  const lc = loc.codigo ? norm(loc.codigo) : "";

  if (lc && lc === n) return 100;
  if (ln === n) return 100;
  if (k.length >= 4 && lk === k) return 96;
  if (loc.codigo && k.length >= 3 && claveLocalidad(loc.codigo) === k) return 92;

  let score = 0;
  if (ln.includes(n) || n.includes(ln)) {
    score = Math.max(score, 72 - Math.abs(ln.length - n.length) * 0.4);
  }
  if (k.length >= 5 && (lk.includes(k) || k.includes(lk))) {
    score = Math.max(score, 65 - Math.abs(lk.length - k.length) * 0.3);
  }

  const tokensIn = n.split(/[\s\-/.]+/).filter((t) => t.length >= 2);
  for (const t of tokensIn) {
    const tk = claveLocalidad(t);
    if (ln.includes(t) || lk.includes(tk)) score += 10;
  }

  const padIn = k.match(/PAD(\d{1,3})/);
  const padLoc = lk.match(/PAD(\d{1,3})/);
  if (padIn && padLoc && padIn[1] === padLoc[1]) score += 30;

  const pampaIn = /PAMPA/.test(k);
  const pampaLoc = /PAMPA/.test(lk);
  if (pampaIn && pampaLoc && padIn && padLoc) score += 15;

  return score;
}

export function findLocalidad(localidades, nombre) {
  if (!nombre || !localidades?.length) return null;
  const n = norm(nombre);

  let loc =
    localidades.find((l) => norm(l.codigo) === n) ??
    localidades.find((l) => norm(l.nombre) === n);
  if (loc) return loc;

  const k = claveLocalidad(nombre);
  if (k.length >= 4) {
    loc =
      localidades.find((l) => claveLocalidad(l.nombre) === k) ??
      localidades.find((l) => l.codigo && claveLocalidad(l.codigo) === k);
    if (loc) return loc;
  }

  loc = localidades.find((l) => {
    const ln = norm(l.nombre);
    return n.includes(ln) || ln.includes(n);
  });
  if (loc) return loc;

  let best = null;
  let bestScore = 0;
  let secondScore = 0;
  const MIN = 58;

  for (const l of localidades) {
    const s = puntajeLocalidad(l, nombre);
    if (s > bestScore) {
      secondScore = bestScore;
      bestScore = s;
      best = l;
    } else if (s > secondScore) {
      secondScore = s;
    }
  }

  if (bestScore >= MIN && bestScore - secondScore >= 10) return best;
  return null;
}

export function findDistancia(distancias, locOrig, locDest) {
  if (!locOrig?.id || !locDest?.id) return null;
  return (
    distancias.find((d) => d.origen_id === locOrig.id && d.destino_id === locDest.id) ??
    distancias.find((d) => d.destino_id === locOrig.id && d.origen_id === locDest.id) ??
    null
  );
}

export function fechaDdMmYyyy(fecha) {
  if (!fecha) return "";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(fecha))) return String(fecha);
  return String(fecha);
}

export function horaSlot(slot) {
  return slot?.hora ?? "";
}

export function parseFechaRemito(remito) {
  const d = remito.datos ?? {};
  return d.fecha_guia ?? d.fecha ?? d.fecha_remito ?? remito.created_at?.slice(0, 10) ?? "";
}

export function remitoEnRango(remito, { desde, hasta }) {
  const f = parseFechaRemito(remito);
  if (!f) return true;
  const iso = f.match(/^\d{4}-\d{2}-\d{2}/) ? f.slice(0, 10) : null;
  if (!iso) return true;
  if (desde && iso < desde) return false;
  if (hasta && iso > hasta) return false;
  return true;
}

export function formatoDecimalEs(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "";
  return num.toFixed(2).replace(".", ",");
}

export function patentePlanilla(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export async function buildPlanillaFromRemitos({
  tenant,
  remitos,
  choferes,
  localidades,
  distancias = [],
  ctx,
  formato,
  mapRemito,
}) {
  const esProforma = formato === "proforma";
  const columnas = columnasParaFormato(formato);
  const filas = [];
  let nroViaje = 1;

  for (const remito of remitos) {
    const filasRemito = mapRemito(remito, nroViaje, { ...ctx, choferes, localidades, distancias, esProforma });
    filas.push(...filasRemito);
    nroViaje += 1;
  }

  return {
    tenant,
    formato,
    tipo_viaje: ctx.tipoViaje,
    columnas,
    filas,
  };
}
