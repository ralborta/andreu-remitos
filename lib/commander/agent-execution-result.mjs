/**
 * AgentExecutionResult — contrato mínimo de finalización (v1.1.1).
 * Sin Tool Registry / Event Bus. Sin inferencia por keywords de texto.
 *
 * status:
 *  - completed: turno/agente terminó de forma terminal
 *  - waiting_user: espera input del usuario
 *  - ongoing: sigue en el mismo process
 *  - failed: error no recuperable del handler (no pop destructivo)
 *
 * resumePolicy: auto | manual | none
 */

/** Flows legacy explícitos → status (IDs de flow, no NLP). */
const FLOW_STATUS = {
  // terminal OK
  confirmado: "completed",
  process_cancelled: "completed",
  interrupt_ephemeral_then_resume: "completed",
  // waiting / diálogo
  reclamo_dialogo: "waiting_user",
  incidencia_pedir_causa: "waiting_user",
  incidencia_abierta: "waiting_user",
  incidencia_fallback: "waiting_user",
  pod_fallback: "waiting_user",
  rendicion_fallback: "waiting_user",
  viajes_fallback: "waiting_user",
  esperando_correccion_o_foto: "waiting_user",
  remito_pedir_foto: "waiting_user",
  intent_clarificar: "waiting_user", // override → completed si ephemeral_qa
  // failed (canal / handler) — no auto-pop
  viajes_error: "failed",
  incidencia_error: "failed",
  rendicion_error: "failed",
  reclamo_error: "failed",
  pod_error: "failed",
};

/**
 * @typedef {object} AgentExecutionResult
 * @property {'completed'|'waiting_user'|'ongoing'|'failed'} status
 * @property {string|null} processId
 * @property {string|null} agentId
 * @property {'auto'|'manual'|'none'} resumePolicy
 * @property {string|null} [resumeTargetProcessId]
 * @property {string|null} [legacyFlow]
 * @property {object|null} [raw]
 * @property {string} version
 */

export function makeAgentExecutionResult({
  status,
  processId = null,
  agentId = null,
  resumePolicy = "none",
  resumeTargetProcessId = null,
  legacyFlow = null,
  raw = null,
}) {
  const allowedStatus = new Set(["completed", "waiting_user", "ongoing", "failed"]);
  const allowedPolicy = new Set(["auto", "manual", "none"]);
  const st = allowedStatus.has(status) ? status : "ongoing";
  const pol = allowedPolicy.has(resumePolicy) ? resumePolicy : "none";
  return {
    version: "1.1.1",
    status: st,
    processId: processId ?? null,
    agentId: agentId ?? null,
    resumePolicy: pol,
    resumeTargetProcessId: resumeTargetProcessId ?? null,
    legacyFlow: legacyFlow ?? null,
    raw: raw ?? null,
  };
}

/**
 * Adapta outcome legacy → AgentExecutionResult sin tocar lógica interna del agente.
 * Default seguro: ongoing + none (nunca auto-resume por desconocido).
 */
export function wrapLegacyAgentOutcome(out, ctx = {}) {
  const flow = out?.flow || out?.legacyFlow || null;

  // Override explícito si el handler ya adjunta contrato
  if (out?.agentExecutionResult && typeof out.agentExecutionResult === "object") {
    return makeAgentExecutionResult({
      ...out.agentExecutionResult,
      raw: out,
      legacyFlow: flow,
    });
  }

  let status = "ongoing";
  if (out?.error) status = "failed";
  else if (flow && FLOW_STATUS[flow]) status = FLOW_STATUS[flow];

  // ephemeral one-shot: una respuesta clarify cuenta como completed del hijo
  if (ctx.processType === "ephemeral_qa" && (flow === "intent_clarificar" || !flow)) {
    status = "completed";
  }

  let resumePolicy = "none";
  let resumeTargetProcessId = null;

  if (status === "completed") {
    if (
      ctx.frameResumeMode === "auto_on_child_complete" ||
      ctx.frameResumeMode === "auto_on_child_idle" ||
      ctx.processType === "ephemeral_qa"
    ) {
      resumePolicy = "auto";
      resumeTargetProcessId = ctx.parentProcessId ?? null;
    } else if (ctx.frameResumeMode === "manual_only") {
      resumePolicy = "manual";
    }
  }
  // waiting_user / ongoing / failed → nunca auto
  if (status === "waiting_user" || status === "ongoing") {
    resumePolicy = "none";
    resumeTargetProcessId = null;
  }
  if (status === "failed") {
    resumePolicy = "none";
    resumeTargetProcessId = null;
  }

  return makeAgentExecutionResult({
    status,
    processId: ctx.processId ?? out?.processId ?? null,
    agentId: ctx.agentId ?? null,
    resumePolicy,
    resumeTargetProcessId,
    legacyFlow: flow,
    raw: out ?? null,
  });
}

/**
 * ¿Debe Commander intentar auto-resume según el contrato?
 */
export function shouldAutoResumeFromResult(result) {
  if (!result || result.status !== "completed") return false;
  return result.resumePolicy === "auto";
}
