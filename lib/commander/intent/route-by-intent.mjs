import { clasificarIntencionWhatsApp } from "../../wa-intent-router.mjs";
import { resolveByIntent } from "../registry/agent-registry.mjs";
import { finalizeDecision } from "../trace/log-trace.mjs";

/**
 * Intent router encapsulado (H1–H14 intactas dentro de wa-intent-router).
 * Devuelve CommanderDecision sin ejecutar agentes.
 */
export async function routeByIntent({
  texto,
  actor,
  log,
  processes = [],
} = {}) {
  const intentResult = await clasificarIntencionWhatsApp({
    texto,
    esChoferRemitos: actor.isChoferRemitos,
    esChoferFlotaViajes: actor.isChoferFlotaViajes,
    nombre: actor.choferNombre ?? null,
    log,
  });

  const intent = intentResult.intent;
  const active = processes.find((p) => p.status === "active");
  let interruptedProcessId = null;
  if (
    active &&
    intent !== "continue_process" &&
    intent !== "chat" &&
    intent !== "desconocido" &&
    active.agentId &&
    intent !== active.type?.replace(/_.*/, "")
  ) {
    // Solo anotación informativa (v1) — no pausa real
    interruptedProcessId = active.processId;
  }

  if (intent === "viaje") {
    return finalizeDecision({
      intent: "viaje",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "viajes",
      action: "run_agent",
      forceAgent: true,
      interruptedProcessId,
      executorHints: { executorKey: "viajes_force", legacyFlow: "intent_viaje" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "reclamo") {
    return finalizeDecision({
      intent: "reclamo",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "reclamos",
      action: "run_agent",
      forceAgent: false,
      interruptedProcessId,
      executorHints: { executorKey: "reclamos", legacyFlow: "intent_reclamo" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "incidencia") {
    if (!actor.isChoferOperativo) {
      return finalizeDecision({
        intent: "incidencia",
        confidence: intentResult.confianza,
        intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
        agentId: "incidencias",
        action: "ask_clarification",
        forceAgent: false,
        executorHints: { executorKey: "incidencias_solo_choferes", legacyFlow: "incidencia_solo_choferes" },
        trace: { branch: "intent_router", routerRaw: intentResult },
      });
    }
    return finalizeDecision({
      intent: "incidencia",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "incidencias",
      action: "run_agent",
      forceAgent: true,
      interruptedProcessId,
      executorHints: { executorKey: "incidencias_force", legacyFlow: "intent_incidencia" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "rendicion") {
    if (!actor.isChoferOperativo) {
      return finalizeDecision({
        intent: "rendicion",
        confidence: intentResult.confianza,
        intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
        agentId: "rendicion",
        action: "ask_clarification",
        executorHints: { executorKey: "rendicion_solo_choferes", legacyFlow: "rendicion_solo_choferes" },
        trace: { branch: "intent_router", routerRaw: intentResult },
      });
    }
    return finalizeDecision({
      intent: "rendicion",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "rendicion",
      action: "run_agent",
      forceAgent: true,
      interruptedProcessId,
      executorHints: { executorKey: "rendicion_force", legacyFlow: "intent_rendicion" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "pod") {
    if (!actor.isChoferOperativo) {
      return finalizeDecision({
        intent: "pod",
        confidence: intentResult.confianza,
        intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
        agentId: "pod",
        action: "ask_clarification",
        executorHints: { executorKey: "pod_solo_choferes", legacyFlow: "pod_solo_choferes" },
        trace: { branch: "intent_router", routerRaw: intentResult },
      });
    }
    return finalizeDecision({
      intent: "pod",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "pod",
      action: "run_agent",
      forceAgent: true,
      interruptedProcessId,
      executorHints: { executorKey: "pod_force", legacyFlow: "intent_pod" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "remito") {
    if (actor.isChoferOperativo) {
      return finalizeDecision({
        intent: "remito",
        confidence: intentResult.confianza,
        intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
        agentId: "remitos",
        action: "run_agent",
        suggestedReply:
          "Perfecto 👍 Enviame una *foto clara del remito* (que se vea bien la guía y los datos).",
        executorHints: { executorKey: "remitos_pedir_foto", legacyFlow: "intent_remito" },
        trace: { branch: "intent_router", routerRaw: intentResult },
      });
    }
    return finalizeDecision({
      intent: "remito",
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: "remitos",
      action: "ask_clarification",
      suggestedReply:
        intentResult.mensaje ||
        `Para *remitos* escriben los choferes registrados.\n\n` +
          `Si necesitás un *viaje/flete* o abrir un *reclamo*, contame y te ayudo.`,
      executorHints: { executorKey: "remitos_solo_choferes", legacyFlow: "remito_solo_choferes" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  if (intent === "chat" || intent === "desconocido") {
    if (actor.isChoferOperativo) {
      // Parity: return null → cae a procesarTextoChofer
      return finalizeDecision({
        intent,
        confidence: intentResult.confianza,
        intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
        agentId: "remitos",
        action: "continue_process",
        executorHints: { executorKey: "remitos_texto", legacyFlow: "router_null_chofer" },
        trace: { branch: "intent_router", routerRaw: intentResult },
      });
    }
    const manifest = resolveByIntent(intent, actor);
    return finalizeDecision({
      intent,
      confidence: intentResult.confianza,
      intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
      agentId: manifest?.id ?? "router",
      action: "ask_clarification",
      suggestedReply:
        intentResult.mensaje ||
        `Hola 👋 ¿En qué te ayudo?\n\n` +
          `• *Viaje / flete*\n` +
          `• *Reclamo*\n\n` +
          `Decime cuál y seguimos.`,
      executorHints: { executorKey: "clarify", legacyFlow: "intent_clarificar" },
      trace: { branch: "intent_router", routerRaw: intentResult },
    });
  }

  return finalizeDecision({
    intent: intent || "desconocido",
    confidence: intentResult.confianza ?? 0,
    intentSource: intentResult.fuente === "heuristica" ? "heuristica" : "ia",
    agentId: "remitos",
    action: "continue_process",
    executorHints: { executorKey: "remitos_texto", legacyFlow: "intent_fallback_texto" },
    trace: { branch: "intent_router", routerRaw: intentResult },
  });
}
