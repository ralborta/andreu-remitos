import { bootstrapAgentRegistry } from "./registry/bootstrap.mjs";
import { evaluateLegacyProcessPolicy } from "./policy/legacy-process-policy.mjs";
import { routeByIntent } from "./intent/route-by-intent.mjs";
import { finalizeDecision, logCommanderTrace } from "./trace/log-trace.mjs";
import { isCommanderV11InterruptEnabled } from "./flags.mjs";
import { clasificarIntencionWhatsApp } from "../wa-intent-router.mjs";
import {
  allowsInterrupt,
  childSpecForIntent,
  isExplicitCancelText,
  isExplicitResumeText,
  isContinuationIntent,
  expirePausedProcesses,
  ensureActiveFromDomain,
  getActiveProcess,
  pushInterrupt,
  popResume,
  cancelProcess,
  enterHumanTakeover,
  stackDepth,
  peekStackTop,
  getInterruptMaxDepth,
  resumeHintForProcessType,
} from "./interrupt/index.mjs";
import { resolveRemitoRevisionId } from "./policy/legacy-process-policy.mjs";

/**
 * Camino V1 puro (fail-safe / flag v1.1 off).
 */
async function decideV1(input) {
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

  if (texto && !hasMedia) {
    const decision = await routeByIntent({ texto, actor, log, processes });
    logCommanderTrace(log, decision, { subjectId: message.subjectId });
    return decision;
  }

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

  if (texto && hasMedia) {
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

function agentForDomainProcess(processType) {
  const map = {
    remito_revision: "remitos",
    viaje_solicitud: "viajes",
    destino_confirmacion: "destinos",
    destino_eta_chofer: "destinos",
    pod_caso: "pod",
    rendicion_gasto: "rendicion",
    incidencia: "incidencias",
    reclamo: "reclamos",
  };
  return map[processType] || "router";
}

/**
 * Asegura Process active alineado a domain sticky detectado (sin tocar Remitos).
 */
function syncActiveFromDetected(subjectId, processes, conversation) {
  const remitoId = resolveRemitoRevisionId(conversation);
  if (remitoId) {
    return ensureActiveFromDomain({
      subjectId,
      processType: "remito_revision",
      agentId: "remitos",
      domainRef: { store: "remitos", id: remitoId },
    }).process;
  }
  const first = (processes || []).find((p) => p.processType && p.processType !== "remito_revision");
  if (first?.processType) {
    return ensureActiveFromDomain({
      subjectId,
      processType: first.processType,
      agentId: first.agentId || agentForDomainProcess(first.processType),
      domainRef: first.processId ? { store: "domain", id: first.processId } : null,
    }).process;
  }
  return getActiveProcess(subjectId);
}

function executorKeyForProcessType(processType) {
  const map = {
    remito_revision: "remitos_texto",
    viaje_solicitud: "viajes_force",
    destino_confirmacion: "destinos",
    destino_eta_chofer: "destinos",
    pod_caso: "pod_force",
    rendicion_gasto: "rendicion_force",
    incidencia: "incidencias_force",
    reclamo: "reclamos_force",
    ephemeral_qa: "clarify",
  };
  return map[processType] || "remitos_texto";
}

/**
 * v1.1 path — cualquier error → decideV1 (fail-safe).
 */
async function decideV11(input) {
  const { message, actor, log, processes = [], conversation = null, intentOverride = null } = input;
  const subjectId = message.subjectId;
  const texto = String(message.text ?? "").trim();
  const hasMedia = Boolean(message.hasMedia);
  const botPaused = Boolean(conversation?.bot_pausado);

  expirePausedProcesses(subjectId);

  if (botPaused) {
    const cur = getActiveProcess(subjectId);
    if (!cur || cur.processType !== "human_takeover") {
      enterHumanTakeover({ subjectId });
    }
    const decision = finalizeDecision({
      intent: "desconocido",
      confidence: 1,
      intentSource: "policy",
      agentId: null,
      action: "noop",
      processType: "human_takeover",
      interrupt: { op: "human_takeover" },
      executorHints: { executorKey: "noop", legacyFlow: "human_takeover" },
      trace: { branch: "interrupt_policy", notes: ["human_takeover"] },
    });
    logCommanderTrace(log, decision, { subjectId, v11: true });
    return decision;
  }

  // Sync domain → orchestration active (si aún no hay)
  let active = getActiveProcess(subjectId);
  if (!active) {
    active = syncActiveFromDetected(subjectId, processes, conversation);
  }

  // Cancelación explícita — C6: “dejemos eso” cancela el proceso anterior (tope del stack) sin reanudar.
  // Si no hay stack, cancela el active. Si solo se cancela el active y queda stack → resume del tope.
  if (texto && !hasMedia && isExplicitCancelText(texto)) {
    const top = peekStackTop(subjectId);
    if (top) {
      cancelProcess({ subjectId, target: "stack_top", decisionId: null });
      const decision = finalizeDecision({
        intent: "desconocido",
        confidence: 1,
        intentSource: "policy",
        action: "cancel_process",
        interrupt: { op: "cancel", parentProcessId: top.processId, frameId: top.frameId },
        suggestedReply: "Listo, cancelamos lo anterior. Seguimos con lo actual.",
        executorHints: { executorKey: "clarify", legacyFlow: "process_cancelled" },
        trace: { branch: "interrupt_policy", notes: ["explicit_cancel_stack_top"] },
      });
      logCommanderTrace(log, decision, { subjectId, v11: true });
      return decision;
    }
    if (active) {
      cancelProcess({ subjectId, target: "active", decisionId: null });
      const after = peekStackTop(subjectId);
      if (after) {
        const popped = popResume({ subjectId, completeChild: false });
        if (popped.ok) {
          const decision = finalizeDecision({
            intent: "continue_process",
            confidence: 1,
            intentSource: "policy",
            agentId: popped.parent.agentId,
            action: "resume_process",
            processId: popped.parent.processId,
            processType: popped.parent.processType,
            processBinding: true,
            suggestedReply: popped.resumeHint,
            interrupt: {
              op: "pop",
              frameId: popped.frame.frameId,
              parentProcessId: popped.parent.processId,
            },
            executorHints: {
              executorKey: "resume_hint",
              legacyFlow: `resume_${popped.parent.processType}`,
            },
            forceAgent: true,
            trace: { branch: "interrupt_policy", notes: ["cancel_active_then_resume"] },
          });
          logCommanderTrace(log, decision, { subjectId, v11: true });
          return decision;
        }
      }
      const decision = finalizeDecision({
        intent: "desconocido",
        confidence: 1,
        intentSource: "policy",
        action: "cancel_process",
        interrupt: { op: "cancel" },
        suggestedReply: "Listo, cancelamos eso. ¿En qué te ayudo?",
        executorHints: { executorKey: "clarify", legacyFlow: "process_cancelled" },
        trace: { branch: "interrupt_policy", notes: ["explicit_cancel_active"] },
      });
      logCommanderTrace(log, decision, { subjectId, v11: true });
      return decision;
    }
  }

  // Resume manual
  if (texto && !hasMedia && isExplicitResumeText(texto) && peekStackTop(subjectId)) {
    const popped = popResume({ subjectId });
    if (popped.ok) {
      const decision = finalizeDecision({
        intent: "continue_process",
        confidence: 1,
        intentSource: "policy",
        agentId: popped.parent.agentId,
        action: "resume_process",
        processId: popped.parent.processId,
        processType: popped.parent.processType,
        processBinding: true,
        suggestedReply: popped.resumeHint,
        interrupt: {
          op: "pop",
          frameId: popped.frame.frameId,
          parentProcessId: popped.parent.processId,
          depth: popped.frame.depth,
        },
        forceAgent: true,
        executorHints: {
          executorKey: "resume_hint",
          legacyFlow: `resume_${popped.parent.processType}`,
        },
        trace: { branch: "interrupt_policy", notes: ["manual_resume"] },
      });
      logCommanderTrace(log, decision, { subjectId, v11: true });
      return decision;
    }
    // error durante resume → fail-safe sticky v1
    log?.warn?.({ err: popped.error?.message || popped.reason }, "v1.1 resume failed → V1");
    return decideV1(input);
  }

  // Media: nunca interrumpir — V1 sticky
  if (hasMedia) {
    return decideV1(input);
  }

  // Clasificar intención (override para tests; si no, mismo router H1–H14)
  let intent = intentOverride?.intent ?? null;
  let confidence = intentOverride?.confidence ?? 0;
  let intentSource = intentOverride?.fuente || intentOverride?.intentSource || "ia";
  let routerRaw = intentOverride ?? null;

  if (!intent && texto) {
    const intentResult = await clasificarIntencionWhatsApp({
      texto,
      esChoferRemitos: actor.isChoferRemitos,
      esChoferFlotaViajes: actor.isChoferFlotaViajes,
      nombre: actor.choferNombre ?? null,
      log,
    });
    intent = intentResult.intent;
    confidence = intentResult.confianza ?? 0;
    intentSource = intentResult.fuente === "heuristica" ? "heuristica" : "ia";
    routerRaw = intentResult;
  }

  active = getActiveProcess(subjectId);
  const depth = stackDepth(subjectId);
  const gate = allowsInterrupt({
    active,
    intent,
    confidence,
    stackDepth: depth,
    hasMedia,
    botPaused: false,
    maxDepth: getInterruptMaxDepth(),
  });

  if (gate.allow && active && intent) {
    const childSpec = childSpecForIntent(intent);
    if (childSpec) {
      const pushed = pushInterrupt({
        subjectId,
        parentProcess: active,
        childSpec,
        lateralIntent: intent,
        reason: depth > 0 ? "nested_interrupt" : "user_lateral_intent",
      });
      if (pushed.ok) {
        const action = intent === "chat" ? "ask_clarification" : "interrupt_and_run";
        const suggested =
          intent === "chat"
            ? routerRaw?.mensaje ||
              "Dale, te respondo eso y después retomamos lo anterior.\n\n¿Qué necesitás?"
            : null;
        const decision = finalizeDecision({
          intent,
          confidence,
          intentSource,
          agentId: childSpec.agentId,
          action,
          processId: pushed.child.processId,
          processType: pushed.child.processType,
          interruptedProcessId: active.processId,
          forceAgent: true,
          suggestedReply: suggested,
          interrupt: {
            op: "push",
            frameId: pushed.frame.frameId,
            parentProcessId: active.processId,
            childProcessId: pushed.child.processId,
            depth: pushed.frame.depth,
          },
          executorHints: {
            executorKey: childSpec.executorKey,
            legacyFlow: `interrupt_${intent}`,
          },
          trace: {
            branch: "interrupt_policy",
            routerRaw,
            notes: ["interrupt_push", gate.reason],
          },
        });
        logCommanderTrace(log, decision, { subjectId, v11: true });
        return decision;
      }
      // max_depth u otro → fall through sticky V1
    }
  }

  // Si hay active y continuation intent → sticky V1
  if (active && intent && isContinuationIntent(active.processType, intent)) {
    return decideV1(input);
  }

  // Default: LegacyProcessPolicy + router V1
  return decideV1(input);
}

/**
 * SOL Commander — único punto de decisión.
 * v1.1 solo si flag ON; errores → V1.
 *
 * @param {object} input
 * @param {object} [input.intentOverride] — solo tests
 */
export async function decide(input) {
  bootstrapAgentRegistry();

  if (!isCommanderV11InterruptEnabled()) {
    return decideV1(input);
  }

  try {
    return await decideV11(input);
  } catch (err) {
    input.log?.error?.(
      { err: err?.message || String(err) },
      "SOL Commander v1.1 error → fail-safe V1",
    );
    return decideV1(input);
  }
}

export { decideV1, resumeHintForProcessType, executorKeyForProcessType };
