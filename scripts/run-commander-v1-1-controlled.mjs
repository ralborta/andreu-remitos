/**
 * Protocolo v1.1 controlado — versión robusta (timeouts + seed orquestación).
 * Corre en contenedor TransitOne.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const API = process.env.V11_PROTOCOL_API || "http://127.0.0.1:3001";
const DATA_DIR = process.env.DATA_DIR || "./data";
const OUT = path.join(DATA_DIR, "commander-v1-1-controlled-results.json");

const PHONES = {
  C1: "5491198800101",
  C2: "5491198800102",
  C3: "5491198800103",
  C4: "5491198800104",
  C5: "5491198800105",
  C6: "5491198800106",
  C7: "5491198800107",
  C8: "5491198800108",
  OFF: "5491198800999",
};

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

async function postWa({ from, body }, ms = 35000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  const t0 = Date.now();
  try {
    const res = await fetch(`${API}/api/webhooks/builderbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "message.incoming",
        data: { from, name: "V11Ctrl", body: body || "" },
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
    return { status: res.status, ms: Date.now() - t0, json, aborted: false };
  } catch (err) {
    return {
      status: 0,
      ms: Date.now() - t0,
      json: { error: err?.message || String(err) },
      aborted: /abort/i.test(err?.message || ""),
    };
  } finally {
    clearTimeout(timer);
  }
}

function readJson(file, fb) {
  try {
    if (!fs.existsSync(file)) return fb;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fb;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function orchSnap(tel) {
  const orch = readJson(path.join(DATA_DIR, "commander-orchestration.json"), {});
  const procs = readJson(path.join(DATA_DIR, "commander-processes.json"), []);
  const row = orch[tel] || { interruptStack: [], activeProcessId: null };
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

function ensureChofer(tel) {
  const file = path.join(DATA_DIR, "parametros.json");
  const db = readJson(file, { choferes: [] });
  if (!Array.isArray(db.choferes)) db.choferes = [];
  if (!db.choferes.some((c) => String(c.telefono || "").replace(/\D/g, "") === tel)) {
    db.choferes.unshift({
      id: crypto.randomUUID(),
      tenant: "tsb",
      nombre: `V11 ${tel.slice(-4)}`,
      telefono: tel,
      activo: true,
      _protocolo_v11: true,
    });
    writeJson(file, db);
  }
  const flotaFile = path.join(DATA_DIR, "viajes-flota-maestros.json");
  const flota = readJson(flotaFile, { choferes: [] });
  if (!Array.isArray(flota.choferes)) flota.choferes = [];
  if (!flota.choferes.some((c) => String(c.telefono || "").replace(/\D/g, "") === tel)) {
    flota.choferes.unshift({
      id: crypto.randomUUID(),
      nombre: `V11 ${tel.slice(-4)}`,
      telefono: tel,
      telefono_wa: tel,
      activo: true,
      _protocolo_v11: true,
    });
    writeJson(flotaFile, flota);
  }
}

function ensureRemito(tel) {
  const remitosFile = path.join(DATA_DIR, "remitos.json");
  const remitos = readJson(remitosFile, []);
  const id = crypto.randomUUID();
  remitos.unshift({
    id,
    tenant: "tsb",
    estado: "pendiente_revision",
    telefono_chofer: tel,
    texto_ocr: "V11",
    datos: { nro_remito: "V11", semi: null },
    validacion: { valido: false, pendientes: ["semi"] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_v11: true,
  });
  writeJson(remitosFile, remitos);
  const convFile = path.join(DATA_DIR, "conversaciones.json");
  const convs = readJson(convFile, []);
  let conv = convs.find((c) => c.telefono === tel);
  if (!conv) {
    conv = { id: tel, telefono: tel, mensajes: [], bot_pausado: false };
    convs.unshift(conv);
  }
  conv.remito_en_revision_id = id;
  conv.ultimo_remito_id = id;
  conv.bot_pausado = false;
  writeJson(convFile, convs);
  return id;
}

function ensureViaje(tel) {
  const file = path.join(DATA_DIR, "viajes-solicitudes.json");
  const rows = readJson(file, []);
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
    nombre: "V11",
    datos: { origen: "CABA", destino: null, toneladas: null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_v11: true,
  });
  writeJson(file, rows);
  return id;
}

function setPaused(tel, paused) {
  const convFile = path.join(DATA_DIR, "conversaciones.json");
  const convs = readJson(convFile, []);
  let conv = convs.find((c) => c.telefono === tel);
  if (!conv) {
    conv = { id: tel, telefono: tel, mensajes: [], bot_pausado: paused };
    convs.unshift(conv);
  }
  conv.bot_pausado = paused;
  writeJson(convFile, convs);
}

function clearOrch(tel) {
  const orchFile = path.join(DATA_DIR, "commander-orchestration.json");
  const orch = readJson(orchFile, {});
  delete orch[tel];
  writeJson(orchFile, orch);
  const procFile = path.join(DATA_DIR, "commander-processes.json");
  const procs = readJson(procFile, []).filter((p) => p.subjectId !== tel);
  writeJson(procFile, procs);
}

/** Seed active process via interrupt API (same DATA_DIR as server). */
async function seedActive(tel, processType, agentId, domainRef = null) {
  // Dynamic import from image
  const mod = await import("/app/lib/commander/interrupt/index.mjs");
  clearOrch(tel);
  return mod.ensureActiveFromDomain({
    subjectId: tel,
    processType,
    agentId,
    domainRef,
  }).process;
}

