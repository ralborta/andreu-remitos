import * as convStore from "../db/conversations-store.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

export default async function conversacionesRoutes(fastify) {
  fastify.get("/", async (request) => {
    const { tenant, limit } = request.query;
    return convStore.listConversaciones({
      tenant: tenant || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  });

  fastify.get("/:telefono", async (request, reply) => {
    const phone = sanitizePhone(request.params.telefono);
    const conv = await convStore.getConversacion(phone);
    if (!conv) return reply.code(404).send({ error: "Conversación no encontrada" });
    return conv;
  });
}
