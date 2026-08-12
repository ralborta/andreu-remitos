/**
 * Desk Chat Runtime — LLM interpreta → capabilities consultan → LLM responde.
 * Read-only. Sin regex/keywords en el path productivo.
 *
 * forceEngine=rules: SOLO scripts/regresión legacy (nunca auto ante fallo LLM).
 */
import {
  allowedCapabilityNames,
  capabilityCatalogForPrompt,
  executeCapabilitiesParallel,
} from "./capability-registry.mjs";
import { callDeskChatLlmJson } from "./openai.mjs";
import {
  emptyWorkingSet,
  normalizeAnswer,
  normalizePlan,
  normalizeWorkingSet,
  workingSetForStore,
} from "./schemas.mjs";
import { ensureDeskChatCapabilities } from "./index.mjs";

function compactHistory(history, n = 10) {
  return (history || [])
    .slice(-n)
    .map((m) => ({ role: m.role, text: String(m.text || "").slice(0, 500) }));
}

function buildPlanSystem(agentId, catalog) {
  return `Sos el planificador del desk chat del agente especialista "${agentId}" (SOL / TransitOne).
Respondé SOLO JSON con este shape:
{
  "type": "query"|"clarify"|"out_of_domain"|"chitchat",
  "goal": "string",
  "queries": [{ "capability": "nombre.exacto", "args": { } }],
  "workingSetOp": "replace"|"filter"|"keep"|"clear",
  "needsSynthesis": true,
  "clarifyQuestion": "solo si type=clarify"
}

Reglas:
- Interpretá la pregunta del operador en lenguaje natural (incl. follow-ups y pronombres).
- Solo podés usar capabilities del catálogo. No inventes nombres ni campos de args.
- Para follow-ups sobre el conjunto anterior usá workingSetOnly=true y/o ids del workingSet.
- type=out_of_domain si la pregunta no es de este agente.
- type=chitchat si no requiere datos.
- type=clarify si falta un dato imprescindible (ej. código POD).
- No apruebes, rechaces ni mutes nada (solo lectura).

Catálogo:
${JSON.stringify(catalog)}`;
}

function buildAnswerSystem(agentId) {
  return `Sos el agente especialista "${agentId}" de mesa (SOL).
Respondé SOLO JSON: {"reply":"texto en español","entityIds":["..."],"citedIds":["..."],"label":"opcional"}.
Reglas:
- Usá únicamente capabilityResults. Si ok=false o falta dato: "Actualmente no tengo ese dato disponible."
- No inventes cantidades, estados, ids, destinos ni motivos.
- entityIds/citedIds solo ids presentes en los resultados.
- Sé conciso y operativo. No ejecutes acciones.`;
}

function deriveWorkingSet({ plan, results, answer, prevWs, agentId }) {
  const base = normalizeWorkingSet(prevWs, agentId);
  const op = plan?.workingSetOp || "replace";

  if (op === "clear") return emptyWorkingSet(agentId);
  if (op === "keep") {
    return {
      ...base,
      lastGoal: plan?.goal || base.lastGoal,
      lastCapability: plan?.queries?.[0]?.capability || base.lastCapability,
    };
  }

  const fromResults = [];
  for (const r of results || []) {
    if (!r?.ok || !r.result) continue;
    if (Array.isArray(r.result.entityIds)) fromResults.push(...r.result.entityIds.map(String));
    else if (r.result.item?.id) fromResults.push(String(r.result.item.id));
  }

  let entityIds =
    answer?.entityIds?.length
      ? answer.entityIds.map(String)
      : fromResults;

  if (op === "filter" && base.entityIds.length) {
    const allowed = new Set(base.entityIds);
    entityIds = entityIds.filter((id) => allowed.has(id));
    if (!entityIds.length && fromResults.length) {
      entityIds = fromResults.filter((id) => allowed.has(id));
    }
  }

  // Dedup preserve order
  const seen = new Set();
  entityIds = entityIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

  return {
    entityType: agentId,
    entityIds,
    filters: plan?.queries?.[0]?.args || base.filters || {},
    lastGoal: plan?.goal || null,
    lastCapability: plan?.queries?.[0]?.capability || null,
    label: answer?.label || plan?.goal || base.label,
  };
}

