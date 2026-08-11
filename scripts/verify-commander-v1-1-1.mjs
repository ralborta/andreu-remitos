/**
 * Tests unitarios SOL Commander v1.1.1 — resume semántico + AgentExecutionResult.
 * Usage: node scripts/verify-commander-v1-1-1.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "commander-v111-"));
process.env.DATA_DIR = TMP;
process.env.SOL_COMMANDER_V1 = "true";
process.env.SOL_COMMANDER_SHADOW = "true";
process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
process.env.SOL_COMMANDER_V1_1_ALLOWLIST = "*"; // unitarios: all subjects
process.env.SOL_COMMANDER_V1_1_MAX_DEPTH = "2";

const {
  decide,
  decideV1,
  buildInboundMessage,
  bootstrapAgentRegistry,
  interrupt,
} = await import("../lib/commander/index.mjs");
const {
  makeAgentExecutionResult,
  wrapLegacyAgentOutcome,
  shouldAutoResumeFromResult,
} = await import("../lib/commander/agent-execution-result.mjs");

bootstrapAgentRegistry();

const actor = {
  isChoferRemitos: true,
  isChoferFlotaViajes: true,
  isChoferOperativo: true,
  choferNombre: "T",
};

let passed = 0;
const failures = [];
function ok(n) {
  passed += 1;
  console.log(`✓ ${n}`);
}
function fail(n, e) {
  failures.push(n);
  console.error(`✗ ${n}`, e?.message || e);
}
function reset() {
  interrupt.resetOrchestrationForTests();
}
function msg(sid, text) {
  return buildInboundMessage({ subjectId: sid, text });
}

// ─── AgentExecutionResult contrato ──────────────────────────────
{
  const r = makeAgentExecutionResult({
    status: "completed",
    processId: "p1",
    agentId: "viajes",
    resumePolicy: "auto",
    resumeTargetProcessId: "p0",
  });
  assert.equal(r.version, "1.1.1");
  assert.equal(shouldAutoResumeFromResult(r), true);
  const wait = wrapLegacyAgentOutcome(
    { flow: "reclamo_dialogo" },
    { processType: "reclamo", frameResumeMode: "manual_only" },
  );
  assert.equal(wait.status, "waiting_user");
  assert.equal(wait.resumePolicy, "none");
  assert.equal(shouldAutoResumeFromResult(wait), false);
  const failR = wrapLegacyAgentOutcome(
    { flow: "incidencia_error", error: "x" },
    { processType: "incidencia", frameResumeMode: "auto_on_child_complete", parentProcessId: "p0" },
  );
  assert.equal(failR.status, "failed");
  assert.equal(failR.resumePolicy, "none");
  const auto = wrapLegacyAgentOutcome(
    { flow: "intent_clarificar" },
    {
      processType: "ephemeral_qa",
      frameResumeMode: "auto_on_child_idle",
      parentProcessId: "p0",
    },
  );
  assert.equal(auto.status, "completed");
  assert.equal(auto.resumePolicy, "auto");
  ok("AgentExecutionResult: completed/waiting/failed + no auto on waiting");
}

// ─── resume_top ─────────────────────────────────────────────────
try {
  reset();
  const sid = "5491100002001";
  const p0 = interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  }).process;
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const r = interrupt.resumeTop({ subjectId: sid });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "resume_top");
  assert.equal(interrupt.getActiveProcess(sid).processId, p0.processId);
  assert.equal(interrupt.stackDepth(sid), 0);
  ok("resume_top: un solo pop");
} catch (e) {
  fail("resume_top", e);
}

// ─── resume_parent + resume_until nested ────────────────────────
try {
  reset();
  const sid = "5491100002002";
  const viaje = interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  }).process;
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const incid = interrupt.getActiveProcess(sid);
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: incid,
    childSpec: interrupt.childSpecForIntent("reclamo"),
  });
  assert.equal(interrupt.stackDepth(sid), 2);

  // resume_parent → incidencia (padre inmediato del reclamo)
  const rp = interrupt.resumeParent({ subjectId: sid });
  assert.equal(rp.ok, true);
  assert.equal(interrupt.getActiveProcess(sid).processType, "incidencia");
  assert.equal(interrupt.stackDepth(sid), 1);

  // resume_until(viaje) → padre original
  const ru = interrupt.resumeUntil({ subjectId: sid, processId: viaje.processId });
  assert.equal(ru.ok, true);
  assert.equal(ru.mode, "resume_until");
  assert.equal(interrupt.getActiveProcess(sid).processId, viaje.processId);
  assert.equal(interrupt.stackDepth(sid), 0);
  assert.ok((ru.pops || []).length >= 1);
  ok("resume_parent + resume_until al padre original");
} catch (e) {
  fail("resume_parent/until", e);
}

// ─── resumeTarget inexistente ───────────────────────────────────
try {
  reset();
  const sid = "5491100002003";
  interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  });
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("reclamo"),
  });
  const before = interrupt.stackDepth(sid);
  const bad = interrupt.resumeUntil({ subjectId: sid, processId: "no-existe-uuid" });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "process_not_found");
  assert.equal(interrupt.stackDepth(sid), before);
  ok("resumeTargetProcessId inexistente → reject, stack intacto");
} catch (e) {
  fail("resumeTarget missing", e);
}

// ─── child completed auto / waiting no pop / failed no pop ──────
try {
  reset();
  const sid = "5491100002004";
  const viaje = interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  }).process;
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const autoRes = interrupt.applyResumeFromExecutionResult({
    subjectId: sid,
    result: makeAgentExecutionResult({
      status: "completed",
      processId: interrupt.getActiveProcess(sid).processId,
      agentId: "incidencias",
      resumePolicy: "auto",
      resumeTargetProcessId: viaje.processId,
    }),
  });
  assert.equal(autoRes.ok, true);
  assert.equal(interrupt.getActiveProcess(sid).processId, viaje.processId);
  ok("child completed + resumePolicy=auto → resume");

  reset();
  interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  });
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("reclamo"),
  });
  const depth = interrupt.stackDepth(sid);
  const noPop = interrupt.applyResumeFromExecutionResult({
    subjectId: sid,
    result: makeAgentExecutionResult({
      status: "waiting_user",
      processId: interrupt.getActiveProcess(sid).processId,
      agentId: "reclamos",
      resumePolicy: "none",
    }),
  });
  assert.equal(noPop.ok, false);
  assert.equal(interrupt.stackDepth(sid), depth);
  ok("waiting_user → sin pop");

  const failed = interrupt.applyResumeFromExecutionResult({
    subjectId: sid,
    result: makeAgentExecutionResult({
      status: "failed",
      processId: interrupt.getActiveProcess(sid).processId,
      agentId: "reclamos",
      resumePolicy: "auto", // ignored
    }),
  });
  assert.equal(failed.ok, false);
  assert.equal(interrupt.stackDepth(sid), depth);
  // mark failed path
  const marked = interrupt.markActiveFailedNoPop({ subjectId: sid });
  assert.equal(marked.ok, true);
  assert.equal(interrupt.getProcess(marked.process.processId).status, "failed");
  assert.equal(interrupt.stackDepth(sid), depth);
  ok("failed → sin pop destructivo; status=failed");
} catch (e) {
  fail("auto/waiting/failed", e);
}

// ─── decide resume_until via resumeTargetProcessId ──────────────
try {
  reset();
  const sid = "5491100002005";
  const viaje = interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  }).process;
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("reclamo"),
  });
  const d = await decide({
    message: msg(sid, "retomemos"),
    actor,
    processes: [],
    conversation: null,
    log: null,
    resumeTargetProcessId: viaje.processId,
  });
  assert.equal(d.action, "resume_process");
  assert.equal(d.processId, viaje.processId);
  assert.equal(interrupt.stackDepth(sid), 0);
  ok("decide + resumeTargetProcessId → padre original");
} catch (e) {
  fail("decide resumeUntil", e);
}

// ─── restart persistencia stack anidado ─────────────────────────
try {
  reset();
  const sid = "5491100002006";
  interrupt.ensureActiveFromDomain({
    subjectId: sid,
    processType: "viaje_solicitud",
    agentId: "viajes",
  });
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("reclamo"),
  });
  const paths = interrupt.getOrchestrationPaths();
  const raw = JSON.parse(fs.readFileSync(paths.ORCH_FILE, "utf8"));
  assert.equal(raw[sid].interruptStack.length, 2);
  const again = interrupt.getOrchestration(sid);
  assert.equal(again.interruptStack.length, 2);
  ok("restart: stack anidado persistido en JSON");
} catch (e) {
  fail("restart nested", e);
}

// ─── flag OFF parity ────────────────────────────────────────────
try {
  reset();
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "false";
  const sid = "5491100002007";
  const input = {
    message: msg(sid, "ok"),
    actor,
    processes: [],
    conversation: { remito_en_revision_id: "r1" },
    log: null,
  };
  const a = await decideV1(input);
  const b = await decide(input);
  assert.equal(a.action, b.action);
  assert.equal(a.executorHints?.executorKey, b.executorHints?.executorKey);
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
  ok("parity V1 con interrupt OFF");
} catch (e) {
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
  fail("parity", e);
}

console.log(`\npassed ${passed}, failed ${failures.length}`);
process.exit(failures.length ? 1 : 0);