async function runCase(id, title, tel, fn) {
  ensureChofer(tel);
  const rec = {
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
  log(`BEGIN ${id}`);
  try {
    await fn(rec);
  } catch (e) {
    rec.errors.push(e?.message || String(e));
  }
  rec.finalStack = orchSnap(tel);
  log(`END ${id} pass=${rec.pass} stack=${rec.finalStack.stackDepth}`);
  return rec;
}

async function main() {
  const health = await fetch(`${API}/api/webhooks/builderbot/health`).then((r) => r.json());
  log("health", JSON.stringify(health.sol_commander_v1_1_gate || health));
  if (!health.sol_commander_v1 || !health.sol_commander_v1_1_interrupt) {
    console.error("ABORT flags");
    process.exit(2);
  }
  if (health.sol_commander_v1_1_gate?.allowlist_mode === "all") {
    console.error("ABORT global allowlist");
    process.exit(2);
  }

  const cases = [];

  // C1 remito → lateral viaje → resume
  cases.push(
    await runCase("C1", "remito → lateral → resume", PHONES.C1, async (rec) => {
      const remitoId = ensureRemito(rec.subjectId);
      await seedActive(rec.subjectId, "remito_revision", "remitos", {
        store: "remitos",
        id: remitoId,
      });
      const before = orchSnap(rec.subjectId);
      rec.parent = before.active;
      const r1 = await postWa({
        from: rec.subjectId,
        body: "necesito un viaje a Neuquen con 20 toneladas",
      });
      const mid = orchSnap(rec.subjectId);
      rec.steps.push({ op: "lateral", r: r1, orch: mid });
      rec.push = {
        detected: mid.stackDepth >= 1,
        interrupt: r1.json?.interrupt ?? null,
        frame: mid.stack[0] || null,
      };
      rec.child = mid.active;
      const r2 = await postWa({ from: rec.subjectId, body: "volvamos al remito" });
      const after = orchSnap(rec.subjectId);
      rec.steps.push({ op: "resume", r: r2, orch: after });
      rec.completionReason = "manual_resume";
      rec.popResume = { interrupt: r2.json?.interrupt ?? null, flow: r2.json?.flow };
      rec.finalParent = after.active;
      rec.pass = mid.stackDepth >= 1 && after.stackDepth === 0 && !r1.aborted;
    }),
  );

  // C2 confirmación pendiente
  cases.push(
    await runCase("C2", "confirmación → lateral → volver", PHONES.C2, async (rec) => {
      const remitoId = ensureRemito(rec.subjectId);
      await seedActive(rec.subjectId, "remito_revision", "remitos", {
        store: "remitos",
        id: remitoId,
      });
      const r1 = await postWa({
        from: rec.subjectId,
        body: "quiero hacer un reclamo por faltante",
      });
      const mid = orchSnap(rec.subjectId);
      rec.steps.push({ op: "lateral", r: r1, orch: mid });
      rec.push = { detected: mid.stackDepth >= 1, frame: mid.stack[0] };
      rec.parent = mid.stack[0];
      rec.child = mid.active;
      const r2 = await postWa({ from: rec.subjectId, body: "seguimos con el remito" });
      const after = orchSnap(rec.subjectId);
      rec.steps.push({ op: "resume", r: r2, orch: after });
      rec.completionReason = "manual_resume_confirm";
      rec.popResume = { flow: r2.json?.flow, interrupt: r2.json?.interrupt };
      rec.pass = mid.stackDepth >= 1 && after.stackDepth === 0;
    }),
  );

  // C3 viaje → incidencia → resume
  cases.push(
    await runCase("C3", "viaje → incidencia → volver", PHONES.C3, async (rec) => {
      ensureViaje(rec.subjectId);
      await seedActive(rec.subjectId, "viaje_solicitud", "viajes");
      const r1 = await postWa({ from: rec.subjectId, body: "tuve un pinchazo en la ruta" });
      const mid = orchSnap(rec.subjectId);
      rec.steps.push({ op: "lateral_incidencia", r: r1, orch: mid });
      rec.push = { detected: mid.stackDepth >= 1, resumeMode: mid.stack[0]?.resumeMode };
      rec.parent = mid.stack[0];
      rec.child = mid.active;
      const r2 = await postWa({ from: rec.subjectId, body: "seguimos con el viaje" });
      const after = orchSnap(rec.subjectId);
      rec.steps.push({ op: "resume", r: r2, orch: after });
      rec.completionReason = "explicit_resume_after_incidencia";
      rec.popResume = { interrupt: r2.json?.interrupt, flow: r2.json?.flow };
      rec.finalParent = after.active;
      rec.pass = mid.stackDepth >= 1 && after.stackDepth === 0;
    }),
  );

  // C4 reclamo manual
  cases.push(
    await runCase("C4", "reclamo largo → resume manual", PHONES.C4, async (rec) => {
      ensureViaje(rec.subjectId);
      await seedActive(rec.subjectId, "viaje_solicitud", "viajes");
      const r1 = await postWa({
        from: rec.subjectId,
        body: "quiero hacer un reclamo, no llegó la carga",
      });
      const mid = orchSnap(rec.subjectId);
      rec.push = { detected: mid.stackDepth >= 1, resumeMode: mid.stack[0]?.resumeMode };
      rec.parent = mid.stack[0];
      rec.child = mid.active;
      const rMid = await postWa({ from: rec.subjectId, body: "faltan 2 pallets" });
      const still = orchSnap(rec.subjectId);
      rec.steps.push({ op: "reclamo_turn", r: rMid, orch: still });
      const r2 = await postWa({ from: rec.subjectId, body: "retomemos el viaje" });
      const after = orchSnap(rec.subjectId);
      rec.steps.push({ op: "manual_resume", r: r2, orch: after });
      rec.completionReason = "manual_only";
      rec.popResume = { interrupt: r2.json?.interrupt };
      rec.pass =
        mid.stackDepth >= 1 &&
        mid.stack[0]?.resumeMode === "manual_only" &&
        still.stackDepth >= 1 &&
        after.stackDepth === 0;
    }),
  );

  // C5 nested
  cases.push(
    await runCase("C5", "nested + 3er bloqueado", PHONES.C5, async (rec) => {
      ensureViaje(rec.subjectId);
      await seedActive(rec.subjectId, "viaje_solicitud", "viajes");
      await postWa({ from: rec.subjectId, body: "tuve un pinchazo" });
      const d1 = orchSnap(rec.subjectId);
      await postWa({ from: rec.subjectId, body: "quiero hacer un reclamo por demora" });
      const d2 = orchSnap(rec.subjectId);
      await postWa({ from: rec.subjectId, body: "necesito un viaje a Mendoza 30 toneladas" });
      const d3 = orchSnap(rec.subjectId);
      rec.steps.push({ d1, d2, d3 });
      rec.push = { depth: d2.stackDepth };
      rec.completionReason = "max_depth";
      rec.pass = d2.stackDepth >= 2 && d3.stackDepth === d2.stackDepth;
    }),
  );

  // C6 dejemos eso
  cases.push(
    await runCase("C6", "dejemos eso", PHONES.C6, async (rec) => {
      const remitoId = ensureRemito(rec.subjectId);
      await seedActive(rec.subjectId, "remito_revision", "remitos", {
        store: "remitos",
        id: remitoId,
      });
      await postWa({ from: rec.subjectId, body: "necesito un viaje a Rosario 10 toneladas" });
      const mid = orchSnap(rec.subjectId);
      const parentId = mid.stack[0]?.processId;
      const r2 = await postWa({ from: rec.subjectId, body: "dejemos eso" });
      const after = orchSnap(rec.subjectId);
      const procs = readJson(path.join(DATA_DIR, "commander-processes.json"), []);
      const parent = procs.find((p) => p.processId === parentId);
      rec.steps.push({ mid, after, r2 });
      rec.push = { beforeDepth: mid.stackDepth };
      rec.completionReason = "explicit_cancel_stack_top";
      rec.finalParent = parent
        ? { processId: parent.processId, status: parent.status, processType: parent.processType }
        : null;
      rec.pass = mid.stackDepth >= 1 && after.stackDepth === 0 && parent?.status === "cancelled";
    }),
  );

  // C7 human takeover
  cases.push(
    await runCase("C7", "human takeover", PHONES.C7, async (rec) => {
      ensureViaje(rec.subjectId);
      await seedActive(rec.subjectId, "viaje_solicitud", "viajes");
      setPaused(rec.subjectId, true);
      const r1 = await postWa({ from: rec.subjectId, body: "hola operador" });
      const mid = orchSnap(rec.subjectId);
      rec.steps.push({ r1, mid });
      rec.push = { reason: mid.stack.find((s) => s.reason === "human_takeover") || null };
      rec.child = mid.active;
      rec.completionReason = "human_takeover";
      rec.pass = Boolean(rec.push.reason) && mid.active?.processType === "human_takeover";
      setPaused(rec.subjectId, false);
    }),
  );

  // C8 legacy child no auto pop
  cases.push(
    await runCase("C8", "child legacy sin auto_on_child_complete", PHONES.C8, async (rec) => {
      ensureViaje(rec.subjectId);
      await seedActive(rec.subjectId, "viaje_solicitud", "viajes");
      await postWa({ from: rec.subjectId, body: "tuve una demora en el control" });
      const mid = orchSnap(rec.subjectId);
      await postWa({ from: rec.subjectId, body: "sigue demorado" });
      const still = orchSnap(rec.subjectId);
      rec.steps.push({ mid, still });
      rec.push = { resumeMode: mid.stack[0]?.resumeMode };
      rec.completionReason = "legacy_no_auto_pop";
      rec.pass = mid.stackDepth >= 1 && still.stackDepth >= 1;
    }),
  );

  // OFF allowlist
  cases.push(
    await runCase("OFF", "fuera allowlist = V1", PHONES.OFF, async (rec) => {
      const remitoId = ensureRemito(rec.subjectId);
      await seedActive(rec.subjectId, "remito_revision", "remitos", {
        store: "remitos",
        id: remitoId,
      });
      // clear orch after seed — V1 shouldn't recreate interrupt stack
      clearOrch(rec.subjectId);
      // re-set remito sticky only in conv
      const r1 = await postWa({
        from: rec.subjectId,
        body: "necesito un viaje a Neuquen 20 toneladas",
      });
      const snap = orchSnap(rec.subjectId);
      rec.steps.push({ r1, snap });
      rec.completionReason = "outside_allowlist";
      rec.fallback = "decideV1";
      rec.pass = snap.stackDepth === 0 && r1.json?.interrupt == null;
    }),
  );

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
    cases: cases.map((c) => ({
      ...c,
      // trim huge step payloads for file size
      steps: c.steps.map((s) => ({
        op: s.op,
        status: s.r?.status,
        ms: s.r?.ms,
        flow: s.r?.json?.flow,
        interrupt: s.r?.json?.interrupt,
        aborted: s.r?.aborted,
        orchDepth: s.orch?.stackDepth ?? s.mid?.stackDepth ?? s.after?.stackDepth ?? s.d2?.stackDepth,
        d1: s.d1?.stackDepth,
        d2: s.d2?.stackDepth,
        d3: s.d3?.stackDepth,
      })),
    })),
  };
  writeJson(OUT, summary);
  log("─── SUMMARY ───");
  for (const c of cases) {
    log(`${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.title} | ${c.completionReason}`);
  }
  log(`passed ${summary.passed}/${cases.length} → ${OUT}`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