async function planWithLlm({ agentId, message, history, workingSet, catalog, log, planOverride, llmCaller }) {
  if (planOverride) {
    return { ok: true, parsed: planOverride, error: null, latencyMs: 0, source: "override" };
  }
  const started = Date.now();
  const caller = llmCaller || callDeskChatLlmJson;
  const out = await caller({
    log,
    system: buildPlanSystem(agentId, catalog),
    userContent: JSON.stringify({
      message,
      workingSet: normalizeWorkingSet(workingSet, agentId),
      history: compactHistory(history),
    }),
  });
  return { ...out, latencyMs: Date.now() - started, source: "llm" };
}

async function answerWithLlm({
  agentId,
  message,
  history,
  workingSet,
  plan,
  results,
  log,
  answerOverride,
  llmCaller,
}) {
  if (answerOverride) {
    return { ok: true, parsed: answerOverride, error: null, latencyMs: 0, source: "override" };
  }
  const started = Date.now();
  const caller = llmCaller || callDeskChatLlmJson;
  const out = await caller({
    log,
    system: buildAnswerSystem(agentId),
    userContent: JSON.stringify({
      message,
      goal: plan?.goal,
      workingSet: normalizeWorkingSet(workingSet, agentId),
      history: compactHistory(history, 6),
      capabilityResults: results,
    }),
  });
  return { ...out, latencyMs: Date.now() - started, source: "llm" };
}

/**
 * Turno productivo desk chat (LLM obligatorio salvo forceEngine=rules).
 */
