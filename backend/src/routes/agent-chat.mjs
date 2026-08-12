/**
 * Chat web → agentes especialistas (desk-chat runtime).
 * Read-only. Sin fallback heurístico automático.
 */
import * as chatStore from "../db/agent-chat-store.mjs";
import { runDeskChatTurn } from "../services/desk-chat/runtime.mjs";
import { resolvePodDeskAnswer } from "../services/pod-desk-chat.mjs";

const SUPPORTED = new Set([
  "pod",
  "viajes",
  "incidencias",
  "rendicion",
  "eta",
  "remitos",
  "commander",
]);

export default async function agentChatRoutes(fastify) {
  fastify.post("/", async (request, reply) => {
    const body = request.body || {};
    const agentId = String(body.agentId || "").trim().toLowerCase();
    const message = String(body.message || "").trim();
    const tenant = body.tenant != null ? String(body.tenant).trim() : null;
    let conversationId = body.conversationId ? String(body.conversationId).trim() : null;

    if (!agentId) {
      return reply.code(400).send({ error: "agentId_requerido" });
    }
    if (!SUPPORTED.has(agentId)) {
      return reply.code(501).send({
        error: "agente_no_habilitado",
        message: `Chat web no habilitado para agentId=${agentId}.`,
        supported: [...SUPPORTED],
      });
    }
    if (!message) {
      return reply.code(400).send({ error: "message_requerido" });
    }

    const user = request.user || {};
    let conv = conversationId ? await chatStore.getConversation(conversationId) : null;
    if (conversationId && !conv) {
      return reply.code(404).send({ error: "conversacion_no_encontrada" });
    }
    if (conv && conv.agentId !== agentId) {
      return reply.code(400).send({ error: "agentId_no_coincide" });
    }
    if (!conv) {
      conv = await chatStore.createConversation({
        agentId,
        tenant,
        userId: user.id || null,
        username: user.username || user.nombre || null,
        channel: "web",
        meta: body.context && typeof body.context === "object" ? { context: body.context } : {},
      });
      conversationId = conv.id;
    }

    const userCtx = {
      id: user.id || "desk",
      username: user.username || null,
      permissions: ["desk:read"],
    };

    let answer;
    try {
      // forceEngine=rules SOLO pod legacy (scripts). UI nunca lo envía.
      if (agentId === "pod" && body.forceEngine === "rules") {
        answer = await resolvePodDeskAnswer({
          message,
          workingSet: conv.workingSet,
          history: (conv.messages || []).map((m) => ({ role: m.role, text: m.text })),
          forceEngine: "rules",
          tenant,
          user: userCtx,
          log: request.log,
        });
      } else {
        answer = await runDeskChatTurn({
          agentId,
          message,
          workingSet: conv.workingSet,
          history: (conv.messages || []).map((m) => ({ role: m.role, text: m.text })),
          tenant,
          user: userCtx,
          log: request.log,
        });
      }
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }

    const updated = await chatStore.appendTurn(conversationId, {
      userMessage: { text: message },
      assistantMessage: {
        text: answer.reply,
        meta: {
          engine: answer.engine,
          dataSources: answer.dataSources,
          citedIds: answer.citedIds,
        },
      },
      workingSet: answer.workingSet,
      trace: {
        question: message,
        agentId,
        answer: answer.reply,
        engine: answer.engine,
        citedIds: answer.citedIds || [],
        dataSources: answer.dataSources || ["real"],
        factsMeta: answer.factsMeta || null,
        plan: answer.plan || null,
        capabilities: answer.trace?.capabilities || [],
        latencies: answer.trace?.latencies || null,
        errors: answer.trace?.errors || [],
        userId: user.id || null,
        username: user.username || null,
        tenant,
      },
    });

    return {
      conversationId: updated.id,
      agentId,
      tenant: updated.tenant,
      user: {
        id: user.id || null,
        username: user.username || null,
        nombre: user.nombre || null,
      },
      message: {
        role: "assistant",
        text: answer.reply,
        engine: answer.engine,
        dataSources: answer.dataSources,
        citedIds: answer.citedIds || [],
      },
      conversation: chatStore.publicConversation(updated),
      traceId: updated.traces?.[updated.traces.length - 1]?.id || null,
    };
  });

  fastify.get("/:conversationId", async (request, reply) => {
    const conv = await chatStore.getConversation(request.params.conversationId);
    if (!conv) return reply.code(404).send({ error: "conversacion_no_encontrada" });
    return chatStore.publicConversation(conv);
  });

  fastify.get("/:conversationId/traces", async (request, reply) => {
    const conv = await chatStore.getConversation(request.params.conversationId);
    if (!conv) return reply.code(404).send({ error: "conversacion_no_encontrada" });
    return {
      conversationId: conv.id,
      agentId: conv.agentId,
      traces: conv.traces || [],
    };
  });
}
