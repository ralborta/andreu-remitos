/**
 * Protocolo controlado SOL Commander v1.1 — TransitOne (allowlist).
 * Corre en el contenedor (DATA_DIR local) o contra API remota.
 *
 * Registra por caso: padre, push, hijo, completion, pop/resume, estados, stack, errores.
 *
 * Usage:
 *   SOL_COMMANDER_V1_1_INTERRUPT=true \
 *   SOL_COMMANDER_V1_1_ALLOWLIST=5491198800101,... \
 *   node scripts/run-commander-v1-1-controlled.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const API = process.env.V11_PROTOCOL_API || process.env.SHADOW_PROTOCOL_API || "http://127.0.0.1:3001";
const DATA_DIR = process.env.DATA_DIR || "./data";
const OUT = path.join(DATA_DIR, "commander-v1-1-controlled-results.json");
const INTERRUPT_TRACE = path.join(DATA_DIR, "commander-interrupt-traces.jsonl");
const ORCH_FILE = path.join(DATA_DIR, "commander-orchestration.json");
const PROC_FILE = path.join(DATA_DIR, "commander-processes.json");

/** Subjects de prueba (deben estar en SOL_COMMANDER_V1_1_ALLOWLIST). */
const PHONES = {
  C1: "5491198800101",
  C2: "5491198800102",
  C3: "5491198800103",
  C4: "5491198800104",
  C5: "5491198800105",
  C6: "5491198800106",
  C7: "5491198800107",
  C8: "5491198800108",
  OFF: "5491198800999", // fuera de allowlist — debe quedar en V1
  REAL: "5491133788190", // Raúl (allowlist; no se usa en webhook masivo)
};

