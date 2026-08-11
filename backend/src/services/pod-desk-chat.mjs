/**
 * Chat de mesa POD — respuestas grounded en pod-store (datos reales).
 * No muta Remitos. No Tool Registry / Event Bus.
 * Canal web operador ↔ agente especialista `pod` (no flujo chofer WhatsApp).
 */
import * as podStore from "../db/pod-store.mjs";
import { labelEstadoPod, POD_ESTADOS_DIALOG } from "../../../lib/pod.mjs";

const TZ = "America/Argentina/Buenos_Aires";

function startOfTodayIso() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = fmt.format(new Date()); // YYYY-MM-DD
  // Medianoche Argentina ≈ UTC-3; usamos comparación por día local del ISO.
  return day;
}

function dayKey(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

function mapFact(row) {
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: labelEstadoPod(row.estado),
    chofer: row.chofer_nombre || null,
    telefono: row.telefono || null,
    receptor: row.receptor_nombre || null,
    viaje: row.viaje_ref || null,
    destino: row.destino || null,
    destinoId: row.destino_id || null,
    notaChofer: row.nota_chofer || null,
    notaBackoffice: row.nota_backoffice || null,
    aprobadoPor: row.aprobado_por || null,
    historial: Array.isArray(row.historial) ? row.historial.slice(-8) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    /** Origen del dato: store operativo real (nunca mezclar con mocks de UI). */
    dataSource: "real",
  };
}

