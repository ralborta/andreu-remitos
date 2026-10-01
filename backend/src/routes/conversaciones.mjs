import { sendWhatsAppMessage, sendWhatsAppTyping, setBuilderBotBlacklist } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import { syncBotPausa, BOT_PAUSA_INACTIVIDAD_MIN } from "../../../lib/bot-pausa.mjs";
import * as convStore from "../db/conversations-store.mjs";

export default async function conversacionesRoutes(fastify) {
  fastify.get("/", async (request) => {
    const { tenant, limit } = request.query;
    const lim = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    const list = await convStore.listConversaciones({
      tenant: tenant || undefined,
      limit: lim,
    });
    // Solo revisa pausa en los de esta página (no vuelve a leer todo el JSON).
    for (const c of list) {
      if (!c.bot_pausado) continue;
      const synced = await syncBotPausa(c.telefono);
      if (synced) c.bot_pausado = Boolean(synced.bot_pausado);
    }
    return list;
  });

  fastify.get("/:telefono", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const rawLim = request.query?.mensajes_limit ?? request.query?.mensajesLimit;
    const mensajesLimit = rawLim != null ? Math.min(parseInt(rawLim, 10) || 80, 300) : 80;
    await syncBotPausa(phone);
    const conv = await convStore.getConversacion(phone, { mensajesLimit });
    if (!conv) return reply.code(404).send({ error: "Conversación no encontrada" });
    return conv;
  });

  /** Operador escribe — avisa "composing" al chofer en WhatsApp (Baileys) */
  fastify.post("/:telefono/typing", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const conv = await convStore.getConversacion(phone);
    if (!conv) {
      return reply.code(404).send({ error: "Conversación no encontrada" });
    }

    try {
      await sendWhatsAppTyping(phone);
      return { ok: true };
    } catch (err) {
      request.log.warn(err, "typing WhatsApp falló");
      return reply.code(502).send({
        error: err.message || "No se pudo enviar indicador de escritura",
      });
    }
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
