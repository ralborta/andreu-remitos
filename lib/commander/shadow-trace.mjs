/**
 * SOL Commander — shadow traces + parity vs legacy.
 * No ejecuta agentes; solo registra. Sin PII completa.
 */
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import * as reclamosStore from "../../backend/src/db/reclamos-store.mjs";
import * as incidenciasStore from "../../backend/src/db/incidencias-store.mjs";
import * as podStore from "../../backend/src/db/pod-store.mjs";
import * as destinosStore from "../../backend/src/db/destinos-store.mjs";
import * as solViajesStore from "../../backend/src/db/viajes-solicitudes-store.mjs";

const shadowAls = new AsyncLocalStorage();

function dataDir() {
  return process.env.DATA_DIR || "./data";
}
function traceFile() {
  return path.join(dataDir(), "commander-shadow-traces.jsonl");
}
function summaryFile() {
  return path.join(dataDir(), "commander-shadow-divergences.json");
}

/** @param {string|null|undefined} text */
export function sanitizeText(text, max = 80) {
  if (text == null || text === "") return null;
  const t = String(text).replace(/\s+/g, " ").trim();
  if (!t) return null;
  // ocultar posibles teléfonos largos / emails
  const redacted = t
    .replace(/\b\d{8,}\b/g, "[digits]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  return redacted.length > max ? `${redacted.slice(0, max)}…` : redacted;
}

/**
 * Detecta procesos activos (solo IDs/tipos — sin payloads).
 */
export async function detectActiveProcesses(subjectId) {
  if (!subjectId) return [];
  const out = [];
  try {
    const r = await reclamosStore.getReclamoPendientePorTelefono(subjectId);
    if (r) out.push({ processId: r.id ?? null, processType: "reclamo", agentId: "reclamos" });
  } catch { /* ignore */ }
  try {
    const i = await incidenciasStore.getIncidenciaPendientePorTelefono(subjectId);
    if (i) out.push({ processId: i.id ?? null, processType: "incidencia", agentId: "incidencias" });
  } catch { /* ignore */ }
  try {
    const p = await podStore.getPodPendientePorTelefono(subjectId);
    if (p) out.push({ processId: p.id ?? null, processType: "pod_caso", agentId: "pod" });
  } catch { /* ignore */ }
  try {
    const d = await destinosStore.getDestinoPendientePorTelefono(subjectId);
    if (d) out.push({ processId: d.id ?? null, processType: "destino_confirmacion", agentId: "destinos" });
  } catch { /* ignore */ }
  try {
    const c = await destinosStore.getDestinoActivoPorChofer(subjectId);
    if (c) out.push({ processId: c.id ?? null, processType: "destino_eta_chofer", agentId: "destinos" });
  } catch { /* ignore */ }
  try {
    const v = await solViajesStore.getSolicitudPendientePorTelefono(subjectId);
    if (v) out.push({ processId: v.id ?? null, processType: "viaje_solicitud", agentId: "viajes" });
  } catch { /* ignore */ }
  return out;
}

/** Mapea flow legacy → decisión comparable. */
export function inferLegacyDecisionFromPayload(payload = {}) {
  const flow = String(payload.flow || payload.event || "").toLowerCase();
  const map = [
    { re: /^reclamo/, intent: "reclamo", agentId: "reclamos", action: "run_agent" },
    { re: /^incidencia/, intent: "incidencia", agentId: "incidencias", action: "run_agent" },
    { re: /^pod/, intent: "pod", agentId: "pod", action: "run_agent" },
    { re: /^rendicion/, intent: "rendicion", agentId: "rendicion", action: "run_agent" },
    { re: /^destino/, intent: "continue_process", agentId: "destinos", action: "continue_process" },
    { re: /^viaje/, intent: "viaje", agentId: "viajes", action: "run_agent" },
    { re: /remito_pedir_foto/, intent: "remito", agentId: "remitos", action: "run_agent" },
    { re: /^(ok|revision|audio_|confirmado|correccion|esperando_|foto)/, intent: "remito", agentId: "remitos", action: "run_agent" },
    { re: /intent_clarificar|clarify/, intent: "chat", agentId: "router", action: "ask_clarification" },
    { re: /contacto_oculto|noop|empty/, intent: "desconocido", agentId: null, action: "noop" },
  ];
  for (const m of map) {
    if (m.re.test(flow)) {
      return {
        intent: m.intent,
        agentId: m.agentId,
        action: m.action,
        flow,
        source: "legacy_response",
      };
    }
  }
  return {
    intent: flow ? "unknown_flow" : "unknown",
    agentId: null,
    action: "unknown",
    flow: flow || null,
    source: "legacy_response",
  };
}

function comparable(decision) {
  return {
    intent: decision?.intent ?? null,
    agentId: decision?.agentId ?? null,
    action: decision?.action ?? null,
  };
}

function stickyBranch(decision) {
  if (!decision) return null;
  if (decision.trace?.branch === "legacy_process_policy") {
    return decision.trace?.notes?.[0] || decision.executorHints?.legacyFlow || "policy";
  }
  return null;
}

export function computeParity(commanderDecision, legacyDecision) {
  const c = comparable(commanderDecision);
  const l = comparable(legacyDecision);
  const divergences = [];
  if (c.intent !== l.intent && l.intent !== "unknown" && l.intent !== "unknown_flow") {
    divergences.push({ type: "intent", commander: c.intent, legacy: l.intent });
  }
  if (c.agentId !== l.agentId && l.action !== "unknown") {
    divergences.push({ type: "agent", commander: c.agentId, legacy: l.agentId });
  }
  if (c.action !== l.action && l.action !== "unknown") {
    divergences.push({ type: "action", commander: c.action, legacy: l.action });
  }
  // sticky: si commander usó policy y legacy fue a otro agente
  const sticky = stickyBranch(commanderDecision);
  if (sticky && l.agentId && c.agentId && l.agentId !== c.agentId) {
    divergences.push({
      type: "sticky_process",
      commanderSticky: sticky,
      commanderAgent: c.agentId,
      legacyAgent: l.agentId,
    });
  }
  return {
    parity: divergences.length === 0,
    divergences,
  };
}

function appendJsonl(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, "utf8");
}

