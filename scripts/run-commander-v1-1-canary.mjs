/**
 * Canary real v1.1.1 — TransitOne (allowlist mínima).
 * Subject por defecto: Raúl (5491133788190).
 *
 * Usage (contenedor):
 *   DATA_DIR=/app/backend/data V11_CANARY_API=http://127.0.0.1:3001 \
 *   node scripts/run-commander-v1-1-canary.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const API = process.env.V11_CANARY_API || process.env.V11_PROTOCOL_API || "http://127.0.0.1:3001";
const DATA_DIR = process.env.DATA_DIR || "./data";
const SUBJECT = String(process.env.V11_CANARY_SUBJECT || "5491133788190").replace(/\D/g, "");
const OUT = path.join(DATA_DIR, "commander-v1-1-canary-results.json");
const TRACE = path.join(DATA_DIR, "commander-interrupt-traces.jsonl");
const ORCH = path.join(DATA_DIR, "commander-orchestration.json");
const PROCS = path.join(DATA_DIR, "commander-processes.json");

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function readJson(f, fb) {
  try {
    if (!fs.existsSync(f)) return fb;
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return fb;
  }
}

function writeJson(f, d) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
}

async function postWa(body, ms = 40000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(`${API}/api/webhooks/builderbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "message.incoming",
        data: { from: SUBJECT, name: "Canary Real", body },
      }),
      signal: ac.signal,
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: String(text).slice(0, 200) };
    }
    return { status: res.status, ms: Date.now() - t0, json };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, json: { error: e.message }, aborted: true };
  } finally {
    clearTimeout(t);
  }
}

function orchSnap() {
  const db = readJson(ORCH, {});
  const row = db[SUBJECT] || { interruptStack: [], activeProcessId: null };
  const procs = readJson(PROCS, []);
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
      ? {
          processId: active.processId,
          processType: active.processType,
          status: active.status,
          lastExecutionStatus: active.lastExecutionStatus ?? null,
        }
      : null,
    stack,
    stackDepth: stack.length,
    pausedCount: (Array.isArray(procs) ? procs : []).filter(
      (p) => p.subjectId === SUBJECT && p.status === "paused",
    ).length,
  };
}

function ensureChofer() {
  const file = path.join(DATA_DIR, "parametros.json");
  const db = readJson(file, { choferes: [] });
  if (!Array.isArray(db.choferes)) db.choferes = [];
  if (!db.choferes.some((c) => String(c.telefono || "").replace(/\D/g, "") === SUBJECT)) {
    db.choferes.unshift({
      id: crypto.randomUUID(),
      tenant: "tsb",
      nombre: "Raúl Alborta",
      telefono: SUBJECT,
      activo: true,
      _canary_v11: true,
    });
    writeJson(file, db);
  }
  const flotaFile = path.join(DATA_DIR, "viajes-flota-maestros.json");
  const flota = readJson(flotaFile, { choferes: [] });
  if (!Array.isArray(flota.choferes)) flota.choferes = [];
  if (!flota.choferes.some((c) => String(c.telefono || "").replace(/\D/g, "") === SUBJECT)) {
    flota.choferes.unshift({
      id: crypto.randomUUID(),
      nombre: "Raúl Alborta",
      telefono: SUBJECT,
      telefono_wa: SUBJECT,
      activo: true,
      _canary_v11: true,
    });
    writeJson(flotaFile, flota);
  }
}

function ensureViaje() {
  const file = path.join(DATA_DIR, "viajes-solicitudes.json");
  const rows = readJson(file, []);
  for (const r of rows) {
    if (r.telefono === SUBJECT && ["recolectando", "pendiente", "propuesta"].includes(r.estado)) {
      r.estado = "cancelada_canary";
    }
  }
  const id = `VS-CANARY-${SUBJECT.slice(-4)}`;
  rows.unshift({
    id,
    estado: "recolectando",
    telefono: SUBJECT,
    nombre: "Canary Real",
    datos: { origen: "CABA", destino: null, toneladas: null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _canary_v11: true,
  });
  writeJson(file, rows);
  return id;
}

function clearOrch() {
  const db = readJson(ORCH, {});
  delete db[SUBJECT];
  writeJson(ORCH, db);
  const procs = readJson(PROCS, []).filter((p) => p.subjectId !== SUBJECT);
  writeJson(PROCS, procs);
}

function traceSince(isoFrom) {
  if (!fs.existsSync(TRACE)) return [];
  const from = isoFrom ? new Date(isoFrom).getTime() : 0;
  return fs
    .readFileSync(TRACE, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((r) => r && new Date(r.at).getTime() >= from);
}

function countOps(rows) {
  const c = {};
  for (const r of rows) {
    c[r.op] = (c[r.op] || 0) + 1;
  }
  return c;
}

async function main() {
  const startedAt = new Date().toISOString();
  const health = await fetch(`${API}/api/webhooks/builderbot/health`).then((r) => r.json());
  log("health", JSON.stringify(health.sol_commander_v1_1_gate || {}));

  if (health.sol_commander_v1 !== true || health.sol_commander_v1_1_interrupt !== true) {
    console.error("ABORT: flags V1/V1.1 required");
    process.exit(2);
  }
  if (health.sol_commander_v1_1_gate?.allowlist_mode === "all") {
    console.error("ABORT: allowlist global — canary requiere mode=list");
    process.exit(2);
  }
  if (health.sol_commander_v1_1_gate?.allowlist_size !== 1) {
    log(
      "WARN allowlist_size=",
      health.sol_commander_v1_1_gate?.allowlist_size,
      "(esperado 1 para canary mínimo)",
    );
  }

  ensureChofer();
  clearOrch();
  const mod = await import("/app/lib/commander/interrupt/index.mjs");

  const observations = [];
  const cases = [];

  function note(name, data) {
    observations.push({ at: new Date().toISOString(), name, ...data });
    log("OBS", name, JSON.stringify(data));
  }

  // ── K1: activo → lateral → resume ─────────────────────────────
  {
    const id = "K1";
    ensureViaje();
    const viaje = mod.ensureActiveFromDomain({
      subjectId: SUBJECT,
      processType: "viaje_solicitud",
      agentId: "viajes",
    }).process;
    const r1 = await postWa("tuve un pinchazo en la ruta");
    const mid = orchSnap();
    const r2 = await postWa("seguimos con el viaje");
    const after = orchSnap();
    const pass =
      mid.stackDepth >= 1 &&
      after.stackDepth === 0 &&
      (after.active?.processType === "viaje_solicitud" || after.active?.processId === viaje.processId);
    cases.push({
      id,
      title: "activo → lateral → resume",
      pass,
      mid,
      after,
      flows: [r1.json?.flow, r2.json?.flow],
      interrupt: [r1.json?.interrupt, r2.json?.interrupt],
    });
    note("K1", { pass, stackMid: mid.stackDepth, stackAfter: after.stackDepth });
  }

  // ── K2: nested interrupt ──────────────────────────────────────
  {
    const id = "K2";
    clearOrch();
    ensureViaje();
    mod.ensureActiveFromDomain({
      subjectId: SUBJECT,
      processType: "viaje_solicitud",
      agentId: "viajes",
    });
    await postWa("tuve un pinchazo");
    const d1 = orchSnap();
    await postWa("quiero hacer un reclamo por demora");
    const d2 = orchSnap();
    const pass = d1.stackDepth >= 1 && d2.stackDepth >= 2;
    cases.push({ id, title: "nested interrupt", pass, d1, d2 });
    note("K2", { pass, d1: d1.stackDepth, d2: d2.stackDepth, active: d2.active?.processType });
  }

  // ── K3: error hijo sin perder binding + waiting sin pop ─────
  {
    const id = "K3";
    // Usa stack de K2 si quedó; si no, arma nested mínimo
    let snap = orchSnap();
    if (snap.stackDepth < 1) {
      clearOrch();
      ensureViaje();
      mod.ensureActiveFromDomain({
        subjectId: SUBJECT,
        processType: "viaje_solicitud",
        agentId: "viajes",
      });
      await postWa("tuve una demora en el control");
      snap = orchSnap();
    }
    const beforeActive = snap.active?.processId;
    const beforeDepth = snap.stackDepth;
    // Simula / fuerza failed binding-safe
    const marked = mod.markActiveFailedNoPop({ subjectId: SUBJECT });
    const afterFail = orchSnap();
    const waiting = mod.applyResumeFromExecutionResult({
      subjectId: SUBJECT,
      result: {
        version: "1.1.1",
        status: "waiting_user",
        processId: afterFail.active?.processId,
        agentId: afterFail.active?.processType,
        resumePolicy: "none",
      },
    });
    const afterWait = orchSnap();
    const pass =
      marked.ok &&
      afterFail.active?.processId === beforeActive &&
      afterFail.active?.status === "active" &&
      afterFail.active?.lastExecutionStatus === "failed" &&
      !waiting.ok &&
      afterWait.stackDepth === beforeDepth;
    cases.push({
      id,
      title: "error hijo sin perder binding + waiting sin pop",
      pass,
      beforeDepth,
      afterFail,
      waitingOk: waiting.ok,
    });
    note("K3", {
      pass,
      lastExecutionStatus: afterFail.active?.lastExecutionStatus,
      bindingKept: afterFail.active?.processId === beforeActive,
      waitingNoPop: !waiting.ok,
    });
  }

  // ── K4: restart entre interrupción y resume ───────────────────
  {
    const id = "K4";
    clearOrch();
    ensureViaje();
    const viaje = mod.ensureActiveFromDomain({
      subjectId: SUBJECT,
      processType: "viaje_solicitud",
      agentId: "viajes",
    }).process;
    await postWa("quiero hacer un reclamo, no llegó la carga");
    const beforeRestart = orchSnap();
    // Persistencia = “restart”: re-leer disco
    const afterReload = mod.getOrchestration(SUBJECT);
    const until = mod.resumeUntil({
      subjectId: SUBJECT,
      processId: viaje.processId,
      reason: "canary_resume_after_persist_reload",
    });
    const after = orchSnap();
    const pass =
      beforeRestart.stackDepth >= 1 &&
      afterReload.interruptStack?.length >= 1 &&
      until.ok &&
      after.stackDepth === 0 &&
      after.active?.processId === viaje.processId;
    cases.push({
      id,
      title: "restart/persist entre interrupt y resume",
      pass,
      beforeRestart,
      after,
      pops: until.pops?.length,
    });
    note("K4", { pass, persistedDepth: afterReload.interruptStack?.length, resumed: until.ok });
  }

  // ── K5: cancelación explícita ─────────────────────────────────
  {
    const id = "K5";
    clearOrch();
    ensureViaje();
    mod.ensureActiveFromDomain({
      subjectId: SUBJECT,
      processType: "viaje_solicitud",
      agentId: "viajes",
    });
    await postWa("necesito un viaje a Rosario 10 toneladas"); // puede no push si ya viaje
    // forzar lateral desde remito-like: push incidencia
    const parent = mod.getActiveProcess(SUBJECT);
    if (parent) {
      mod.pushInterrupt({
        subjectId: SUBJECT,
        parentProcess: parent,
        childSpec: mod.childSpecForIntent("incidencia"),
      });
    }
    const mid = orchSnap();
    const parentId = mid.stack[0]?.processId;
    const r = await postWa("dejemos eso");
    const after = orchSnap();
    const procs = readJson(PROCS, []);
    const cancelled = procs.find((p) => p.processId === parentId);
    const pass =
      mid.stackDepth >= 1 &&
      after.stackDepth === 0 &&
      cancelled?.status === "cancelled" &&
      (r.json?.interrupt?.op === "cancel" || r.json?.flow === "process_cancelled");
    cases.push({
      id,
      title: "cancelación explícita",
      pass,
      mid,
      after,
      cancelledStatus: cancelled?.status,
      flow: r.json?.flow,
    });
    note("K5", { pass, cancelled: cancelled?.status, flow: r.json?.flow });
  }

  // ── K6: resume manual (resume_parent) ─────────────────────────
  {
    const id = "K6";
    clearOrch();
    ensureViaje();
    const viaje = mod.ensureActiveFromDomain({
      subjectId: SUBJECT,
      processType: "viaje_solicitud",
      agentId: "viajes",
    }).process;
    await postWa("tuve un pinchazo");
    const mid = orchSnap();
    const r = await postWa("retomemos");
    const after = orchSnap();
    const pass =
      mid.stackDepth >= 1 &&
      (r.json?.interrupt?.mode === "resume_parent" ||
        r.json?.interrupt?.op === "resume_parent" ||
        r.json?.flow?.startsWith?.("resume_") ||
        after.stackDepth === 0);
    cases.push({
      id,
      title: "resume manual",
      pass: pass && after.active?.processId === viaje.processId,
      mid,
      after,
      interrupt: r.json?.interrupt,
    });
    note("K6", {
      pass: pass && after.active?.processId === viaje.processId,
      mode: r.json?.interrupt?.mode || r.json?.interrupt?.op,
      active: after.active?.processType,
    });
  }

  // ── OFF: subject sintético fuera de allowlist → V1 ────────────
  {
    const id = "OFF";
    const off = "5491198800999";
    const res = await fetch(`${API}/api/webhooks/builderbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "message.incoming",
        data: { from: off, name: "Off Allowlist", body: "tuve un pinchazo" },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const offOrch = readJson(ORCH, {})[off];
    const pass = !json.interrupt && (!offOrch || (offOrch.interruptStack || []).length === 0);
    cases.push({ id, title: "fuera allowlist = V1", pass, flow: json.flow, interrupt: json.interrupt });
    note("OFF", { pass, flow: json.flow });
  }

  const traces = traceSince(startedAt);
  const ops = countOps(traces);
  const final = orchSnap();

  const summary = {
    at: new Date().toISOString(),
    startedAt,
    subjectId: SUBJECT,
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
    observations,
    traceOps: ops,
    tracesSample: traces.slice(-40).map((t) => ({
      at: t.at,
      op: t.op,
      reason: t.reason,
      depth: t.depth,
      processType: t.processType,
      error: t.error,
    })),
    finalOrch: final,
    criteria: {
      no_orphan_implied: final.stackDepth === 0 || cases.every((c) => c.id === "K2" || c.pass),
      allowlist_not_global: health.sol_commander_v1_1_gate?.allowlist_mode === "list",
      unexpected_v1_fallback: traces.some((t) => t.op === "resume_rejected"),
    },
  };

  writeJson(OUT, summary);
  log("─── CANARY SUMMARY ───");
  for (const c of cases) log(`${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.title}`);
  log("traceOps", JSON.stringify(ops));
  log(`passed ${summary.passed}/${cases.length} → ${OUT}`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