/** Snapshot factual para el agente POD (solo mesa: sin esperando_*). */
export async function buildPodDeskFacts({ limit = 80 } = {}) {
  const today = startOfTodayIso();
  const all = (await podStore.listPods({ limit: 200 })).filter(
    (r) => !POD_ESTADOS_DIALOG.has(r.estado),
  );
  const facts = all.slice(0, limit).map(mapFact);
  const recibidosHoy = facts.filter((f) => dayKey(f.createdAt) === today);
  const pendientes = facts.filter((f) => f.estado === "pendiente");
  const rechazados = facts.filter((f) => f.estado === "rechazado");
  const ok = facts.filter((f) => f.estado === "ok");
  const resumen = await podStore.resumenPods();

  return {
    asOf: new Date().toISOString(),
    timezone: TZ,
    today,
    resumen: {
      ...resumen,
      recibidosHoy: recibidosHoy.length,
      dataSource: "real",
    },
    idsHoy: recibidosHoy.map((f) => f.id),
    idsPendientes: pendientes.map((f) => f.id),
    idsRechazados: rechazados.map((f) => f.id),
    idsOk: ok.map((f) => f.id),
    pods: facts,
  };
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function listBrief(pods, n = 10) {
  return pods.slice(0, n).map((p) => ({
    codigo: p.codigo,
    estado: p.estadoLabel,
    destino: p.destino || "—",
    viaje: p.viaje || "—",
    receptor: p.receptor || "—",
    createdAt: p.createdAt,
  }));
}

function formatList(pods, n = 10) {
  if (!pods.length) return "No hay casos en ese conjunto.";
  return listBrief(pods, n)
    .map(
      (p, i) =>
        `${i + 1}. ${p.codigo} · ${p.estado} · destino: ${p.destino} · viaje: ${p.viaje} · ${p.receptor}`,
    )
    .join("\n");
}

/**
 * Fallback sin LLM: cubre los casos mínimos documentados + follow-up por destino
 * sobre workingSet. No inventa datos.
 */
export function answerPodFromFactsRules({ message, facts, workingSet }) {
  const q = norm(message);
  const pods = facts.pods || [];
  const byId = Object.fromEntries(pods.map((p) => [p.id, p]));
  const wsIds = workingSet?.podIds?.length ? workingSet.podIds : null;

  const resolveSet = (ids) => ids.map((id) => byId[id]).filter(Boolean);

  // Follow-up: filtrar working set por destino/localidad en texto
  if (
    wsIds &&
    (q.includes("de esos") ||
      q.includes("de estas") ||
      q.includes("y de") ||
      q.startsWith("y ") ||
      q.includes("cuales son de") ||
      q.includes("filtra") ||
      q.includes("solo de"))
  ) {
    const base = resolveSet(wsIds);
    const place =
      String(message).match(/\bson\s+de\s+(.+?)[\?\.\!]*$/i)?.[1]?.trim() ||
      String(message).match(/\bes\s+de\s+(.+?)[\?\.\!]*$/i)?.[1]?.trim() ||
      String(message).match(/\bdestino\s+(.+?)[\?\.\!]*$/i)?.[1]?.trim() ||
      null;
    if (place && norm(place).length >= 3) {
      const filtered = base.filter((p) => norm(p.destino).includes(norm(place)));
      return {
        reply:
          filtered.length === 0
            ? `En el conjunto anterior no hay POD con destino que contenga «${place}».`
            : `De esos, ${filtered.length} con destino «${place}»:\n${formatList(filtered, 20)}`,
        workingSet: { podIds: filtered.map((p) => p.id), label: `filtro:${place}` },
        engine: "rules_fallback",
        citedIds: filtered.map((p) => p.id),
        dataSources: ["real"],
      };
    }
  }

  if (/cuantos?\s+pod\s+recib|recibimos\s+hoy|pod\s+hoy/.test(q) || /cuantos?\s+recibimos\s+hoy/.test(q)) {
    const set = resolveSet(facts.idsHoy);
    return {
      reply: `Hoy (${facts.today}, ${facts.timezone}) recibimos ${facts.resumen.recibidosHoy} POD.`,
      workingSet: { podIds: facts.idsHoy, label: "recibidos_hoy" },
      engine: "rules_fallback",
      citedIds: facts.idsHoy,
      dataSources: ["real"],
    };
  }

  if (/pendient/.test(q)) {
    return {
      reply: `Hay ${facts.idsPendientes.length} POD pendientes de confirmación en mesa.`,
      workingSet: { podIds: facts.idsPendientes, label: "pendientes" },
      engine: "rules_fallback",
      citedIds: facts.idsPendientes,
      dataSources: ["real"],
    };
  }

  if (/rechazad/.test(q) && !/por\s+que|porque/.test(q)) {
    const set = resolveSet(facts.idsRechazados);
    return {
      reply:
        set.length === 0
          ? "No hay POD rechazados en el store."
          : `Hay ${set.length} POD rechazados:\n${formatList(set, 20)}`,
      workingSet: { podIds: facts.idsRechazados, label: "rechazados" },
      engine: "rules_fallback",
      citedIds: facts.idsRechazados,
      dataSources: ["real"],
    };
  }

  if (/ultimos?\s*10|mostrame\s+los\s+ultimos|lista\s+los\s+ultimos/.test(q)) {
    const set = pods.slice(0, 10);
    return {
      reply: `Últimos ${set.length} POD (más recientes):\n${formatList(set, 10)}`,
      workingSet: { podIds: set.map((p) => p.id), label: "ultimos_10" },
      engine: "rules_fallback",
      citedIds: set.map((p) => p.id),
      dataSources: ["real"],
    };
  }

  // ¿por qué se rechazó este POD? — busca código/id en mensaje o working set
  if (/por\s*que\s+se\s+rechaz|porque\s+se\s+rechaz|motivo\s+de\s+rechazo/.test(q)) {
    const codeMatch = String(message).match(/\b(POD-[A-Z0-9]+)\b/i);
    let target = codeMatch
      ? pods.find((p) => p.id === codeMatch[1] || norm(p.codigo) === norm(codeMatch[1]))
      : null;
    if (!target && wsIds?.length === 1) target = byId[wsIds[0]];
    if (!target && wsIds?.length) {
      const rejected = resolveSet(wsIds).filter((p) => p.estado === "rechazado");
      if (rejected.length === 1) target = rejected[0];
    }
    if (!target) {
      const rejected = resolveSet(facts.idsRechazados);
      if (rejected.length === 1) target = rejected[0];
    }
    if (!target) {
      return {
        reply:
          "Indicá el código del POD (ej. POD-0001) para ver el motivo de rechazo (nota de mesa / historial).",
        workingSet: workingSet || { podIds: [], label: null },
        engine: "rules_fallback",
        citedIds: [],
        dataSources: ["real"],
      };
    }
    if (target.estado !== "rechazado") {
      return {
        reply: `${target.codigo} no está rechazado (estado: ${target.estadoLabel}).`,
        workingSet: { podIds: [target.id], label: target.codigo },
        engine: "rules_fallback",
        citedIds: [target.id],
        dataSources: ["real"],
      };
    }
    const motivo =
      target.notaBackoffice ||
      [...(target.historial || [])].reverse().find((h) => /rechaz/i.test(h)) ||
      "Sin nota de rechazo registrada en mesa.";
    return {
      reply: `${target.codigo} fue rechazado. Motivo: ${motivo}${
        target.aprobadoPor ? ` (por ${target.aprobadoPor})` : ""
      }.`,
      workingSet: { podIds: [target.id], label: target.codigo },
      engine: "rules_fallback",
      citedIds: [target.id],
      dataSources: ["real"],
    };
  }

  if (/que\s+viaje|viaje\s+corresponde|a\s+que\s+viaje/.test(q)) {
    const codeMatch = String(message).match(/\b(POD-[A-Z0-9]+)\b/i);
    let target = codeMatch
      ? pods.find((p) => p.id === codeMatch[1] || norm(p.codigo) === norm(codeMatch[1]))
      : null;
    if (!target && wsIds?.length === 1) target = byId[wsIds[0]];
    if (!target) {
      return {
        reply: "Indicá el código del POD para decirte el viaje asociado (`viaje_ref`).",
        workingSet: workingSet || { podIds: [], label: null },
        engine: "rules_fallback",
        citedIds: [],
        dataSources: ["real"],
      };
    }
    return {
      reply: target.viaje
        ? `${target.codigo} corresponde al viaje/pedido: ${target.viaje}. Destino: ${target.destino || "—"}.`
        : `${target.codigo} no tiene viaje_ref cargado en el store (dato aún vacío, no demo).`,
      workingSet: { podIds: [target.id], label: target.codigo },
      engine: "rules_fallback",
      citedIds: [target.id],
      dataSources: ["real"],
    };
  }

  // Resumen genérico
  return {
    reply:
      `Puedo consultar el store real de POD. Ahora: ${facts.resumen.recibidosHoy} hoy, ` +
      `${facts.idsPendientes.length} pendientes, ${facts.idsRechazados.length} rechazados, ` +
      `${facts.idsOk.length} OK. Preguntá por pendientes, rechazados, últimos 10, un código o un follow-up sobre el conjunto anterior.`,
    workingSet: workingSet || { podIds: [], label: null },
    engine: "rules_fallback",
    citedIds: [],
    dataSources: ["real"],
  };
}

async function callOpenAiPodDesk({ system, userContent, log }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_POD_DESK_MODEL?.trim() ||
    process.env.OPENAI_POD_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.POD_DESK_IA_TIMEOUT_MS) || 28000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const m = String(raw).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (err) {
    log?.warn?.({ err: err.message }, "pod-desk-chat LLM falló");
    return null;
  }
}