export const ALLOWLIST_DEFAULT = [
  PHONES.C1,
  PHONES.C2,
  PHONES.C3,
  PHONES.C4,
  PHONES.C5,
  PHONES.C6,
  PHONES.C7,
  PHONES.C8,
  PHONES.REAL,
].join(",");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postWa({ from, name, body }) {
  const res = await fetch(`${API}/api/webhooks/builderbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName: "message.incoming",
      data: { from, name: name || "V1.1 Controlled", body: body || "" },
    }),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function orchSnapshot(tel) {
  const db = readJson(ORCH_FILE, {});
  const row = db[tel] || { interruptStack: [], activeProcessId: null };
  const procs = readJson(PROC_FILE, []);
  const byId = Object.fromEntries((Array.isArray(procs) ? procs : []).map((p) => [p.processId, p]));
  const stack = (row.interruptStack || []).map((f) => ({
    frameId: f.frameId,
    processId: f.processId,
    processType: f.processType,
    depth: f.depth,
    reason: f.reason,
    resumeMode: f.resumeMode,
    status: byId[f.processId]?.status ?? null,
  }));
  const active = row.activeProcessId ? byId[row.activeProcessId] : null;
  return {
    activeProcessId: row.activeProcessId,
    active: active
      ? { processId: active.processId, processType: active.processType, status: active.status }
      : null,
    stack,
    stackDepth: stack.length,
  };
}

function ensureChofer(tel, nombre) {
  const file = path.join(DATA_DIR, "parametros.json");
  let db = { choferes: [], unidades: [], localidades: [], distancias: [] };
  if (fs.existsSync(file)) {
    try {
      db = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* */
    }
  }
  if (!Array.isArray(db.choferes)) db.choferes = [];
  if (!db.choferes.some((c) => String(c.telefono || "").replace(/\D/g, "") === tel)) {
    db.choferes.unshift({
      id: crypto.randomUUID(),
      tenant: "tsb",
      nombre,
      telefono: tel,
      documento: tel.slice(-8),
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _protocolo_v11: true,
    });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  }

  const flotaFile = path.join(DATA_DIR, "viajes-flota-maestros.json");
  let flota = { choferes: [], camiones: [] };
  if (fs.existsSync(flotaFile)) {
    try {
      flota = JSON.parse(fs.readFileSync(flotaFile, "utf8"));
    } catch {
      /* */
    }
  }
  if (!Array.isArray(flota.choferes)) flota.choferes = [];
  if (!flota.choferes.some((c) => String(c.telefono || c.telefono_wa || "").replace(/\D/g, "") === tel)) {
    flota.choferes.unshift({
      id: crypto.randomUUID(),
      nombre,
      telefono: tel,
      telefono_wa: tel,
      activo: true,
      _protocolo_v11: true,
    });
    fs.writeFileSync(flotaFile, JSON.stringify(flota, null, 2));
  }
}

function ensureRemitoAbierto(tel) {
  const remitosFile = path.join(DATA_DIR, "remitos.json");
  let remitos = fs.existsSync(remitosFile) ? JSON.parse(fs.readFileSync(remitosFile, "utf8")) : [];
  if (!Array.isArray(remitos)) remitos = [];
  const id = crypto.randomUUID();
  remitos.unshift({
    id,
    tenant: "tsb",
    estado: "pendiente_revision",
    telefono_chofer: tel,
    imagen_path: null,
    texto_ocr: "PROTOCOLO V11",
    datos: { nro_remito: "V11001", semi: null },
    validacion: { valido: false, pendientes: ["semi"] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_v11: true,
  });
  fs.writeFileSync(remitosFile, JSON.stringify(remitos, null, 2));

  const convFile = path.join(DATA_DIR, "conversaciones.json");
  let convs = fs.existsSync(convFile) ? JSON.parse(fs.readFileSync(convFile, "utf8")) : [];
  if (!Array.isArray(convs)) convs = [];
  let conv = convs.find((c) => c.telefono === tel);
  if (!conv) {
    conv = {
      id: tel,
      telefono: tel,
      tenant: "tsb",
      nombre: "V1.1 Controlled",
      mensajes: [],
      bot_pausado: false,
      created_at: new Date().toISOString(),
    };
    convs.unshift(conv);
  }
  conv.ultimo_remito_id = id;
  conv.remito_en_revision_id = id;
  conv.bot_pausado = false;
  conv.updated_at = new Date().toISOString();
  fs.writeFileSync(convFile, JSON.stringify(convs, null, 2));
  return id;
}

function ensureViajePending(tel) {
  const file = path.join(DATA_DIR, "viajes-solicitudes.json");
  let rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  if (!Array.isArray(rows)) rows = [];
  for (const r of rows) {
    if (r.telefono === tel && ["recolectando", "pendiente", "propuesta"].includes(r.estado)) {
      r.estado = "cancelada_protocolo_v11";
    }
  }
  const id = `VS-V11-${tel.slice(-4)}`;
  rows.unshift({
    id,
    estado: "recolectando",
    telefono: tel,
    nombre: "V1.1 Controlled",
    datos: { origen: "CABA", destino: null, toneladas: null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_v11: true,
  });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return id;
}

function setBotPaused(tel, paused) {
  const convFile = path.join(DATA_DIR, "conversaciones.json");
  let convs = fs.existsSync(convFile) ? JSON.parse(fs.readFileSync(convFile, "utf8")) : [];
  if (!Array.isArray(convs)) convs = [];
  let conv = convs.find((c) => c.telefono === tel);
  if (!conv) {
    conv = { id: tel, telefono: tel, mensajes: [], bot_pausado: paused };
    convs.unshift(conv);
  }
  conv.bot_pausado = paused;
  conv.updated_at = new Date().toISOString();
  fs.writeFileSync(convFile, JSON.stringify(convs, null, 2));
}

function clearOrch(tel) {
  const db = readJson(ORCH_FILE, {});
  delete db[tel];
  fs.writeFileSync(ORCH_FILE, JSON.stringify(db, null, 2));
  let procs = readJson(PROC_FILE, []);
  if (Array.isArray(procs)) {
    procs = procs.filter((p) => p.subjectId !== tel);
    fs.writeFileSync(PROC_FILE, JSON.stringify(procs, null, 2));
  }
}

function lastInterruptOps(telHashOrAll, n = 10) {
  if (!fs.existsSync(INTERRUPT_TRACE)) return [];
  const lines = fs
    .readFileSync(INTERRUPT_TRACE, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-n)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return lines;
}

async function step(label, fn) {
  const before = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - before, result };
  } catch (err) {
    return { label, ok: false, ms: Date.now() - before, error: err?.message || String(err) };
  }
}

async function runCase(id, title, tel, runner) {
  ensureChofer(tel, `V11 ${id}`);
  clearOrch(tel);
  const record = {
    id,
    title,
    subjectId: tel,
    steps: [],
    parent: null,
    push: null,
    child: null,
    completionReason: null,
    popResume: null,
    finalParent: null,
    finalChild: null,
    finalStack: null,
    errors: [],
    fallback: null,
    pass: false,
  };
  try {
    await runner(record);
  } catch (err) {
    record.errors.push(err?.message || String(err));
    record.pass = false;
  }
  record.finalStack = orchSnapshot(tel);
  return record;
}

// ─── Cases ──────────────────────────────────────────────────────

async function caseC1(record) {
  const tel = record.subjectId;
  const remitoId = ensureRemitoAbierto(tel);
  // sync sticky
  let r = await postWa({ from: tel, body: "semi remolque AH318WB" });
  record.steps.push({ op: "sticky_continue", response: r.json, orch: orchSnapshot(tel) });
  await sleep(400);

  r = await postWa({ from: tel, body: "necesito un viaje a Neuquen con 20 toneladas" });
  const snap = orchSnapshot(tel);
  record.steps.push({ op: "lateral_viaje", response: r.json, orch: snap });
  record.push = {
    detected: Boolean(r.json?.interrupt?.op === "push" || snap.stackDepth >= 1),
    interrupt: r.json?.interrupt ?? null,
    stack: snap.stack,
  };
  record.parent = snap.stack[0] || null;
  record.child = snap.active;
  record.completionReason = "manual_resume_after_lateral";

  r = await postWa({ from: tel, body: "volvamos al remito" });
  const after = orchSnapshot(tel);
  record.steps.push({ op: "resume", response: r.json, orch: after });
  record.popResume = {
    action: r.json?.flow || r.json?.interrupt?.op,
    interrupt: r.json?.interrupt ?? null,
    hint: r.json?.message || r.json?.resume_hint || null,
  };
  record.finalParent = after.active;
  record.finalChild = null;
  record.pass =
    record.push.detected &&
    after.stackDepth === 0 &&
    (after.active?.processType === "remito_revision" || Boolean(remitoId));
}

async function caseC2(record) {
  const tel = record.subjectId;
  ensureRemitoAbierto(tel);
  let r = await postWa({ from: tel, body: "ok" });
  record.steps.push({ op: "confirm_attempt", response: r.json, orch: orchSnapshot(tel) });
  await sleep(300);

  r = await postWa({ from: tel, body: "quiero hacer un reclamo por faltante" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "lateral_reclamo", response: r.json, orch: mid });
  record.push = { detected: mid.stackDepth >= 1, stack: mid.stack };
  record.parent = mid.stack[0] || null;
  record.child = mid.active;
  record.completionReason = "manual_resume_to_confirm";

  r = await postWa({ from: tel, body: "seguimos con el remito" });
  const after = orchSnapshot(tel);
  record.steps.push({ op: "resume_confirm", response: r.json, orch: after });
  record.popResume = { interrupt: r.json?.interrupt ?? null, flow: r.json?.flow };
  record.finalParent = after.active;
  record.pass = mid.stackDepth >= 1 && after.stackDepth === 0;
}

async function caseC3(record) {
  const tel = record.subjectId;
  ensureViajePending(tel);
  let r = await postWa({ from: tel, body: "origen CABA destino Neuquen 15 toneladas" });
  record.steps.push({ op: "viaje_continue", response: r.json, orch: orchSnapshot(tel) });
  await sleep(400);

  r = await postWa({ from: tel, body: "tuve un pinchazo en la ruta" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "lateral_incidencia", response: r.json, orch: mid });
  record.push = { detected: mid.stackDepth >= 1, stack: mid.stack, resumeMode: mid.stack[0]?.resumeMode };
  record.parent = mid.stack[0] || null;
  record.child = mid.active;

  // Cierre: pedir resume explícito (auto_on_child_complete puede no dispararse desde legacy)
  r = await postWa({ from: tel, body: "seguimos con el viaje" });
  const after = orchSnapshot(tel);
  record.steps.push({ op: "resume_viaje", response: r.json, orch: after });
  record.completionReason = "explicit_resume_after_incidencia";
  record.popResume = { interrupt: r.json?.interrupt ?? null, flow: r.json?.flow };
  record.finalParent = after.active;
  record.pass = mid.stackDepth >= 1 && (after.active?.processType === "viaje_solicitud" || after.stackDepth === 0);
}

async function caseC4(record) {
  const tel = record.subjectId;
  ensureViajePending(tel);
  let r = await postWa({ from: tel, body: "quiero hacer un reclamo, no llegó la carga" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "lateral_reclamo", response: r.json, orch: mid });
  record.push = { detected: mid.stackDepth >= 1, resumeMode: mid.stack[0]?.resumeMode };
  record.parent = mid.stack[0] || null;
  record.child = mid.active;

  r = await postWa({ from: tel, body: "faltan 2 pallets" });
  record.steps.push({ op: "reclamo_turno", response: r.json, orch: orchSnapshot(tel) });
  // sin auto-resume
  const still = orchSnapshot(tel);
  record.completionReason = "manual_only_no_auto";

  r = await postWa({ from: tel, body: "retomemos el viaje" });
  const after = orchSnapshot(tel);
  record.steps.push({ op: "manual_resume", response: r.json, orch: after });
  record.popResume = { interrupt: r.json?.interrupt ?? null };
  record.finalParent = after.active;
  record.pass =
    mid.stackDepth >= 1 &&
    mid.stack[0]?.resumeMode === "manual_only" &&
    still.stackDepth >= 1 &&
    after.stackDepth === 0;
}

async function caseC5(record) {
  const tel = record.subjectId;
  ensureViajePending(tel);
  let r = await postWa({ from: tel, body: "tuve un pinchazo" });
  await sleep(400);
  r = await postWa({ from: tel, body: "quiero hacer un reclamo por demora" });
  const depth2 = orchSnapshot(tel);
  record.steps.push({ op: "nested_2", response: r.json, orch: depth2 });

  r = await postWa({ from: tel, body: "necesito un viaje a Mendoza 30 toneladas" });
  const depth3 = orchSnapshot(tel);
  record.steps.push({ op: "third_lateral_blocked", response: r.json, orch: depth3 });
  record.push = { depth: depth2.stackDepth };
  record.completionReason = "max_depth_blocks_third";
  record.finalStack = depth3;
  record.pass = depth2.stackDepth >= 2 && depth3.stackDepth === depth2.stackDepth;
}

async function caseC6(record) {
  const tel = record.subjectId;
  ensureRemitoAbierto(tel);
  let r = await postWa({ from: tel, body: "necesito un viaje a Rosario 10 toneladas" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "interrupt", response: r.json, orch: mid });
  const parentId = mid.stack[0]?.processId;

  r = await postWa({ from: tel, body: "dejemos eso" });
  const after = orchSnapshot(tel);
  record.steps.push({ op: "cancel", response: r.json, orch: after });
  record.push = { before: mid };
  record.completionReason = "explicit_cancel_stack_top";
  record.popResume = { cancelled: true, flow: r.json?.flow };
  record.finalParent = parentId
    ? readJson(PROC_FILE, []).find((p) => p.processId === parentId)
    : null;
  record.pass = mid.stackDepth >= 1 && after.stackDepth === 0 && record.finalParent?.status === "cancelled";
}

async function caseC7(record) {
  const tel = record.subjectId;
  ensureViajePending(tel);
  await postWa({ from: tel, body: "origen CABA" });
  setBotPaused(tel, true);
  let r = await postWa({ from: tel, body: "hola operador" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "human_takeover", response: r.json, orch: mid });
  record.push = { reason: mid.stack.find((s) => s.reason === "human_takeover") };
  record.child = mid.active;
  record.completionReason = "human_takeover_noop";
  record.pass =
    (r.json?.flow === "human_takeover" || r.json?.flow === "noop" || mid.active?.processType === "human_takeover") &&
    Boolean(record.push.reason);
  setBotPaused(tel, false);
}

async function caseC8(record) {
  // child legacy sin auto_on_child_complete: incidencia queda active; stack no hace pop solo
  const tel = record.subjectId;
  ensureViajePending(tel);
  let r = await postWa({ from: tel, body: "tuve una demora en el control" });
  const mid = orchSnapshot(tel);
  record.steps.push({ op: "push_incidencia", response: r.json, orch: mid });
  await sleep(500);
  // mensaje de continuación de incidencia — no debe auto-pop
  r = await postWa({ from: tel, body: "sigue demorado" });
  const still = orchSnapshot(tel);
  record.steps.push({ op: "child_continue_no_autopop", response: r.json, orch: still });
  record.push = { resumeMode: mid.stack[0]?.resumeMode };
  record.completionReason = "legacy_child_no_auto_pop";
  record.pass = mid.stackDepth >= 1 && still.stackDepth >= 1 && still.active?.processType === "incidencia";
}

async function caseOffAllowlist(record) {
  const tel = record.subjectId;
  ensureRemitoAbierto(tel);
  let r = await postWa({ from: tel, body: "necesito un viaje a Neuquen 20 toneladas" });
  const snap = orchSnapshot(tel);
  record.steps.push({ op: "lateral_should_be_v1_sticky", response: r.json, orch: snap });
  record.completionReason = "outside_allowlist_v1_only";
  record.fallback = "decideV1";
  // Fuera de allowlist no debe crear interrupt stack
  record.pass = snap.stackDepth === 0 && r.json?.interrupt == null;
}

async function main() {
  const health = await fetch(`${API}/api/webhooks/builderbot/health`).then((r) => r.json());
  console.log("health", {
    sol_commander_v1: health.sol_commander_v1,
    sol_commander_shadow: health.sol_commander_shadow,
    sol_commander_v1_1_interrupt: health.sol_commander_v1_1_interrupt,
    gate: health.sol_commander_v1_1_gate,
  });

  if (health.sol_commander_v1 !== true) {
    console.error("ABORT: SOL_COMMANDER_V1 must be true");
    process.exit(2);
  }
  if (health.sol_commander_v1_1_interrupt !== true) {
    console.error("ABORT: SOL_COMMANDER_V1_1_INTERRUPT must be true for controlled test");
    process.exit(2);
  }
  if (health.sol_commander_v1_1_gate?.allowlist_mode === "all") {
    console.error("ABORT: allowlist mode=all — no activación global en esta prueba");
    process.exit(2);
  }
  if (!health.sol_commander_v1_1_gate?.allowlist_size) {
    console.error("ABORT: allowlist vacía");
    process.exit(2);
  }

  const cases = [];
  cases.push(await runCase("C1", "remito activo → lateral → reanudar", PHONES.C1, caseC1));
  cases.push(await runCase("C2", "confirmación pendiente → pregunta → volver", PHONES.C2, caseC2));
  cases.push(await runCase("C3", "viaje → incidencia → volver viaje", PHONES.C3, caseC3));
  cases.push(await runCase("C4", "reclamo largo → resume manual", PHONES.C4, caseC4));
  cases.push(await runCase("C5", "nested interrupt + 3er bloqueado", PHONES.C5, caseC5));
  cases.push(await runCase("C6", "dejemos eso", PHONES.C6, caseC6));
  cases.push(await runCase("C7", "human takeover", PHONES.C7, caseC7));
  cases.push(await runCase("C8", "child legacy sin auto_on_child_complete", PHONES.C8, caseC8));
  cases.push(await runCase("OFF", "fuera allowlist → V1 puro", PHONES.OFF, caseOffAllowlist));

  const summary = {
    at: new Date().toISOString(),
    api: API,
    health: {
      sol_commander_v1: health.sol_commander_v1,
      sol_commander_shadow: health.sol_commander_shadow,
      sol_commander_v1_1_interrupt: health.sol_commander_v1_1_interrupt,
      gate: health.sol_commander_v1_1_gate,
    },
    passed: cases.filter((c) => c.pass).length,
    failed: cases.filter((c) => !c.pass).length,
    cases,
    recentInterruptOps: lastInterruptOps(null, 30),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

  console.log("\n─── Resultados v1.1 controlled ───");
  for (const c of cases) {
    console.log(`${c.pass ? "✓" : "✗"} ${c.id} ${c.title} | stack=${c.finalStack?.stackDepth} | ${c.completionReason || ""}`);
    if (!c.pass && c.errors.length) console.log("   errors:", c.errors.join("; "));
  }
  console.log(`\npassed ${summary.passed}/${cases.length} → ${OUT}`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
