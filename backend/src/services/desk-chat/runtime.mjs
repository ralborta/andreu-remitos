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
  const isCommander = agentId === "commander";
  const role = isCommander
    ? `Sos el planificador del Chat Central Commander de mesa (SOL / TransitOne). Sos un compañero de operaciones: conversás, analizás, sugerís priorización y, cuando hace falta, orquestás consultas read-only entre especialistas (pod, viajes, incidencias, rendicion, eta, remitos).`
    : `Sos el planificador del desk chat del agente especialista "${agentId}" (SOL / TransitOne). También atendés charla, análisis y sugerencias; no sos solo un buscador de datos.`;

  const domainRules = isCommander
    ? `- Podés combinar varias capabilities de distintos dominios en un mismo plan (ejecución paralela).
- Resumen / análisis / “cómo viene la operación” / “qué priorizo” / “qué me conviene mirar” / “ayudame a decidir”: preferí en paralelo viajes.resumen + eta.resumen + incidencias.resumen + pod.resumen + remitos.resumen (y joins si pide relaciones).
- Preguntas de RELACIÓN cross-domain (qué viajes tienen incidencias/demora/POD, cuántas por viaje, “de esos” entre dominios): DEBÉS usar commander.relacionar_viajes (join por refs reales). NO armes la relación llamando list/resumen de dos dominios y dejando que Pass2 “cruce” mentalmente.
- remitos↔viaje: si preguntan el vínculo, igual usá commander.relacionar_viajes con con=remitos (puede devolver relationAvailable=false).
- Para resumen operativo y joins: workingSetOp=replace (no clear) para conservar domains/refs en follow-ups.
- Elegí el dominio correcto: demoras → eta/incidencias o commander.relacionar_viajes con incidenciaTipo=demora / soloDemorasEta; POD pendiente → podPendiente=true.
- type=chitchat SIEMPRE para saludos, cortesías, “cómo estás”, “quién sos”, “qué podés hacer”, bromas, charla general, pedidos de ayuda sin dato concreto todavía, o cualquier turno conversacional que no necesite consultar el store.
- type=out_of_domain SOLO si pide mutaciones (aprobar/rechazar/editar), WhatsApp outbound, OCR/ingest, o algo que claramente no se pueda ni conversar ni consultar en lectura. NUNCA uses out_of_domain para “hola”, “buenas”, “gracias”, “ok”, “dale”, “qué tal”, “ayudame”, “qué me sugerís”, etc.`
    : `- type=chitchat para saludos, cortesías y charla que no requiere datos de este módulo.
- Pedidos de análisis / “qué hago” / “qué priorizo” sobre este módulo → type=query (traer hechos para poder comentar y sugerir).
- type=out_of_domain SOLO si la pregunta es claramente de OTRO módulo operativo (y no es chitchat). NUNCA out_of_domain para “hola” / charla humana.`;

  return `${role}
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
- Interpretá la pregunta del operador en lenguaje natural (incl. follow-ups y pronombres). El backend NO interpreta semántica: vos decidís capabilities y args.
- Solo podés usar capabilities del catálogo. No inventes nombres ni campos de args.
- workingSetOnly=true SOLO si el workingSet trae entityIds (o domains.*.entityIds) no vacíos Y el follow-up es explícito sobre ese conjunto ("de esos", "cuáles", "y de…").
- Si entityIds está vacío: NUNCA uses workingSetOnly; consultá de nuevo con filtros/limit.
- Para listados nuevos o "últimos N": NO uses workingSetOnly; usá limit.
- Un conteo 0 es un dato válido.
${domainRules}
- type=query cuando hace falta mirar datos (listados, resúmenes, joins, análisis, recomendaciones con hechos).
- type=clarify si falta un dato imprescindible (ej. código).
- No apruebes, rechaces ni mutes nada (solo lectura + orientación).

Catálogo:
${JSON.stringify(catalog)}`;
}

