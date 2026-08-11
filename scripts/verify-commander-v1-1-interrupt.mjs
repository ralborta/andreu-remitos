/**
 * Tests SOL Commander v1.1 Interrupt & Resume — C1–C8 + edge cases.
 * No activa TransitOne. Usa DATA_DIR temporal.
 *
 * Usage: node scripts/verify-commander-v1-1-interrupt.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "commander-v11-"));
process.env.DATA_DIR = TMP;
process.env.SOL_COMMANDER_V1 = "true";
process.env.SOL_COMMANDER_SHADOW = "true";
process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
process.env.SOL_COMMANDER_V1_1_MAX_DEPTH = "2";
// TTL corto para C8 / expire (override por tipo)
process.env.SOL_COMMANDER_V1_1_PAUSED_TTL_MS = String(60 * 60 * 1000); // 1h default test
process.env.SOL_COMMANDER_V1_1_TTL_REMITO_REVISION_MS = "50"; // 50ms para expire rápido

const {
  decide,
  decideV1,
  buildInboundMessage,
  bootstrapAgentRegistry,
  isCommanderV11InterruptEnabled,
  interrupt,
} = await import("../lib/commander/index.mjs");

bootstrapAgentRegistry();

const actorChofer = {
  isChoferRemitos: true,
  isChoferFlotaViajes: true,
  isChoferOperativo: true,
  choferNombre: "Test",
};

let passed = 0;
const failures = [];

function ok(name) {
  passed += 1;
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  failures.push({ name, err: err?.message || String(err) });
  console.error(`✗ ${name}:`, err?.message || err);
}

function reset() {
  interrupt.resetOrchestrationForTests();
}

function msg(subjectId, text, extra = {}) {
  return buildInboundMessage({ subjectId, text, ...extra });
}

async function decideWithIntent(subjectId, text, intent, confidence = 0.95, conversation = null) {
  return decide({
    message: msg(subjectId, text),
    actor: actorChofer,
    processes: [],
    conversation,
    log: null,
    intentOverride: { intent, confidence, fuente: "heuristica" },
  });
}

function seedActive(subjectId, processType, agentId, domainRef = null) {
  return interrupt.ensureActiveFromDomain({
    subjectId,
    processType,
    agentId,
    domainRef,
  }).process;
}

// ─── Config / flags ─────────────────────────────────────────────
{
  assert.equal(isCommanderV11InterruptEnabled(), true);
  assert.equal(interrupt.getInterruptMaxDepth(), 2);
  assert.ok(interrupt.getPausedTtlMsForProcessType("remito_revision") <= 50);
  assert.ok(interrupt.getPausedTtlMsForProcessType("viaje_solicitud") >= 1000);
  ok("config: maxDepth=2 configurable; TTL por ProcessType");
}

// ─── C1 remito → lateral chat → resume ──────────────────────────
try {
  reset();
  const sid = "5491100001001";
  const remito = seedActive(sid, "remito_revision", "remitos", {
    store: "remitos",
    id: "remito-c1",
  });
  const d1 = await decideWithIntent(sid, "una consulta rápida", "chat", 0.9);
  assert.equal(d1.action, "ask_clarification");
  assert.equal(d1.interrupt?.op, "push");
  assert.equal(interrupt.stackDepth(sid), 1);
  assert.equal(interrupt.getProcess(remito.processId).status, "paused");
  assert.equal(interrupt.getActiveProcess(sid).processType, "ephemeral_qa");

  const popped = interrupt.popResume({ subjectId: sid });
  assert.equal(popped.ok, true);
  assert.equal(popped.parent.processId, remito.processId);
  assert.match(popped.resumeHint, /remito/i);
  assert.equal(interrupt.getProcess(remito.processId).status, "active");
  assert.equal(interrupt.getProcess(remito.processId).domainRef?.id, "remito-c1");
  ok("C1 remito → chat lateral → push/pause → resume hint remito intacto");
} catch (e) {
  fail("C1", e);
}

// ─── C2 confirmación pendiente (mismo remito sticky) ────────────
try {
  reset();
  const sid = "5491100001002";
  const remito = seedActive(sid, "remito_revision", "remitos", {
    store: "remitos",
    id: "remito-c2",
  });
  const d1 = await decideWithIntent(sid, "necesito un viaje", "viaje", 0.95);
  assert.equal(d1.interrupt?.op, "push");
  assert.equal(d1.processType, "viaje_solicitud");

  const d2 = await decideWithIntent(sid, "volvamos al remito", "viaje", 0.5);
  assert.equal(d2.action, "resume_process");
  assert.equal(d2.processType, "remito_revision");
  assert.equal(d2.executorHints.executorKey, "resume_hint");
  assert.match(d2.suggestedReply || "", /remito|OK/i);
  assert.equal(interrupt.getActiveProcess(sid).processId, remito.processId);
  ok("C2 remito confirmación → lateral viaje → resume manual hint remito");
} catch (e) {
  fail("C2", e);
}

// ─── C3 viaje → incidencia → auto resume ────────────────────────
try {
  reset();
  const sid = "5491100001003";
  const viaje = seedActive(sid, "viaje_solicitud", "viajes");
  const d1 = await decideWithIntent(sid, "tuve un pinchazo", "incidencia", 0.95);
  assert.equal(d1.interrupt?.op, "push");
  assert.equal(d1.processType, "incidencia");
  assert.equal(interrupt.peekStackTop(sid).resumeMode, "auto_on_child_complete");

  const auto = interrupt.tryAutoResumeAfterChildComplete({ subjectId: sid });
  assert.equal(auto.ok, true);
  assert.equal(auto.parent.processId, viaje.processId);
  assert.match(auto.resumeHint, /viaje/i);
  assert.equal(interrupt.getActiveProcess(sid).processType, "viaje_solicitud");
  ok("C3 viaje → incidencia → auto_on_child_complete → resume viaje");
} catch (e) {
  fail("C3", e);
}

// ─── C4 reclamo manual_only ─────────────────────────────────────
try {
  reset();
  const sid = "5491100001004";
  const viaje = seedActive(sid, "viaje_solicitud", "viajes");
  const d1 = await decideWithIntent(sid, "quiero hacer un reclamo", "reclamo", 0.95);
  assert.equal(d1.processType, "reclamo");
  assert.equal(interrupt.peekStackTop(sid).resumeMode, "manual_only");

  const noAuto = interrupt.tryAutoResumeAfterChildComplete({ subjectId: sid });
  assert.equal(noAuto.ok, false);
  assert.equal(noAuto.reason, "resume_mode_not_auto");

  const d2 = await decideWithIntent(sid, "seguimos con el viaje", "chat", 0.5);
  assert.equal(d2.action, "resume_process");
  assert.equal(d2.processId, viaje.processId);
  ok("C4 reclamo resumeMode=manual_only; resume explícito");
} catch (e) {
  fail("C4", e);
}

// ─── C5 nested + tercer nivel ───────────────────────────────────
try {
  reset();
  const sid = "5491100001005";
  seedActive(sid, "viaje_solicitud", "viajes");
  const d1 = await decideWithIntent(sid, "incidencia", "incidencia", 0.95);
  assert.equal(d1.interrupt?.op, "push");
  assert.equal(interrupt.stackDepth(sid), 1);

  const d2 = await decideWithIntent(sid, "reclamo", "reclamo", 0.95);
  assert.equal(d2.interrupt?.op, "push");
  assert.equal(interrupt.stackDepth(sid), 2);
  assert.equal(interrupt.getActiveProcess(sid).processType, "reclamo");

  // Tercer nivel: no push
  const d3 = await decideWithIntent(sid, "necesito un viaje nuevo", "viaje", 0.95);
  assert.notEqual(d3.interrupt?.op, "push");
  assert.equal(interrupt.stackDepth(sid), 2);
  ok("C5 nested depth=2; tercer lateral no push");
} catch (e) {
  fail("C5", e);
}

// Nested interrupt hasta profundidad máxima (API directa)
try {
  reset();
  const sid = "5491100001505";
  const p0 = seedActive(sid, "viaje_solicitud", "viajes");
  const push1 = interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
    lateralIntent: "incidencia",
  });
  assert.equal(push1.ok, true);
  const push2 = interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("reclamo"),
    lateralIntent: "reclamo",
  });
  assert.equal(push2.ok, true);
  const push3 = interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("pod"),
    lateralIntent: "pod",
  });
  assert.equal(push3.ok, false);
  assert.equal(push3.reason, "max_depth");
  assert.equal(interrupt.getProcess(p0.processId).status, "paused");
  ok("nested interrupt hasta maxDepth; intento 3er nivel → max_depth");
} catch (e) {
  fail("nested maxDepth", e);
}

// ─── C6 cancelación explícita ───────────────────────────────────
try {
  reset();
  const sid = "5491100001006";
  const remito = seedActive(sid, "remito_revision", "remitos");
  await decideWithIntent(sid, "viaje", "viaje", 0.95);
  assert.equal(interrupt.stackDepth(sid), 1);

  const dCancel = await decideWithIntent(sid, "dejemos eso", "viaje", 0.5);
  assert.equal(dCancel.action, "cancel_process");
  assert.equal(dCancel.interrupt?.op, "cancel");
  assert.equal(interrupt.getProcess(remito.processId).status, "cancelled");
  assert.equal(interrupt.stackDepth(sid), 0);
  // viaje active sigue
  assert.equal(interrupt.getActiveProcess(sid)?.processType, "viaje_solicitud");
  ok("C6 dejemos eso cancela padre en stack sin resume");
} catch (e) {
  fail("C6", e);
}

// Cancelación explícita API
try {
  reset();
  const sid = "5491100001606";
  seedActive(sid, "viaje_solicitud", "viajes");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const childId = interrupt.getActiveProcess(sid).processId;
  interrupt.cancelProcess({ subjectId: sid, target: "active" });
  assert.equal(interrupt.getProcess(childId).status, "cancelled");
  ok("cancelación explícita active → cancelled (no destruido)");
} catch (e) {
  fail("cancel API", e);
}

// ─── C7 human takeover ──────────────────────────────────────────
try {
  reset();
  const sid = "5491100001007";
  const viaje = seedActive(sid, "viaje_solicitud", "viajes");
  const d1 = await decide({
    message: msg(sid, "hola"),
    actor: actorChofer,
    processes: [],
    conversation: { bot_pausado: true },
    log: null,
    intentOverride: { intent: "chat", confidence: 0.99 },
  });
  assert.equal(d1.action, "noop");
  assert.equal(d1.processType, "human_takeover");
  assert.equal(d1.interrupt?.op, "human_takeover");
  assert.equal(interrupt.getProcess(viaje.processId).status, "paused");
  assert.equal(interrupt.peekStackTop(sid)?.reason, "human_takeover");

  // Segundo mensaje: no duplica human_takeover
  const before = interrupt.listSubjectProcesses(sid).filter((p) => p.processType === "human_takeover");
  await decide({
    message: msg(sid, "otro"),
    actor: actorChofer,
    processes: [],
    conversation: { bot_pausado: true },
    log: null,
  });
  const after = interrupt.listSubjectProcesses(sid).filter((p) => p.processType === "human_takeover");
  assert.equal(after.length, before.length);
  ok("C7 human takeover: pause + noop; idempotente");
} catch (e) {
  fail("C7", e);
}

// ─── C8 expire TTL ──────────────────────────────────────────────
try {
  reset();
  const sid = "5491100001008";
  const remito = seedActive(sid, "remito_revision", "remitos");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("viaje"),
    lateralIntent: "viaje",
  });
  assert.equal(interrupt.getProcess(remito.processId).status, "paused");

  // Esperar TTL remito (50ms)
  await new Promise((r) => setTimeout(r, 80));
  const exp = interrupt.expirePausedProcesses(sid);
  assert.ok(exp.expired.length >= 1);
  assert.equal(interrupt.getProcess(remito.processId).status, "expired");
  assert.equal(interrupt.stackDepth(sid), 0);

  const resume = interrupt.popResume({ subjectId: sid });
  assert.equal(resume.ok, false);
  ok("C8 expire TTL paused → expired; no auto-resume");
} catch (e) {
  fail("C8", e);
}

// ─── Error durante resume → fail-safe V1 ─────────────────────────
try {
  reset();
  const sid = "5491100001009";
  seedActive(sid, "viaje_solicitud", "viajes");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  // Corromper padre: expired en store pero frame aún en stack (simula race)
  const top = interrupt.peekStackTop(sid);
  const parent = interrupt.getProcess(top.processId);
  interrupt.upsertProcess({ ...parent, status: "expired" });

  const d = await decideWithIntent(sid, "retomemos", "chat", 0.5);
  // pop falla → decideV1 (sticky/router), no resume_process
  assert.notEqual(d.action, "resume_process");
  ok("error durante resume → fail-safe V1 (no resume_process)");
} catch (e) {
  fail("resume error", e);
}

// ─── Restart / persistencia ─────────────────────────────────────
try {
  reset();
  const sid = "5491100001010";
  const p0 = seedActive(sid, "viaje_solicitud", "viajes");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const orchBefore = interrupt.getOrchestration(sid);
  assert.equal(orchBefore.interruptStack.length, 1);

  const paths = interrupt.getOrchestrationPaths();
  assert.ok(fs.existsSync(paths.ORCH_FILE));
  assert.ok(fs.existsSync(paths.PROCESS_FILE));

  // Simular restart: re-leer desde disco (mismo módulo, files intactos)
  const orchAfter = interrupt.getOrchestration(sid);
  assert.equal(orchAfter.interruptStack.length, 1);
  assert.equal(orchAfter.interruptStack[0].processId, p0.processId);
  assert.equal(interrupt.getProcess(p0.processId).status, "paused");
  assert.equal(interrupt.getActiveProcess(sid).processType, "incidencia");

  // Re-import path check: JSON roundtrip
  const raw = JSON.parse(fs.readFileSync(paths.ORCH_FILE, "utf8"));
  assert.equal(raw[sid].interruptStack.length, 1);
  ok("restart/persistencia: stack + processes en JSON sobreviven relectura");
} catch (e) {
  fail("restart persistencia", e);
}

// ─── Parity V1 con flag OFF ─────────────────────────────────────
try {
  reset();
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "false";
  assert.equal(isCommanderV11InterruptEnabled(), false);

  const sid = "5491100001011";
  const conversation = { remito_en_revision_id: "r-parity" };
  const message = msg(sid, "ok confirmo");
  const input = {
    message,
    actor: actorChofer,
    processes: [{ processType: "remito_revision", processId: "r-parity", agentId: "remitos" }],
    conversation,
    log: null,
  };

  const v1 = await decideV1(input);
  const viaFlag = await decide(input);
  assert.equal(viaFlag.action, v1.action);
  assert.equal(viaFlag.agentId, v1.agentId);
  assert.equal(viaFlag.executorHints?.executorKey, v1.executorHints?.executorKey);
  assert.equal(viaFlag.interrupt ?? null, null);
  assert.equal(interrupt.stackDepth(sid), 0);

  // Re-enable for leftover assertions
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
  ok("rollback: SOL_COMMANDER_V1_1_INTERRUPT=false → parity decideV1");
} catch (e) {
  process.env.SOL_COMMANDER_V1_1_INTERRUPT = "true";
  fail("parity flag OFF", e);
}

// ─── Traces de transiciones ─────────────────────────────────────
try {
  reset();
  const sid = "5491100001012";
  seedActive(sid, "remito_revision", "remitos");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("viaje"),
  });
  interrupt.popResume({ subjectId: sid });
  const tracePath = interrupt.getInterruptTracePath();
  assert.ok(fs.existsSync(tracePath));
  const lines = fs.readFileSync(tracePath, "utf8").trim().split("\n").filter(Boolean);
  assert.ok(lines.length >= 2);
  const ops = lines.map((l) => JSON.parse(l).op);
  assert.ok(ops.includes("push"));
  assert.ok(ops.includes("pop"));
  ok("traces push/pop persistidos");
} catch (e) {
  fail("traces", e);
}

// ─── Un solo active ─────────────────────────────────────────────
try {
  reset();
  const sid = "5491100001013";
  seedActive(sid, "viaje_solicitud", "viajes");
  interrupt.pushInterrupt({
    subjectId: sid,
    parentProcess: interrupt.getActiveProcess(sid),
    childSpec: interrupt.childSpecForIntent("incidencia"),
  });
  const actives = interrupt.listSubjectProcesses(sid).filter((p) => p.status === "active");
  assert.equal(actives.length, 1);
  ok("invariant: un solo Process active por conversación");
} catch (e) {
  fail("single active", e);
}

console.log("\n─── Resumen ───");
console.log(`DATA_DIR temp: ${TMP}`);
console.log(`passed: ${passed}, failed: ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.error(`  - ${f.name}: ${f.err}`);
  process.exit(1);
}
console.log("ALL OK — C1–C8 + nested/expire/cancel/resume-error/human/restart/rollback");
process.exit(0);