export async function runDeskChatTurn(opts = {}) {
  ensureDeskChatCapabilities();
  const agentId = String(opts.agentId || "").trim().toLowerCase();
  const message = String(opts.message || "").trim();
  if (!agentId) throw Object.assign(new Error("agentId requerido"), { statusCode: 400 });
  if (!message) throw Object.assign(new Error("message requerido"), { statusCode: 400 });

  const t0 = Date.now();
  const workingSet = normalizeWorkingSet(opts.workingSet, agentId);
  const history = opts.history || [];
  const user = opts.user || { id: opts.userId || "desk", permissions: ["desk:read"] };
  const catalog = capabilityCatalogForPrompt(agentId);
  const allowed = allowedCapabilityNames(agentId);

  const trace = {
    agentId,
    plan: null,
    planErrors: null,
    capabilities: [],
    latencies: {},
    engine: null,
    errors: [],
  };

  // forceEngine=rules se resuelve en resolvePodDeskAnswer (legacy), nunca aquí.
  if (opts.forceEngine === "rules") {
    throw Object.assign(
      new Error("forceEngine=rules no entra al runtime productivo; usar resolvePodDeskAnswer"),
      { statusCode: 400 },
    );
  }

  // ——— Pass 1: plan LLM ———
  const planLlm = await planWithLlm({
    agentId,
    message,
    history,
    workingSet,
    catalog,
    log: opts.log,
    planOverride: opts.planOverride,
    llmCaller: opts.llmCaller,
  });
  trace.latencies.planMs = planLlm.latencyMs;

  if (!planLlm.ok || !planLlm.parsed) {
    trace.errors.push(planLlm.error || "plan_llm_failed");
    return {
      reply:
        "No pude interpretar la consulta en este momento. Reintentá en unos segundos. (El asistente requiere IA disponible; no uso atajos por palabras clave.)",
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(workingSet),
      plan: null,
      capabilityResults: [],
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  const normalized = normalizePlan(planLlm.parsed, { allowedCapabilities: allowed });
  if (!normalized.ok) {
    trace.planErrors = normalized.errors;
    trace.errors.push(...normalized.errors);
    return {
      reply:
        "No pude armar un plan de consulta válido para esa pregunta. Reformulá o acotá al dominio de este agente.",
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(workingSet),
      plan: null,
      capabilityResults: [],
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  const plan = normalized.plan;
  trace.plan = plan;

  if (plan.type === "chitchat" || plan.type === "out_of_domain" || plan.type === "clarify") {
    const staticReply =
      plan.type === "clarify"
        ? plan.clarifyQuestion || "Necesito un dato más para consultar (por ejemplo un código POD)."
        : plan.type === "out_of_domain"
          ? `Esa consulta está fuera del dominio del agente ${agentId}. Probá en el módulo correspondiente o en el Chat Central.`
          : "¡Hola! Puedo consultar datos reales de este módulo. ¿Qué necesitás saber?";

    // Pass 2 opcional para chitchat/clarify con LLM; si falla, usamos static (no es comprensión por keywords de negocio)
    let reply = staticReply;
    let entityIds = [];
    if (plan.type === "clarify" || plan.type === "chitchat") {
      const ansLlm = await answerWithLlm({
        agentId,
        message,
        history,
        workingSet,
        plan,
        results: [],
        log: opts.log,
        answerOverride: opts.answerOverride,
        llmCaller: opts.llmCaller,
      });
      trace.latencies.answerMs = ansLlm.latencyMs;
      const ans = ansLlm.ok ? normalizeAnswer(ansLlm.parsed) : null;
      if (ans?.reply) {
        reply = ans.reply;
        entityIds = ans.entityIds;
      }
    }

    const ws =
      plan.type === "out_of_domain"
        ? workingSet
        : deriveWorkingSet({ plan, results: [], answer: { entityIds, label: null }, prevWs: workingSet, agentId });

    return {
      reply,
      engine: "llm",
      dataSources: ["real"],
      citedIds: entityIds,
      workingSet: workingSetForStore(ws),
      plan,
      capabilityResults: [],
      factsMeta: null,
      trace: { ...trace, engine: "llm", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  // ——— Execute capabilities in parallel ———
  const tExec = Date.now();
  const results = await executeCapabilitiesParallel(plan.queries, {
    agentId,
    tenant: opts.tenant,
    user,
    workingSet,
    log: opts.log,
  });
  trace.latencies.execMs = Date.now() - tExec;
  trace.capabilities = results.map((r) => ({
    capability: r.capability,
    ok: r.ok,
    error: r.error || null,
    latencyMs: r.latencyMs,
  }));

  // ——— Pass 2: synthesize ———
  const ansLlm = await answerWithLlm({
    agentId,
    message,
    history,
    workingSet,
    plan,
    results,
    log: opts.log,
    answerOverride: opts.answerOverride,
    llmCaller: opts.llmCaller,
  });
  trace.latencies.answerMs = ansLlm.latencyMs;

  if (!ansLlm.ok || !ansLlm.parsed) {
    trace.errors.push(ansLlm.error || "answer_llm_failed");
    // Sin fallback heurístico: respuesta honesta grounded en results crudos mínimos
    const okResults = results.filter((r) => r.ok);
    const reply =
      okResults.length === 0
        ? "Consulté el store pero no pude redactar la respuesta (IA no disponible). Los datos no se inventaron."
        : "Obtuve datos del store pero no pude sintetizar la respuesta con IA. Reintentá en unos segundos.";
    return {
      reply,
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(workingSet),
      plan,
      capabilityResults: results,
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  const answer = normalizeAnswer(ansLlm.parsed);
  if (!answer) {
    trace.errors.push("answer_shape_invalid");
    return {
      reply: "La IA devolvió una respuesta inválida. Reintentá, por favor.",
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(workingSet),
      plan,
      capabilityResults: results,
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  // Filtrar entityIds a los presentes en results
  const allowedIds = new Set();
  for (const r of results) {
    if (!r.ok || !r.result) continue;
    (r.result.entityIds || []).forEach((id) => allowedIds.add(String(id)));
    if (r.result.item?.id) allowedIds.add(String(r.result.item.id));
    (r.result.items || []).forEach((it) => allowedIds.add(String(it.id)));
  }
  const safeIds = (answer.entityIds || []).filter((id) => allowedIds.has(String(id)));
  const safeCited = (answer.citedIds || []).filter((id) => allowedIds.has(String(id)));
  const finalAnswer = { ...answer, entityIds: safeIds, citedIds: safeCited.length ? safeCited : safeIds };

  const nextWs = deriveWorkingSet({
    plan,
    results,
    answer: finalAnswer,
    prevWs: workingSet,
    agentId,
  });

  const resumenResult = results.find((r) => r.ok && r.capability === "pod.resumen");

  return {
    reply: finalAnswer.reply,
    engine: "llm",
    dataSources: ["real"],
    citedIds: finalAnswer.citedIds,
    workingSet: workingSetForStore(nextWs),
    plan,
    capabilityResults: results,
    factsMeta: resumenResult?.result
      ? { today: resumenResult.result.today, resumen: resumenResult.result }
      : null,
    trace: { ...trace, engine: "llm", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
  };
}
