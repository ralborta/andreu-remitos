/**
 * Evidencias de Transporte — POP / POD (cadena de custodia).
 * Evolución del dominio POD hacia evidencias genéricas.
 */

export const EVIDENCE_TYPES = ["POP", "POD"];

/** Estados operativos (mesa + diálogo WA). */
export const EVIDENCE_ESTADOS = [
  "esperando_receptor",
  "esperando_foto",
  "esperando_carga",
  "pendiente",
  "observado",
  "ok",
  "rechazado",
];

/** Diálogo activo en WhatsApp — no listar en mesa. */
export const EVIDENCE_ESTADOS_DIALOG = new Set([
  "esperando_receptor",
  "esperando_foto",
  "esperando_carga",
]);

/** Compat POD legacy. */
export const POD_ESTADOS = EVIDENCE_ESTADOS;
export const POD_ESTADOS_DIALOG = EVIDENCE_ESTADOS_DIALOG;

export const EVIDENCE_ESTADO_LABEL = {
  esperando_receptor: "Esperando receptor",
  esperando_foto: "Esperando foto",
  esperando_carga: "Esperando datos de carga",
  pendiente: "Pendiente",
  observado: "Observado",
  ok: "Aprobado",
  rechazado: "Rechazado",
};

export const POD_ESTADO_LABEL = EVIDENCE_ESTADO_LABEL;

export const EVIDENCE_CONDITIONS = [
  "ok",
  "incompleta",
  "danada",
  "embalaje_deteriorado",
  "diferencia_cantidad",
  "otro",
];

export const EVIDENCE_CONDITION_LABEL = {
  ok: "OK",
  incompleta: "Incompleta",
  danada: "Dañada",
  embalaje_deteriorado: "Embalaje deteriorado",
  diferencia_cantidad: "Diferencia de cantidad",
  otro: "Otro",
};

/** Milestones expuestos a Gestión de Viajes (§4). */
export const MILESTONE_STATUS = [
  "not_required",
  "pending",
  "received",
  "observed",
  "approved",
  "rejected",
];

export function labelEstadoEvidence(estado) {
  return EVIDENCE_ESTADO_LABEL[estado] || estado || "—";
}

export function labelEstadoPod(estado) {
  return labelEstadoEvidence(estado);
}

export function labelEvidenceType(type) {
  return type === "POP" ? "POP (retiro)" : type === "POD" ? "POD (entrega)" : type || "—";
}

export function buildCodigoEvidence(type, rows) {
  const prefix = type === "POP" ? "POP" : "POD";
  const n =
    (Array.isArray(rows) ? rows : []).filter(
      (r) => r.codigo && String(r.codigo).startsWith(`${prefix}-`),
    ).length + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/** Compat legacy. */
export function buildCodigoPod(rows) {
  return buildCodigoEvidence("POD", rows);
}

export function milestoneFromEvidence(row) {
  if (!row) return "not_required";
  if (row.estado === "ok") return "approved";
  if (row.estado === "rechazado") return "rejected";
  if (row.estado === "observado" || row.observed) return "observed";
  if (row.estado === "pendiente") return "received";
  if (EVIDENCE_ESTADOS_DIALOG.has(row.estado)) return "pending";
  return "pending";
}

export function normalizeQuantities(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const q = {};
  for (const k of ["pallets", "cajas", "bultos", "peso", "volumen"]) {
    const v = raw[k];
    if (v != null && v !== "") {
      const n = Number(v);
      q[k] = Number.isFinite(n) ? n : String(v).trim();
    }
  }
  if (raw.unit) q.unit = String(raw.unit).trim();
  if (raw.raw) q.raw = String(raw.raw).trim();
  return Object.keys(q).length ? q : null;
}