function buildAnswerSystem(agentId, { mode = "query" } = {}) {
  const isCommander = agentId === "commander";
  const role = isCommander
    ? `Sos el Chat Central de mesa (SOL): una persona de operaciones rioplatense, cercana y con criterio. Conversás, analizás la situación, comentás lo que se ve y sugerís cómo priorizar o qué mirar después. No sos un robot de menú ni un “brindador de información” seco.`
    : `Sos el especialista "${agentId}" de mesa (SOL): persona de operaciones rioplatense, cercana y con criterio. Analizás, comentás y sugerís sobre tu módulo; no te limitás a devolver tablas.`;

  const chitchatExtra =
    mode === "chitchat" || mode === "clarify"
      ? `
- Este turno es conversacional (sin datos del store o con poca info). Respondé como persona: saludá si te saludan, explicá con naturalidad qué podés hacer (incl. analizar y sugerir priorización), invitá a preguntar.
- Podés ofrecer ayuda concreta (viajes, incidencias, ETA, POD, remitos, rendición) sin sonar a menú numerado.
- Si el plan vino marcado out_of_domain pero el mensaje es saludo/charla/ayuda (“hola”, “buenas”, “qué tal”, “ayudame”), igual respondé humano y útil: NUNCA digas que no conocés el dominio ni que está fuera de alcance.
- Solo si pide de verdad mutar datos, mandar WhatsApp o OCR: redirigí con tono amable (sin sermón técnico).
- No digas que sos una IA / un bot / un modelo.`
      : `
- Estructura mental de la respuesta (en prosa natural, no como checklist rígido):
  1) Hechos clave (conteos/estados relevantes de capabilityResults).
  2) Comentario / lectura: qué implica eso para la operación (tensiones, focos, señales).
  3) Sugerencias de decisión orientativas: qué priorizar, qué conviene chequear después, qué riesgo mirar primero.
- Las sugerencias son orientación de mesa (ej. “yo miraría primero las demoras ETA y los POD pendientes”), NUNCA ejecutes ni digas que ya aprobaste/rechazaste/enviaste algo.
- No te limites a listar campos crudos ni a pegar JSON mental; aportá criterio.
- Tono humano y coloquial (voseo rioplatense), claro y accionable, sin inventar.`;

  return `${role}
Respondé SOLO JSON: {"reply":"texto en español","entityIds":["..."],"citedIds":["..."],"label":"opcional"}.
Reglas:
- Usá únicamente capabilityResults cuando hay resultados. Si ok=false o el campo no existe: decí con naturalidad que ahora no tenés ese dato.
- Si un conteo es 0, decí explícitamente 0 (cero es un dato válido, no es “dato no disponible”).
- Si una lista viene vacía (count=0), decí que no hay coincidencias con esos filtros.
- No inventes cantidades, estados, ids, destinos ni motivos.
- entityIds/citedIds solo ids presentes en los resultados.
- No ejecutes acciones (solo lectura / orientación / sugerencia).${chitchatExtra}${
    isCommander && mode === "query"
      ? `\n- Si hay resultados de varios dominios, aclará brevemente de qué módulo viene cada dato y cruzá la lectura (sin inventar vínculos).
- Resultados parciales: si algunas capabilities ok=true y otras ok=false (error/timeout), respondé con lo disponible, comentá el hueco y sugerí qué reintentar; no inventes el faltante.
- RELACIONES cross-domain: SOLO si algún result trae relationAvailable=true y pairs/relations con verified=true (p.ej. commander.relacionar_viajes). Si relationAvailable=false o no hay pairs verificados, decí explícitamente que los datos no permiten establecer esa relación. NUNCA asumas que un viaje “tiene” una incidencia/ETA/POD/remito solo porque ambos conjuntos aparecieron en el mismo turno.`
      : ""
  }`;
}

/** Validación de contexto: workingSetOnly sin entityIds no filtra nada útil. */
function sanitizeQueriesAgainstWorkingSet(queries, workingSet) {
  const ids = workingSet?.entityIds || [];
  const domainIds = Object.values(workingSet?.domains || {}).some(
    (d) => Array.isArray(d?.entityIds) && d.entityIds.length,
  );
  if (ids.length || domainIds) return queries;
  return (queries || []).map((q) => {
    if (!q?.args || q.args.workingSetOnly !== true) return q;
    const args = { ...q.args };
    delete args.workingSetOnly;
    return { ...q, args };
  });
}