async function answerPodFromFactsLlm({ message, facts, workingSet, history, log }) {
  const compact = {
    today: facts.today,
    timezone: facts.timezone,
    resumen: facts.resumen,
    workingSet,
    pods: (facts.pods || []).map((p) => ({
      id: p.id,
      codigo: p.codigo,
      estado: p.estado,
      destino: p.destino,
      viaje: p.viaje,
      receptor: p.receptor,
      chofer: p.chofer,
      notaBackoffice: p.notaBackoffice,
      historial: p.historial,
      createdAt: p.createdAt,
      dataSource: p.dataSource,
    })),
  };

  const ia = await callOpenAiPodDesk({
    log,
    system: `Sos el agente especialista POD de mesa (SOL / TransitOne).
Respondé SOLO con JSON: {"reply":"texto en español","workingPodIds":["id",...],"label":"opcional"}.
Reglas:
- Usá únicamente los hechos del JSON de hechos. dataSource "real" = store operativo.
- Si falta un dato, decilo; no inventes. No mezcles datos demo.
- Para follow-ups ("de esos", "y de Córdoba"), filtrá sobre workingSet.podIds.
- workingPodIds = IDs del conjunto relevante tras la respuesta (para el próximo follow-up).
- No ejecutes acciones (no aprobar/rechazar). Solo consulta.`,
    userContent: `Hechos:\n${JSON.stringify(compact)}\n\nHistorial reciente:\n${JSON.stringify(
      (history || []).slice(-8),
    )}\n\nPregunta del operador:\n${message}`,
  });

  if (!ia?.reply) return null;
  const allowed = new Set((facts.pods || []).map((p) => p.id));
  const workingPodIds = Array.isArray(ia.workingPodIds)
    ? ia.workingPodIds.map(String).filter((id) => allowed.has(id))
    : [];
  return {
    reply: String(ia.reply).trim(),
    workingSet: {
      podIds: workingPodIds,
      label: ia.label ? String(ia.label) : workingSet?.label || null,
    },
    engine: "llm",
    citedIds: workingPodIds,
    dataSources: ["real"],
  };
}

/**
 * Resuelve una pregunta de mesa contra el store POD.
 * @param {{ message: string, workingSet?: object, history?: array, forceEngine?: "rules"|"llm", log?: object }}
 */
export async function resolvePodDeskAnswer(opts = {}) {
  const message = String(opts.message || "").trim();
  if (!message) {
    throw Object.assign(new Error("message requerido"), { statusCode: 400 });
  }
  const facts = await buildPodDeskFacts();
  const workingSet = opts.workingSet || { podIds: [], label: null };
  const history = opts.history || [];

  if (opts.forceEngine !== "rules") {
    const llm = await answerPodFromFactsLlm({
      message,
      facts,
      workingSet,
      history,
      log: opts.log,
    });
    if (llm) return { ...llm, factsMeta: { today: facts.today, resumen: facts.resumen } };
  }

  const rules = answerPodFromFactsRules({ message, facts, workingSet });
  return { ...rules, factsMeta: { today: facts.today, resumen: facts.resumen } };
}
