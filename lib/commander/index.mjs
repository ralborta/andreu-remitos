export { decide, decideV1 } from "./decide.mjs";
export {
  isCommanderV1Enabled,
  isCommanderShadowEnabled,
  isCommanderV11InterruptEnabled,
} from "./flags.mjs";
export { bootstrapAgentRegistry } from "./registry/bootstrap.mjs";
export { listAgents, resolveByIntent } from "./registry/agent-registry.mjs";
export { evaluateLegacyProcessPolicy, resolveRemitoRevisionId } from "./policy/legacy-process-policy.mjs";
export { finalizeDecision, logCommanderTrace } from "./trace/log-trace.mjs";
export {
  detectActiveProcesses,
  sanitizeText,
  computeParity,
  inferLegacyDecisionFromPayload,
  persistShadowTrace,
  getShadowTracePaths,
  hashSubject,
} from "./shadow-trace.mjs";
export * as interrupt from "./interrupt/index.mjs";

/**
 * Construye mensaje inbound normalizado para decide().
 */
export function buildInboundMessage({
  subjectId,
  text = null,
  hasMedia = false,
  mediaKind = null,
  displayName = null,
  location = null,
  messageId = null,
  channel = "whatsapp",
} = {}) {
  return {
    messageId: messageId || `msg_${Date.now()}`,
    channel,
    subjectId: String(subjectId || "").replace(/\D/g, ""),
    displayName: displayName ?? null,
    text: text ?? null,
    hasMedia: Boolean(hasMedia),
    mediaKind: mediaKind ?? null,
    location: location ?? null,
    receivedAt: new Date().toISOString(),
  };
}