function updateDivergenceSummary(traceRow) {
  const SUMMARY_FILE = summaryFile();
  fs.mkdirSync(path.dirname(SUMMARY_FILE), { recursive: true });
  let summary = {
    updated_at: null,
    total_traces: 0,
    parity_true: 0,
    parity_false: 0,
    by_type: { intent: 0, agent: 0, action: 0, sticky_process: 0 },
    recent: [],
  };
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, "utf8"));
    }
  } catch {
    /* reset */
  }
  summary.total_traces = (summary.total_traces || 0) + 1;
  if (traceRow.parity) summary.parity_true = (summary.parity_true || 0) + 1;
  else summary.parity_false = (summary.parity_false || 0) + 1;
  for (const d of traceRow.divergences || []) {
    if (summary.by_type[d.type] != null) summary.by_type[d.type] += 1;
  }
  if (!traceRow.parity) {
    summary.recent = [
      {
        at: traceRow.at,
        messageId: traceRow.messageId,
        decisionId: traceRow.decisionId,
        divergences: traceRow.divergences,
        commander: {
          intent: traceRow.intent,
          agentId: traceRow.agentId,
          action: traceRow.action,
          policy: traceRow.legacyProcessPolicy,
        },
        legacy: traceRow.legacyDecision,
      },
      ...(summary.recent || []),
    ].slice(0, 50);
  }
  summary.updated_at = new Date().toISOString();
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}

/**
 * Persiste un trace de shadow (sanitizado).
 */
export function persistShadowTrace(row) {
  const TRACE_FILE = traceFile();
  appendJsonl(TRACE_FILE, row);
  return updateDivergenceSummary(row);
}

export function getShadowTracePaths() {
  return { TRACE_FILE: traceFile(), SUMMARY_FILE: summaryFile(), DATA_DIR: dataDir() };
}

export function runWithShadowStore(store, fn) {
  return shadowAls.run(store, fn);
}

/** Bind shadow store for the rest of the current async request (legacy path). */
export function enterShadowStore(store) {
  if (store) shadowAls.enterWith(store);
}

export function getShadowStore() {
  return shadowAls.getStore() ?? null;
}

/**
 * Si hay shadow activo y aún no se registró parity, compara con payload legacy.
 */
export function noteLegacyResponse(payload, log) {
  const store = getShadowStore();
  if (!store?.commanderDecision || store.recorded) return;
  store.recorded = true;

  const legacyDecision = inferLegacyDecisionFromPayload(payload);
  const { parity, divergences } = computeParity(store.commanderDecision, legacyDecision);
  const d = store.commanderDecision;

  const trace = {
    at: new Date().toISOString(),
    shadow: true,
    messageId: store.messageId,
    decisionId: d.decisionId,
    subjectIdHash: store.subjectIdHash,
    textPreview: store.textPreview,
    activeProcesses: store.activeProcesses ?? [],
    legacyProcessPolicy: {
      branch: d.trace?.branch ?? null,
      notes: d.trace?.notes ?? [],
      legacyFlow: d.executorHints?.legacyFlow ?? null,
      handledByPolicy: d.trace?.branch === "legacy_process_policy",
    },
    intent: d.intent,
    confidence: d.confidence,
    intentSource: d.intentSource,
    agentId: d.agentId,
    action: d.action,
    interruptedProcessId: d.interruptedProcessId ?? null,
    executorKey: d.executorHints?.executorKey ?? null,
    legacyDecision,
    parity,
    divergences,
  };

  try {
    const summary = persistShadowTrace(trace);
    log?.info?.(
      {
        shadow: true,
        parity,
        messageId: trace.messageId,
        decisionId: trace.decisionId,
        intent: trace.intent,
        agentId: trace.agentId,
        action: trace.action,
        legacyIntent: legacyDecision.intent,
        legacyAgent: legacyDecision.agentId,
        divergences,
        parity_false_total: summary.parity_false,
      },
      parity ? "SOL Commander SHADOW parity=OK" : "SOL Commander SHADOW parity=DIVERGENCE",
    );
  } catch (err) {
    log?.warn?.({ err: err.message }, "SOL Commander SHADOW persist falló");
  }
}

export function hashSubject(subjectId) {
  const s = String(subjectId || "");
  if (s.length < 4) return "[id]";
  return `…${s.slice(-4)}`;
}
