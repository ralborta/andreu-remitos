/**
 * InterruptPolicy — sin heurísticas nuevas de texto.
 * Usa intents del router existente (H1–H14) + tabla declarativa.
 */

import { getInterruptMaxDepth } from "./config.mjs";

/** Intents que continúan el processType activo (no laterales). */
export const CONTINUATION_INTENTS = {
  remito_revision: new Set(["remito"]),
  viaje_solicitud: new Set(["viaje"]),
  destino_confirmacion: new Set(["destino", "continue_process"]),
  destino_eta_chofer: new Set(["destino", "continue_process"]),
  pod_caso: new Set(["pod"]),
  rendicion_gasto: new Set(["rendicion"]),
  incidencia: new Set(["incidencia"]),
  reclamo: new Set(["reclamo"]),
  ephemeral_qa: new Set(["chat"]),
  human_takeover: new Set(),
};

/** resumeMode default del padre según tipo de hijo */
export function resumeModeForChild(childProcessType) {
  if (childProcessType === "reclamo") return "manual_only";
  if (childProcessType === "ephemeral_qa") return "auto_on_child_idle";
  if (childProcessType === "human_takeover") return "manual_only";
  if (childProcessType === "incidencia") return "auto_on_child_complete";
  return "auto_on_child_complete";
}

/** Mapa intent → processType / agentId del hijo */
export function childSpecForIntent(intent) {
  const map = {
    viaje: { processType: "viaje_solicitud", agentId: "viajes", executorKey: "viajes_force" },
    reclamo: { processType: "reclamo", agentId: "reclamos", executorKey: "reclamos_force" },
    incidencia: { processType: "incidencia", agentId: "incidencias", executorKey: "incidencias_force" },
    remito: { processType: "remito_revision", agentId: "remitos", executorKey: "remitos_texto" },
    pod: { processType: "pod_caso", agentId: "pod", executorKey: "pod_force" },
    rendicion: { processType: "rendicion_gasto", agentId: "rendicion", executorKey: "rendicion_force" },
    destino: { processType: "destino_confirmacion", agentId: "destinos", executorKey: "destinos" },
    chat: { processType: "ephemeral_qa", agentId: "router", executorKey: "clarify" },
  };
  return map[intent] || null;
}

/**
 * ¿El intent es continuación del process activo?
 */
export function isContinuationIntent(activeProcessType, intent) {
  if (!activeProcessType || !intent) return false;
  const set = CONTINUATION_INTENTS[activeProcessType];
  if (!set) return false;
  return set.has(intent);
}

/**
 * Matriz allow (declarativa). chat solo si confianza >= umbral.
 */
const ALLOW = {
  remito_revision: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: false,
    pod: true,
    rendicion: true,
    destino: true,
    chat: "confidence",
    desconocido: false,
  },
  viaje_solicitud: {
    viaje: false,
    reclamo: true,
    incidencia: true,
    remito: true,
    pod: true,
    rendicion: true,
    destino: true,
    chat: "confidence",
    desconocido: false,
  },
  destino_confirmacion: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: true,
    pod: true,
    rendicion: true,
    destino: false,
    chat: "confidence",
    desconocido: false,
  },
  destino_eta_chofer: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: true,
    pod: true,
    rendicion: true,
    destino: false,
    chat: "confidence",
    desconocido: false,
  },
  incidencia: {
    viaje: true,
    reclamo: true,
    incidencia: false,
    remito: true,
    pod: true,
    rendicion: true,
    destino: true,
    chat: "confidence",
    desconocido: false,
  },
  reclamo: {
    viaje: true,
    reclamo: false,
    incidencia: true,
    remito: true,
    pod: true,
    rendicion: true,
    destino: true,
    chat: "confidence",
    desconocido: false,
  },
  pod_caso: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: true,
    pod: false,
    rendicion: true,
    chat: "confidence",
    desconocido: false,
  },
  rendicion_gasto: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: true,
    rendicion: false,
    chat: "confidence",
    desconocido: false,
  },
  ephemeral_qa: {
    viaje: true,
    reclamo: true,
    incidencia: true,
    remito: true,
    chat: false,
    desconocido: false,
  },
};

const CHAT_MIN_CONF = 0.7;

/**
 * @returns {{ allow: boolean, reason: string }}
 */
export function allowsInterrupt({
  active,
  intent,
  confidence = 0,
  stackDepth = 0,
  hasMedia = false,
  botPaused = false,
  maxDepth = null,
} = {}) {
  const depthLimit = maxDepth ?? getInterruptMaxDepth();

  if (botPaused) return { allow: false, reason: "human_takeover" };
  if (!active || active.status !== "active") return { allow: false, reason: "no_active" };
  if (active.processType === "human_takeover") return { allow: false, reason: "human_takeover" };
  if (hasMedia) return { allow: false, reason: "media_stays_with_active" };
  if (stackDepth >= depthLimit) return { allow: false, reason: "max_depth" };
  if (!intent || intent === "desconocido") return { allow: false, reason: "unknown_intent" };
  if (isContinuationIntent(active.processType, intent)) {
    return { allow: false, reason: "continuation" };
  }

  const row = ALLOW[active.processType];
  if (!row) return { allow: false, reason: "no_policy_row" };
  const cell = row[intent];
  if (cell === true) return { allow: true, reason: "policy_allow" };
  if (cell === "confidence") {
    if (confidence >= CHAT_MIN_CONF) return { allow: true, reason: "chat_confidence" };
    return { allow: false, reason: "chat_low_confidence" };
  }
  return { allow: false, reason: "policy_deny" };
}

/** Señales de cancelación explícita — reutiliza patrones ya usados en confirmaciones legacy, sin dominio nuevo. */
export function isExplicitCancelText(texto) {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (!t) return false;
  // Frases de abandono ya comunes en UX; no es clasificación de negocio nueva.
  return /^(dejemos eso|dejalo|dejalo ahi|cancel(a|ar|alo)?|olvidate|no sigamos|basta|cortemos)$/i.test(
    t,
  ) || /\b(cancel(a|ar)\s+(el\s+)?(viaje|remito|reclamo|proceso))\b/i.test(t);
}

/** Pedido manual de reanudación del proceso pausado (tope). */
export function isExplicitResumeText(texto) {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (!t) return false;
  return /\b(volvamos|seguir|seguimos|continuar|continuemos|retomar|retomemos|volver\s+al)\b/i.test(
    t,
  );
}