function entityTypeFromResults(results, agentId, plan) {
  const types = [];
  for (const r of results || []) {
    if (!r?.ok || !r.result) continue;
    if (r.result.entityType) types.push(String(r.result.entityType));
    else if (r.capability?.includes(".")) types.push(String(r.capability).split(".")[0]);
  }
  const unique = [...new Set(types)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) {
    if (agentId === "commander") return "commander";
    const lastCap = plan?.queries?.[plan.queries.length - 1]?.capability;
    if (lastCap?.includes(".")) return String(lastCap).split(".")[0];
    return unique[unique.length - 1];
  }
  const firstCap = plan?.queries?.[0]?.capability;
  if (firstCap?.includes(".")) return String(firstCap).split(".")[0];
  return agentId;
}

function buildDomainsFromResults(results, plan, prevDomains, op) {
  const domains = op === "replace" ? {} : { ...(prevDomains || {}) };
  for (const r of results || []) {
    if (!r?.ok || !r.result) continue;
    const domain =
      r.result.entityType ||
      (r.capability?.includes(".") ? String(r.capability).split(".")[0] : null) ||
      r.agentId;
    if (!domain) continue;
    let entityIds = [];
    if (Array.isArray(r.result.entityIds)) entityIds = r.result.entityIds.map(String);
    else if (Array.isArray(r.result.refs)) entityIds = r.result.refs.map((x) => String(x.id));
    else if (r.result.item?.id) entityIds = [String(r.result.item.id)];
    entityIds = [...new Set(entityIds)].slice(0, 40);

    if (op === "filter" && domains[domain]?.entityIds?.length) {
      const allowed = new Set(domains[domain].entityIds);
      entityIds = entityIds.filter((id) => allowed.has(id));
    }

    const qArgs = (plan?.queries || []).find((q) => q.capability === r.capability)?.args || {};
    domains[domain] = {
      agentId: r.agentId || domain,
      capability: r.capability,
      entityType: domain,
      entityIds,
      filters: r.result.filters || qArgs || {},
      goal: plan?.goal || null,
    };
  }
  return domains;
}

function buildRelationsFromResults(results, prevRelations, op) {
  const collected = [];
  for (const r of results || []) {
    if (!r?.ok || !r.result) continue;
    if (Array.isArray(r.result.relations)) collected.push(...r.result.relations);
  }
  if (collected.length) return collected.slice(0, 80);
  if (op === "keep" || op === "filter") return prevRelations || [];
  return [];
}

