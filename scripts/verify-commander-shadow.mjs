/**
 * Simula shadow parity local (sin WhatsApp).
 * Usage: node scripts/verify-commander-shadow.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  decide,
  buildInboundMessage,
  computeParity,
  inferLegacyDecisionFromPayload,
  persistShadowTrace,
  getShadowTracePaths,
  sanitizeText,
  hashSubject,
} from "../lib/commander/index.mjs";
import { finalizeDecision } from "../lib/commander/trace/log-trace.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cmd-shadow-"));
process.env.DATA_DIR = tmp;

const actor = {
  isChoferRemitos: false,
  isChoferFlotaViajes: false,
  isChoferOperativo: false,
};

const message = buildInboundMessage({
  subjectId: "5491100112233",
  text: "necesito un viaje a neuquen 20 tn",
});
const decision = await decide({ message, actor, processes: [], log: null });

// Legacy equivalente (mismo intent)
const legacyOk = inferLegacyDecisionFromPayload({ flow: "viajes_fallback" });
const p1 = computeParity(decision, legacyOk);
assert.equal(p1.parity, true);
persistShadowTrace({
  at: new Date().toISOString(),
  shadow: true,
  messageId: message.messageId,
  decisionId: decision.decisionId,
  subjectIdHash: hashSubject(message.subjectId),
  textPreview: sanitizeText(message.text),
  activeProcesses: [],
  legacyProcessPolicy: {
    branch: decision.trace.branch,
    notes: decision.trace.notes,
    legacyFlow: decision.executorHints?.legacyFlow,
    handledByPolicy: false,
  },
  intent: decision.intent,
  confidence: decision.confidence,
  intentSource: decision.intentSource,
  agentId: decision.agentId,
  action: decision.action,
  interruptedProcessId: null,
  executorKey: decision.executorHints?.executorKey,
  legacyDecision: legacyOk,
  parity: p1.parity,
  divergences: p1.divergences,
});

// Divergencia forzada
const legacyBad = inferLegacyDecisionFromPayload({ flow: "reclamo_nuevo" });
const p2 = computeParity(decision, legacyBad);
assert.equal(p2.parity, false);
assert.ok(p2.divergences.some((d) => d.type === "intent" || d.type === "agent"));
persistShadowTrace({
  at: new Date().toISOString(),
  shadow: true,
  messageId: `${message.messageId}-div`,
  decisionId: decision.decisionId,
  subjectIdHash: hashSubject(message.subjectId),
  textPreview: sanitizeText(message.text),
  activeProcesses: [],
  legacyProcessPolicy: {
    branch: decision.trace.branch,
    notes: decision.trace.notes,
    legacyFlow: decision.executorHints?.legacyFlow,
    handledByPolicy: false,
  },
  intent: decision.intent,
  confidence: decision.confidence,
  intentSource: decision.intentSource,
  agentId: decision.agentId,
  action: decision.action,
  interruptedProcessId: null,
  executorKey: decision.executorHints?.executorKey,
  legacyDecision: legacyBad,
  parity: p2.parity,
  divergences: p2.divergences,
});

const { TRACE_FILE, SUMMARY_FILE } = getShadowTracePaths();
assert.ok(fs.existsSync(TRACE_FILE));
const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, "utf8"));
assert.equal(summary.total_traces, 2);
assert.equal(summary.parity_true, 1);
assert.equal(summary.parity_false, 1);
assert.ok(sanitizeText("llama al 5492615990813 ya").includes("[digits]"));
assert.ok(!String(summary.recent?.[0]?.textPreview || "").includes("549261"));

console.log("✓ shadow parity OK / diverge detectado");
console.log("summary", JSON.stringify(summary, null, 2));
fs.rmSync(tmp, { recursive: true, force: true });

// sanity finalizeDecision export
assert.ok(finalizeDecision({ intent: "chat", action: "noop" }).decisionId);
