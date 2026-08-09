/**
 * Dominio Reclamos logísticos (clientes) — alineado a la demo UI.
 */

export const RECLAMO_MOTIVOS = [
  "demora_entrega",
  "faltante",
  "averia",
  "producto_equivocado",
  "documentacion",
  "trato",
  "otro",
];

export const RECLAMO_MOTIVO_LABEL = {
  demora_entrega: "Demora en entrega",
  faltante: "Faltante",
  averia: "Producto dañado / avería",
  producto_equivocado: "Producto equivocado",
  documentacion: "Documentación",
  trato: "Trato",
  otro: "Otro",
};

/** Abreviatura pública en el nº de caso (RC-YYYYMMDD-0001-XX). */
export const RECLAMO_MOTIVO_ABBR = {
  demora_entrega: "RT", // retraso
  faltante: "FA",
  averia: "PD", // producto dañado
  producto_equivocado: "PE",
  documentacion: "DO",
  trato: "TR",
  otro: "OT",
};

export const RECLAMO_ABBR_LABEL = {
  RT: "Retraso / demora",
  FA: "Faltante",
  PD: "Producto dañado",
  PE: "Producto equivocado",
  DO: "Documentación",
  TR: "Trato",
  OT: "Otros",
};

/** Solo estos motivos piden foto del producto (daño o error de ítem). */
export const RECLAMO_MOTIVOS_REQUIEREN_FOTO = ["averia", "producto_equivocado"];

export function motivoRequiereFoto(motivo) {
  return RECLAMO_MOTIVOS_REQUIEREN_FOTO.includes(String(motivo || "").toLowerCase());
}

export function abbrMotivo(motivo) {
  return RECLAMO_MOTIVO_ABBR[motivo] || "OT";
}

/** Extrae un código público RC-YYYYMMDD-NNNN-XX del texto. */
export function extractCodigoReclamo(texto) {
  const m = String(texto ?? "").toUpperCase().match(/\bRC[- ]?(\d{8})[- ]?(\d{1,5})[- ]?([A-Z]{2})\b/);
  if (!m) {
    // legado RC-XXXXXXXX
    const legacy = String(texto ?? "").toUpperCase().match(/\bRC[- ]?[A-F0-9]{6,12}\b/);
    return legacy ? legacy[0].replace(/\s+/g, "").replace(/^RC-?/, "RC-").replace(/^RC([^-])/, "RC-$1") : null;
  }
  const seq = String(parseInt(m[2], 10)).padStart(4, "0");
  return `RC-${m[1]}-${seq}-${m[3]}`;
}

export function ymdLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

/**
 * Código público: RC-YYYYMMDD-0001-PD
 * @param {string} motivo
 * @param {Array<{ codigo?: string|null }>} existentes
 */
export function buildCodigoReclamo(motivo, existentes = [], date = new Date()) {
  const ymd = ymdLocal(date);
  const abbr = abbrMotivo(motivo);
  const prefix = `RC-${ymd}-`;
  let maxSeq = 0;
  for (const r of existentes) {
    const c = String(r.codigo || r.id || "");
    const m = c.match(new RegExp(`^RC-${ymd}-(\\d{4})-[A-Z]{2}$`));
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  const seq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${seq}-${abbr}`;
}

export const RECLAMO_CRITICIDADES = ["alta", "media", "baja"];

export const RECLAMO_CRITICIDAD_LABEL = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

/** Estados visibles en panel (demo). */
export const RECLAMO_ESTADOS = ["nuevo", "en_proceso", "escalado", "resuelto", "recolectando"];

export const RECLAMO_ESTADO_LABEL = {
  recolectando: "Recolectando",
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  escalado: "Escalado",
  resuelto: "Resuelto",
};

export function labelMotivo(m) {
  return RECLAMO_MOTIVO_LABEL[m] || RECLAMO_MOTIVO_LABEL.otro;
}

export function labelCriticidad(c) {
  return RECLAMO_CRITICIDAD_LABEL[c] || RECLAMO_CRITICIDAD_LABEL.media;
}

export function labelEstadoReclamo(e) {
  return RECLAMO_ESTADO_LABEL[e] || e;
}

/** Código visible al cliente / panel. */
export function codigoVisible(row) {
  if (!row) return "—";
  return row.codigo || row.id || "—";
}

/** SLA demo-simple a partir de criticidad + created_at. */
export function calcularSlaLabel(row) {
  if (!row) return "En SLA";
  if (row.estado === "resuelto") return "Cumplido";
  const created = Date.parse(row.created_at || "");
  if (!Number.isFinite(created)) return "En SLA";
  const hours = (Date.now() - created) / 3600000;
  const limit =
    row.criticidad === "alta" ? 4 : row.criticidad === "baja" ? 48 : 12;
  if (hours >= limit) return "Por vencer";
  if (hours >= limit * 0.7) return "Por vencer";
  return "En SLA";
}

/** ¿Parece consulta de estado de un caso ya abierto? */
export function pareceConsultaEstadoReclamo(texto) {
  const t = String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t.trim()) return false;
  if (extractCodigoReclamo(texto)) return true;
  return (
    /\b(como\s+va|como\s+esta|estado|seguimiento|novedad|avance|consulta)\b/.test(t) &&
    /\b(caso|reclamo|ticket|denuncia)\b/.test(t)
  ) || /\b(mi\s+reclamo|mi\s+caso|el\s+reclamo|el\s+caso)\b/.test(t);
}
