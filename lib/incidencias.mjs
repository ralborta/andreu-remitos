/**
 * Dominio Incidencias en ruta (choferes) — demo TransitOne / SOL.
 */

export const INCIDENCIA_TIPOS = [
  "parada_no_prevista",
  "desvio_ruta",
  "demora",
  "pinchazo",
  "mecanico",
  "control",
  "accidente",
  "anomalia",
  "otro",
];

export const INCIDENCIA_TIPO_LABEL = {
  parada_no_prevista: "Parada no prevista",
  desvio_ruta: "Desvío de ruta",
  demora: "Demora",
  pinchazo: "Pinchazo / llanta",
  mecanico: "Problema mecánico",
  control: "Control / policía",
  accidente: "Accidente",
  anomalia: "Anomalía",
  otro: "Otro",
};

export const INCIDENCIA_TIPO_ABBR = {
  parada_no_prevista: "PN",
  desvio_ruta: "DR",
  demora: "DE",
  pinchazo: "PI",
  mecanico: "ME",
  control: "CO",
  accidente: "AC",
  anomalia: "AN",
  otro: "OT",
};

export const INCIDENCIA_ABBR_LABEL = {
  PN: "Parada no prevista",
  DR: "Desvío de ruta",
  DE: "Demora",
  PI: "Pinchazo / llanta",
  ME: "Problema mecánico",
  CO: "Control / policía",
  AC: "Accidente",
  AN: "Anomalía",
  OT: "Otros",
};

export const INCIDENCIA_CRITICIDADES = ["alta", "media", "baja"];

export const INCIDENCIA_CRITICIDAD_LABEL = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

/** esperando_causa = diálogo abierto (agente preguntó o falta detalle). */
export const INCIDENCIA_ESTADOS = ["esperando_causa", "nueva", "en_gestion", "resuelta"];

export const INCIDENCIA_ESTADO_LABEL = {
  esperando_causa: "Esperando causa",
  nueva: "Nueva",
  en_gestion: "En gestión",
  resuelta: "Resuelta",
};

export const INCIDENCIA_ORIGENES = ["chofer", "agente", "destinos_demora"];

export function labelTipo(t) {
  return INCIDENCIA_TIPO_LABEL[t] || INCIDENCIA_TIPO_LABEL.otro;
}

export function labelCriticidad(c) {
  return INCIDENCIA_CRITICIDAD_LABEL[c] || INCIDENCIA_CRITICIDAD_LABEL.media;
}

export function labelEstadoIncidencia(e) {
  return INCIDENCIA_ESTADO_LABEL[e] || e || "—";
}

export function abbrTipo(tipo) {
  return INCIDENCIA_TIPO_ABBR[tipo] || "OT";
}

export function ymdLocal(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

export function extractCodigoIncidencia(texto) {
  const m = String(texto ?? "")
    .toUpperCase()
    .match(/\bINC[- ]?(\d{8})[- ]?(\d{1,5})[- ]?([A-Z]{2})\b/);
  if (!m) {
    const legacy = String(texto ?? "")
      .toUpperCase()
      .match(/\bINC[- ]?[A-F0-9]{4,12}\b/);
    return legacy
      ? legacy[0].replace(/\s+/g, "").replace(/^INC-?/, "INC-").replace(/^INC([^-])/, "INC-$1")
      : null;
  }
  const seq = String(parseInt(m[2], 10)).padStart(4, "0");
  return `INC-${m[1]}-${seq}-${m[3]}`;
}

/**
 * Código público: INC-YYYYMMDD-0001-PI
 */
export function buildCodigoIncidencia(tipo, existentes = [], date = new Date()) {
  const ymd = ymdLocal(date);
  const abbr = abbrTipo(tipo);
  let maxSeq = 0;
  for (const r of existentes) {
    const c = String(r.codigo || r.id || "");
    const m = c.match(new RegExp(`^INC-${ymd}-(\\d{4})-[A-Z]{2}$`));
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  const seq = String(maxSeq + 1).padStart(4, "0");
  return `INC-${ymd}-${seq}-${abbr}`;
}

export function codigoVisible(row) {
  return row?.codigo || row?.id || "—";
}

export function calcularSlaLabel(row) {
  if (!row || row.estado === "resuelta") return "Cumplido";
  const created = new Date(row.created_at || Date.now()).getTime();
  const hours = (Date.now() - created) / 3_600_000;
  const limite =
    row.criticidad === "alta" ? 2 : row.criticidad === "baja" ? 24 : 8;
  if (hours >= limite) return "Por vencer";
  return "En SLA";
}

export function normalizeTipo(v) {
  const t = String(v || "otro").toLowerCase().trim();
  if (INCIDENCIA_TIPOS.includes(t)) return t;
  if (/pinch|llanta|goma|neum/.test(t)) return "pinchazo";
  if (/mec[aá]nic|motor|aver[ií]a\s*camion|no\s*arranca|taller/.test(t)) return "mecanico";
  if (/polic|control|reten|alcoholem|ruta\s*\d/.test(t)) return "control";
  if (/accident|choque|vuelco|colisi/.test(t)) return "accidente";
  if (/desv[ií]o|ruta\s*mal|me\s*desvi/.test(t)) return "desvio_ruta";
  if (/parada|parado|detenid|esperando|demor[aá]|retraso|tr[aá]nsito|atasco/.test(t)) {
    if (/desv/.test(t)) return "desvio_ruta";
    if (/demor|retras|tr[aá]nsito|atasco/.test(t)) return "demora";
    return "parada_no_prevista";
  }
  if (/anomal/.test(t)) return "anomalia";
  return "otro";
}

export function normalizeCriticidad(v, tipo) {
  const c = String(v || "").toLowerCase().trim();
  if (INCIDENCIA_CRITICIDADES.includes(c)) return c;
  if (tipo === "accidente" || tipo === "mecanico") return "alta";
  if (tipo === "pinchazo" || tipo === "control") return "media";
  if (tipo === "demora" || tipo === "parada_no_prevista") return "media";
  return "baja";
}
