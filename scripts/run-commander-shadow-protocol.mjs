/**
 * Protocolo Shadow — escenarios controlados (TransitOne).
 * No activa V1. No cambia arquitectura. Solo POST webhook + lee traces.
 *
 * Usage (cwd backend o repo root con DATA_DIR):
 *   node scripts/run-commander-shadow-protocol.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const API = process.env.SHADOW_PROTOCOL_API || "http://127.0.0.1:3001";
const DATA_DIR = process.env.DATA_DIR || "./data";
const TRACE = path.join(DATA_DIR, "commander-shadow-traces.jsonl");
const OUT = path.join(DATA_DIR, "commander-shadow-protocol-results.json");

function phone(suffix) {
  return `5491199${String(suffix).padStart(6, "0")}`;
}

async function postWa({ from, name, body, mediaUrl = null }) {
  const data = { from, name: name || "Protocolo Shadow", body: body || "" };
  if (mediaUrl) {
    data.urlTempFile = mediaUrl;
    data.attachment = [{ url: mediaUrl, mime_type: "image/jpeg", filename: "t.jpg" }];
  }
  const res = await fetch(`${API}/api/webhooks/builderbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName: "message.incoming", data }),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function readLastTraceAfter(beforeCount) {
  if (!fs.existsSync(TRACE)) return null;
  const lines = fs.readFileSync(TRACE, "utf8").trim().split("\n").filter(Boolean);
  if (lines.length <= beforeCount) return null;
  return JSON.parse(lines.at(-1));
}

function traceCount() {
  if (!fs.existsSync(TRACE)) return 0;
  return fs.readFileSync(TRACE, "utf8").trim().split("\n").filter(Boolean).length;
}

function severity(trace) {
  if (!trace) return "high";
  if (trace.parity) return "none";
  const types = new Set((trace.divergences || []).map((d) => d.type));
  const sticky = types.has("sticky_process");
  const agent = types.has("agent");
  const intent = types.has("intent");
  if (sticky && agent) return "critical";
  if (agent || intent) return "high";
  if (types.has("action")) return "medium";
  return "low";
}

function ensureChofer(tel, nombre) {
  // Choferes Remitos viven en parametros.json → choferes[]
  const file = path.join(DATA_DIR, "parametros.json");
  let db = { choferes: [], unidades: [], localidades: [], distancias: [] };
  if (fs.existsSync(file)) {
    try {
      db = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      /* keep empty */
    }
  }
  if (!Array.isArray(db.choferes)) db.choferes = [];
  const exists = db.choferes.some(
    (c) => String(c.telefono || "").replace(/\D/g, "") === tel && c.activo !== false,
  );
  if (!exists) {
    const now = new Date().toISOString();
    db.choferes.unshift({
      id: crypto.randomUUID(),
      tenant: "tsb",
      nombre,
      telefono: tel,
      documento: tel.slice(-8),
      activo: true,
      created_at: now,
      updated_at: now,
      _protocolo_shadow: true,
    });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  }

  // Chofer flota (incidencias) — viajes-flota-maestros.json
  const flotaFile = path.join(DATA_DIR, "viajes-flota-maestros.json");
  let flota = { choferes: [], camiones: [] };
  if (fs.existsSync(flotaFile)) {
    try {
      flota = JSON.parse(fs.readFileSync(flotaFile, "utf8"));
    } catch {
      /* keep */
    }
  }
  if (!Array.isArray(flota.choferes)) flota.choferes = [];
  const existsFlota = flota.choferes.some(
    (c) => String(c.telefono || c.telefono_wa || "").replace(/\D/g, "") === tel,
  );
  if (!existsFlota) {
    flota.choferes.unshift({
      id: crypto.randomUUID(),
      nombre,
      telefono: tel,
      telefono_wa: tel,
      activo: true,
      _protocolo_shadow: true,
    });
    fs.writeFileSync(flotaFile, JSON.stringify(flota, null, 2));
  }
}