function deriveWorkingSet({ plan, results, answer, prevWs, agentId }) {
  const base = normalizeWorkingSet(prevWs, agentId);
  const op = plan?.workingSetOp || "replace";

  if (op === "clear") return emptyWorkingSet(agentId);
  if (op === "keep") {
    return {
      ...base,
      agentId,
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

  const seen = new Set();
  entityIds = entityIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true))).slice(0, 80);

  const domains = buildDomainsFromResults(results, plan, base.domains, op);
  const relations = buildRelationsFromResults(results, base.relations, op);

  // Primary entityIds: prefer viajes if present in join/domains
  if (!entityIds.length && domains.viajes?.entityIds?.length) {
    entityIds = [...domains.viajes.entityIds];
  }

  return {
    entityType: entityTypeFromResults(results, agentId, plan),
    entityIds,
    filters: plan?.queries?.[0]?.args || base.filters || {},
    lastGoal: plan?.goal || null,
    lastCapability:
      plan?.queries?.[plan.queries?.length - 1]?.capability || plan?.queries?.[0]?.capability || null,
    label: answer?.label || plan?.goal || base.label,
    agentId,
    domains,
    relations,
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
  mode = "query",
}) {
  if (answerOverride) {
    return { ok: true, parsed: answerOverride, error: null, latencyMs: 0, source: "override" };
  }
  const started = Date.now();
  const caller = llmCaller || callDeskChatLlmJson;
  const out = await caller({
    log,
    system: buildAnswerSystem(agentId, { mode }),
    userContent: JSON.stringify({
      message,
      goal: plan?.goal,
      planType: plan?.type,
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
  if (plan.type === "query" && Array.isArray(plan.queries)) {
    plan.queries = sanitizeQueriesAgainstWorkingSet(plan.queries, workingSet);
  }
  trace.plan = plan;

  if (plan.type === "chitchat" || plan.type === "out_of_domain" || plan.type === "clarify") {
    const staticReply =
      plan.type === "clarify"
        ? plan.clarifyQuestion || "Necesito un dato más para consultar (por ejemplo un código POD)."
        : plan.type === "out_of_domain"
          ? agentId === "commander"
            ? "Eso ya se me escapa un poco (mutaciones, WhatsApp o cargas OCR las manejan otros flujos). Igual hablame: te ayudo a mirar Viajes, Incidencias, Rendición, ETA, POD y Remitos."
            : `Eso no lo manejo desde este módulo. Si querés, te oriento o lo vemos en el Chat Central / el agente que corresponda.`
          : agentId === "commander"
            ? "¡Hola! Acá estoy. Puedo charlar y ayudarte a mirar Viajes, Incidencias, Rendición, ETA, POD y Remitos. ¿Qué necesitás?"
            : "¡Hola! Acá estoy para este módulo. Decime qué necesitás y lo vemos.";

    // Pass 2 LLM para conversar (chitchat/clarify) y también para suavizar out_of_domain mal clasificado.
    let reply = staticReply;
    let entityIds = [];
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
      mode: plan.type === "out_of_domain" ? "chitchat" : plan.type,
    });
    trace.latencies.answerMs = ansLlm.latencyMs;
    const ans = ansLlm.ok ? normalizeAnswer(ansLlm.parsed) : null;
    if (ans?.reply) {
      reply = ans.reply;
      entityIds = ans.entityIds;
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
    mode: "query",
  });
  trace.latencies.answerMs = ansLlm.latencyMs;

  if (!ansLlm.ok || !ansLlm.parsed) {
    trace.errors.push(ansLlm.error || "answer_llm_failed");
    const okResults = results.filter((r) => r.ok);
    const ws = deriveWorkingSet({
      plan,
      results,
      answer: { entityIds: [], label: null },
      prevWs: workingSet,
      agentId,
    });
    const unavailable = okResults.filter((r) => r.result?.relationAvailable === false);
    let reply =
      okResults.length === 0
        ? "Consulté el store pero no pude redactar la respuesta (IA no disponible). Los datos no se inventaron."
        : "Obtuve datos del store pero no pude sintetizar la respuesta con IA. Reintentá en unos segundos.";
    if (unavailable.length === okResults.length && unavailable.length > 0) {
      reply =
        unavailable[0].result.groundedNote ||
        "Los datos persistidos no permiten establecer esa relación entre entidades.";
    }
    return {
      reply,
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(ws),
      plan,
      capabilityResults: results,
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  const answer = normalizeAnswer(ansLlm.parsed);
  if (!answer) {
    trace.errors.push("answer_shape_invalid");
    const ws = deriveWorkingSet({
      plan,
      results,
      answer: { entityIds: [], label: null },
      prevWs: workingSet,
      agentId,
    });
    return {
      reply: "La IA devolvió una respuesta inválida. Reintentá, por favor.",
      engine: "llm_error",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(ws),
      plan,
      capabilityResults: results,
      factsMeta: null,
      trace: { ...trace, engine: "llm_error", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
    };
  }

  // Relación no verificable: no dejar que Pass2 invente un “no hay” como si hubiera join
  const relBlocked = results.filter((r) => r.ok && r.result?.relationAvailable === false);
  if (relBlocked.length && results.every((r) => !r.ok || r.result?.relationAvailable === false)) {
    const note =
      relBlocked[0].result.groundedNote ||
      "Los datos persistidos no permiten establecer esa relación entre entidades.";
    const ws = deriveWorkingSet({
      plan,
      results,
      answer: { entityIds: [], label: null },
      prevWs: workingSet,
      agentId,
    });
    return {
      reply: note,
      engine: "llm",
      dataSources: ["real"],
      citedIds: [],
      workingSet: workingSetForStore(ws),
      plan,
      capabilityResults: results,
      factsMeta: null,
      trace: { ...trace, engine: "llm", latencies: { ...trace.latencies, totalMs: Date.now() - t0 } },
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
