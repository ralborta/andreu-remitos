import { bootstrapAgentRegistry } from "./registry/bootstrap.mjs";
import { evaluateLegacyProcessPolicy } from "./policy/legacy-process-policy.mjs";
import { routeByIntent } from "./intent/route-by-intent.mjs";
import { finalizeDecision, logCommanderTrace } from "./trace/log-trace.mjs";

/**
 * SOL Commander v1 — único punto de decisión.
 * Flow: Process Policy → Intent Router → Agent Registry → Decision
 *
 * @param {object} input
 * @param {object} input.message
 * @param {object} input.conversation
 * @param {object[]} [input.processes]
 * @param {object} input.actor
 * @param {object} [input.log]
 */
export async function decide(input) {
  bootstrapAgentRegistry();

  const { message, actor, log, processes = [], conversation = null } = input;

  const policy = await evaluateLegacyProcessPolicy({
    message,
    actor,
    conversation,
    log,
  });

  if (policy.handled) {
    const decision = policy.decision;
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

  const texto = String(message.text ?? "").trim();
  const hasMedia = Boolean(message.hasMedia);

  // Texto sin media (o con caption ya no sticky): Intent Router
  if (texto && !hasMedia) {
    const decision = await routeByIntent({ texto, actor, log, processes });
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

  // Ubicación sin sticky destinos
  if (message.mediaKind === "location" || message.location) {
    const decision = finalizeDecision({
      intent: "desconocido",
      confidence: 0.5,
      intentSource: "policy",
      agentId: null,
      action: "noop",
      executorHints: { executorKey: "ubicacion_sin_pendiente", legacyFlow: "ubicacion_sin_pendiente" },
      trace: { branch: "legacy_process_policy", notes: ["location_no_sticky"] },
    });
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

  if (!texto && !hasMedia) {
    const decision = finalizeDecision({
      intent: "desconocido",
      confidence: 0,
      intentSource: "policy",
      action: "noop",
      executorHints: { executorKey: "empty", legacyFlow: "empty" },
      trace: { branch: "legacy_process_policy", notes: ["empty"] },
    });
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

  // Texto + media no capturado por policy → remitos texto no aplica; default remitos_texto si solo texto falló
  if (texto && hasMedia) {
    // Caption ya evaluado en policy; si llegamos acá, seguir a remitos_ingest vía policy image default
    // Re-run shouldn't happen; safety:
    const decision = finalizeDecision({
      intent: "remito",
      confidence: 0.7,
      agentId: "remitos",
      action: "run_agent",
      executorHints: { executorKey: "remitos_ingest", legacyFlow: "foto_con_caption" },
      trace: { branch: "legacy_process_policy", notes: ["fallback_media"] },
    });
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

  // Solo texto tras policy → correcciones remito (parity final procesarTextoChofer)
  const decision = finalizeDecision({
    intent: "remito",
    confidence: 0.6,
    intentSource: "policy",
    agentId: "remitos",
    action: "run_agent",
    executorHints: { executorKey: "remitos_texto", legacyFlow: "procesar_texto_chofer" },
    trace: { branch: "intent_router", notes: ["fallback_texto"] },
  });
  logCommanderTrace(log, decision, { subjectId: message.subjectId });
  return decision;
}