function ensureRemitoAbierto(tel) {
  const remitosFile = path.join(DATA_DIR, "remitos.json");
  let remitos = [];
  if (fs.existsSync(remitosFile)) {
    remitos = JSON.parse(fs.readFileSync(remitosFile, "utf8"));
  }
  if (!Array.isArray(remitos)) remitos = [];
  const id = crypto.randomUUID();
  remitos.unshift({
    id,
    tenant: "tsb",
    estado: "pendiente_revision",
    telefono_chofer: tel,
    imagen_path: null,
    texto_ocr: "PROTOCOLO SHADOW",
    datos: { nro_remito: "SHADOW001", semi: null },
    validacion: { valido: false, pendientes: ["semi"] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_shadow: true,
  });
  fs.writeFileSync(remitosFile, JSON.stringify(remitos, null, 2));

  const convFile = path.join(DATA_DIR, "conversaciones.json");
  let convs = [];
  if (fs.existsSync(convFile)) convs = JSON.parse(fs.readFileSync(convFile, "utf8"));
  if (!Array.isArray(convs)) convs = [];
  let conv = convs.find((c) => c.telefono === tel);
  if (!conv) {
    conv = {
      id: tel,
      telefono: tel,
      tenant: "tsb",
      nombre: "Protocolo Shadow",
      mensajes: [],
      bot_pausado: false,
      created_at: new Date().toISOString(),
    };
    convs.unshift(conv);
  }
  conv.ultimo_remito_id = id;
  conv.remito_en_revision_id = id;
  conv.updated_at = new Date().toISOString();
  fs.writeFileSync(convFile, JSON.stringify(convs, null, 2));
  return id;
}

function ensureViajePending(tel) {
  const file = path.join(DATA_DIR, "viajes-solicitudes.json");
  let rows = [];
  if (fs.existsSync(file)) {
    try {
      rows = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      rows = [];
    }
  }
  if (!Array.isArray(rows)) rows = [];
  // cerrar previos del tel
  for (const r of rows) {
    if (r.telefono === tel && ["recolectando", "pendiente", "propuesta"].includes(r.estado)) {
      r.estado = "cancelada_protocolo";
    }
  }
  const id = `VS-PROT-${tel.slice(-4)}`;
  rows.unshift({
    id,
    estado: "recolectando",
    telefono: tel,
    nombre: "Protocolo Shadow",
    datos: { origen: null, destino: null, toneladas: null },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_shadow: true,
  });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return id;
}

function ensureDestinoPendiente(tel) {
  const file = path.join(DATA_DIR, "destinos-pendientes.json");
  let rows = [];
  if (fs.existsSync(file)) {
    try {
      rows = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      rows = [];
    }
  }
  if (!Array.isArray(rows)) rows = [];
  for (const r of rows) {
    if (r.telefono_cliente === tel && r.estado === "esperando_cliente") {
      r.estado = "cancelado";
      r.updated_at = new Date().toISOString();
    }
  }
  const id = `PD-PROT-${tel.slice(-4)}`;
  rows.unshift({
    id,
    estado: "esperando_cliente",
    telefono_cliente: tel,
    telefono_chofer: null,
    direccion: "Calle Falsa 123",
    historial: ["Protocolo shadow"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _protocolo_shadow: true,
  });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return id;
}

async function runScenario(sc) {
  const before = traceCount();
  if (sc.setup === "chofer") ensureChofer(sc.from, sc.name);
  if (sc.setup === "remito") {
    ensureChofer(sc.from, sc.name);
    ensureRemitoAbierto(sc.from);
  }
  if (sc.setup === "viaje") ensureViajePending(sc.from);
  if (sc.setup === "destino") ensureDestinoPendiente(sc.from);

  const results = [];
  for (const input of sc.inputs) {
    const b = traceCount();
    const resp = await postWa({ from: sc.from, name: sc.name, body: input });
    // pequeño delay para flush
    await new Promise((r) => setTimeout(r, 200));
    const trace = readLastTraceAfter(b);
    results.push({
      input,
      http: resp.status,
      legacy_flow: resp.json?.flow ?? null,
      proceso_activo: trace?.activeProcesses ?? [],
      commander: trace
        ? {
            intent: trace.intent,
            confidence: trace.confidence,
            intentSource: trace.intentSource,
            agentId: trace.agentId,
            action: trace.action,
            interruptedProcessId: trace.interruptedProcessId,
            policy: trace.legacyProcessPolicy,
          }
        : null,
      legacy_decision: trace?.legacyDecision ?? {
        flow: resp.json?.flow,
        source: "http_response_only",
      },
      parity: trace?.parity ?? null,
      divergences: trace?.divergences ?? [],
      severity: severity(trace),
      observation: !trace
        ? "Sin trace shadow (¿SHADOW off o respuesta sin respuestaWebhook?)"
        : trace.parity
          ? "Parity OK"
          : `Divergencia: ${(trace.divergences || []).map((d) => d.type).join(",")}`,
    });
  }
  return {
    id: sc.id,
    name: sc.name_scenario,
    from: sc.from,
    setup: sc.setup,
    steps: results,
  };
}

const scenarios = [
  {
    id: "S01",
    name_scenario: "Viaje simple",
    from: phone(1),
    name: "Shadow S01",
    setup: "none",
    inputs: ["necesito un viaje a Neuquen con 15 toneladas"],
  },
  {
    id: "S02",
    name_scenario: "Viaje con pregunta lateral",
    from: phone(2),
    name: "Shadow S02",
    setup: "viaje",
    inputs: ["cuanto sale el flete?"],
  },
  {
    id: "S03",
    name_scenario: "Remito abierto + correccion",
    from: phone(3),
    name: "Shadow S03",
    setup: "remito",
    inputs: ["semi remolque AH318WB"],
  },
  {
    id: "S04",
    name_scenario: "Remito abierto + incidencia",
    from: phone(4),
    name: "Shadow S04",
    setup: "remito",
    inputs: ["tuve un pinchazo en la ruta"],
  },
  {
    id: "S05",
    name_scenario: "Confirmacion ambigua",
    from: phone(5),
    name: "Shadow S05",
    setup: "remito",
    inputs: ["si esta bien creo"],
  },
  {
    id: "S06",
    name_scenario: "Negacion",
    from: phone(6),
    name: "Shadow S06",
    setup: "remito",
    inputs: ["no, esta mal"],
  },
  {
    id: "S07",
    name_scenario: "ok / dale / porfa / espera",
    from: phone(7),
    name: "Shadow S07",
    setup: "remito",
    inputs: ["ok", "dale", "porfa", "espera"],
  },
  {
    id: "S08",
    name_scenario: "Cambio de intencion a mitad de proceso",
    from: phone(8),
    name: "Shadow S08",
    setup: "viaje",
    inputs: ["mejor abri un reclamo, no llego la carga"],
  },
  {
    id: "S09",
    name_scenario: "POD",
    from: phone(9),
    name: "Shadow S09",
    setup: "chofer",
    inputs: ["entregue, te mando el POD"],
  },
  {
    id: "S10",
    name_scenario: "Rendicion",
    from: phone(10),
    name: "Shadow S10",
    setup: "chofer",
    inputs: ["rendicion nafta 45000"],
  },
  {
    id: "S11",
    name_scenario: "Reclamo",
    from: phone(11),
    name: "Shadow S11",
    setup: "none",
    inputs: ["quiero hacer un reclamo por faltante"],
  },
  {
    id: "S12",
    name_scenario: "Destino",
    from: phone(12),
    name: "Shadow S12",
    setup: "destino",
    inputs: ["si, la direccion es correcta"],
  },
  {
    id: "S13",
    name_scenario: "Desconocido / chat",
    from: phone(13),
    name: "Shadow S13",
    setup: "none",
    inputs: ["buenas, que horarios tienen?"],
  },
];

const health = await fetch(`${API}/api/webhooks/builderbot/health`).then((r) => r.json());
if (health.sol_commander_v1 === true) {
  console.error("ABORT: SOL_COMMANDER_V1 está true — no ejecutar protocolo");
  process.exit(2);
}
if (health.sol_commander_shadow !== true) {
  console.error("ABORT: SOL_COMMANDER_SHADOW no está true");
  process.exit(2);
}

console.log("Protocolo Shadow — V1=false SHADOW=true");
const started = new Date().toISOString();
const results = [];
for (const sc of scenarios) {
  process.stdout.write(`… ${sc.id} ${sc.name_scenario}\n`);
  try {
    results.push(await runScenario(sc));
  } catch (err) {
    results.push({
      id: sc.id,
      name: sc.name_scenario,
      error: err.message,
      severity: "high",
    });
  }
}

const flat = [];
for (const r of results) {
  for (const step of r.steps || []) {
    flat.push({
      scenario: r.id,
      name: r.name,
      input: step.input,
      proceso_activo: step.proceso_activo,
      legacy_flow: step.legacy_flow,
      legacy_decision: step.legacy_decision,
      commander: step.commander,
      parity: step.parity,
      divergences: step.divergences,
      severity: step.severity,
      observation: step.observation,
    });
  }
}

const divergences = flat.filter((f) => f.parity === false);
const bySeverity = { critical: [], high: [], medium: [], low: [], none: [] };
for (const f of flat) {
  (bySeverity[f.severity] || bySeverity.high).push(f);
}

const report = {
  started,
  finished: new Date().toISOString(),
  health: {
    sol_commander_v1: health.sol_commander_v1,
    sol_commander_shadow: health.sol_commander_shadow,
  },
  totals: {
    scenarios: results.length,
    steps: flat.length,
    parity_true: flat.filter((f) => f.parity === true).length,
    parity_false: divergences.length,
    missing_trace: flat.filter((f) => f.parity == null).length,
  },
  divergences_prioritized: [...divergences].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  }),
  by_severity_counts: {
    critical: bySeverity.critical.length,
    high: bySeverity.high.length,
    medium: bySeverity.medium.length,
    low: bySeverity.low.length,
    none: bySeverity.none.length,
  },
  results,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("\n=== RESUMEN ===");
console.log(JSON.stringify(report.totals, null, 2));
console.log("severidad", report.by_severity_counts);
console.log("divergencias priorizadas:");
for (const d of report.divergences_prioritized) {
  console.log(
    `- [${d.severity}] ${d.scenario} «${d.input}» cmd=${d.commander?.intent}/${d.commander?.agentId} leg=${d.legacy_decision?.intent}/${d.legacy_decision?.agentId} types=${(d.divergences || []).map((x) => x.type).join(",") || "—"}`,
  );
}
console.log("\nEscrito", OUT);
