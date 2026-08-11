import { randomUUID } from "node:crypto";

/**
 * @param {object} partial
 * @returns {import('./types.js').CommanderDecision}
 */
export function finalizeDecision(partial) {
  return {
    decisionId: partial.decisionId || randomUUID(),
    intent: partial.intent ?? "desconocido",
    confidence: partial.confidence ?? 0,
    intentSource: partial.intentSource ?? "policy",
    agentId: partial.agentId ?? null,
    action: partial.action ?? "noop",
    processId: partial.processId ?? null,
    processType: partial.processType ?? null,
    interruptedProcessId: partial.interruptedProcessId ?? null,
    suggestedReply: partial.suggestedReply ?? null,
    forceAgent: Boolean(partial.forceAgent),
    executorHints: partial.executorHints ?? null,
    trace: {
      branch: partial.trace?.branch ?? "legacy_process_policy",
      routerRaw: partial.trace?.routerRaw ?? null,
      notes: partial.trace?.notes ?? [],
    },
  };
}

export function logCommanderTrace(log, decision, extra = {}) {
  log?.info?.(
    {
      commander: true,
      decisionId: decision.decisionId,
      intent: decision.intent,
      intentSource: decision.intentSource,
      confidence: decision.confidence,
      agentId: decision.agentId,
      action: decision.action,
      forceAgent: decision.forceAgent,
      executorKey: decision.executorHints?.executorKey ?? null,
      branch: decision.trace?.branch,
      interruptedProcessId: decision.interruptedProcessId,
      ...extra,
    },
    "SOL Commander decision",
  );
}
