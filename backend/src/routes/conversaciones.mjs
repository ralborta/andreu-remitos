import { sendWhatsAppMessage, setBuilderBotBlacklist } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import { syncBotPausa, BOT_PAUSA_INACTIVIDAD_MIN } from "../../../lib/bot-pausa.mjs";
import * as convStore from "../db/conversations-store.mjs";

export default async function conversacionesRoutes(fastify) {
  fastify.get("/", async (request) => {
    const { tenant, limit } = request.query;
    const list = await convStore.listConversaciones({
      tenant: tenant || undefined,
      limit: limit ? parseInt(limit, 10) : 80,
    });
    for (const c of list) {
      if (c.bot_pausado) await syncBotPausa(c.telefono);
    }
    return convStore.listConversaciones({
      tenant: tenant || undefined,
      limit: limit ? parseInt(limit, 10) : 80,
    });
  });

  fastify.get("/:telefono", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const conv = await syncBotPausa(phone);
    if (!conv) return reply.code(404).send({ error: "Conversación no encontrada" });
    return conv;
  });

  /** Operador envía mensaje al chofer por WhatsApp */
  fastify.post("/:telefono/mensajes", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const { texto, nota_interna } = request.body ?? {};

    if (!texto?.trim()) {
      return reply.code(400).send({ error: "Falta texto del mensaje" });
    }

    const conv = await convStore.getConversacion(phone);
    if (!conv) {
      return reply.code(404).send({ error: "Conversación no encontrada" });
    }

    if (nota_interna) {
      const updated = await convStore.appendMensaje(
        phone,
        { texto: texto.trim(), tipo: "note" },
        { dir: "in", from: "human" },
      );
      return { ok: true, conversacion: updated, sent: false };
    }

    try {
      await sendWhatsAppMessage({ number: phone, message: texto.trim() });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({
        error: err.message || "No se pudo enviar por WhatsApp",
      });
    }

    const updated = await convStore.appendMensaje(
      phone,
      { texto: texto.trim(), tipo: "text" },
      { dir: "out", from: "human" },
    );

    return { ok: true, conversacion: updated, sent: true };
  });

  /** Pausar bot automático — operador toma la conversación */
  fastify.patch("/:telefono/bot-pausado", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const { pausado } = request.body ?? {};

    if (typeof pausado !== "boolean") {
      return reply.code(400).send({ error: "pausado debe ser boolean" });
    }

    const conv = await convStore.setBotPausado(phone, pausado);

    try {
      await setBuilderBotBlacklist(phone, pausado ? "add" : "remove");
    } catch (err) {
      request.log.warn(err, "blacklist BuilderBot opcional falló");
    }

    return { ...conv, bot_pausa_auto_min: BOT_PAUSA_INACTIVIDAD_MIN };
  });
}
