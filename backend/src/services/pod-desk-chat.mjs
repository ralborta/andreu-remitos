/**
 * Chat de mesa POD.
 * Path productivo: Desk Chat Runtime (LLM → capabilities → LLM).
 * answerPodFromFactsRules / forceEngine=rules: SOLO scripts de regresión legacy.
 */
import * as podStore from "../db/pod-store.mjs";
import { labelEstadoPod, POD_ESTADOS_DIALOG } from "../../../lib/pod.mjs";
import { runDeskChatTurn } from "./desk-chat/runtime.mjs";
import { normalizeWorkingSet } from "./desk-chat/schemas.mjs";

const TZ = "America/Argentina/Buenos_Aires";

function startOfTodayIso() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
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
    dataSource: "real",
  };
}

/** Snapshot factual (legacy / debug). Preferir capabilities pod.* en runtime. */
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
 * LEGACY — solo `forceEngine=rules` / scripts de regresión.
 * NO usar en path productivo UI.
 */
export function answerPodFromFactsRules({ message, facts, workingSet }) {
  const q = norm(message);
  const pods = facts.pods || [];
  const byId = Object.fromEntries(pods.map((p) => [p.id, p]));
  const wsIds = workingSet?.entityIds?.length
    ? workingSet.entityIds
    : workingSet?.podIds?.length
      ? workingSet.podIds
      : null;

  const resolveSet = (ids) => ids.map((id) => byId[id]).filter(Boolean);

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

/** Usado por runtime cuando forceEngine=rules. */
export async function resolvePodDeskAnswerLegacyRules(opts = {}) {
  const message = String(opts.message || "").trim();
  if (!message) throw Object.assign(new Error("message requerido"), { statusCode: 400 });
  const facts = await buildPodDeskFacts();
  const workingSet = normalizeWorkingSet(opts.workingSet || { podIds: [], label: null }, "pod");
  const rules = answerPodFromFactsRules({ message, facts, workingSet });
  return { ...rules, factsMeta: { today: facts.today, resumen: facts.resumen } };
}

/**
 * Path productivo: Desk Chat Runtime (LLM → capabilities → LLM).
 * forceEngine=rules → legacy explícito (scripts). Nunca auto-fallback ante fallo LLM.
 */
export async function resolvePodDeskAnswer(opts = {}) {
  const message = String(opts.message || "").trim();
  if (!message) {
    throw Object.assign(new Error("message requerido"), { statusCode: 400 });
  }

  if (opts.forceEngine === "rules") {
    return resolvePodDeskAnswerLegacyRules(opts);
  }

  return runDeskChatTurn({
    agentId: "pod",
    message,
    workingSet: opts.workingSet,
    history: opts.history || [],
    tenant: opts.tenant,
    user: opts.user || { id: "desk", permissions: ["desk:read"] },
    log: opts.log,
    planOverride: opts.planOverride,
    answerOverride: opts.answerOverride,
    llmCaller: opts.llmCaller,
  });
}
