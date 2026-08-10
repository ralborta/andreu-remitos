import * as etaStore from "../db/eta-store.mjs";
import {
  avisarDemoraDesdeIncidencia,
  listarColaEta,
  notificarDesdeDestino,
  resumenEta,
} from "../services/eta-agent.mjs";

export default async function etaRoutes(fastify) {
  fastify.get("/meta", async () => ({
    nota:
      "Agente ETA: se comunica con Viajes e Incidencias. Notifica estimados y demoras al cliente por WhatsApp.",
    colaboraCon: ["viajes", "incidencias", "destinos"],
  }));

  fastify.get("/resumen", async () => resumenEta());

  fastify.get("/", async (request) => {
    const { limit } = request.query ?? {};
    return listarColaEta({ limit: limit ? Number(limit) : 60 });
  });

  fastify.get("/notificaciones", async (request) => {
    const { limit } = request.query ?? {};
    return etaStore.listNotificaciones({ limit: limit ? Number(limit) : 40 });
  });

  fastify.post("/destino/:id/notificar", async (request, reply) => {
    try {
      const demora = Boolean(request.body?.demora);
      const etaTexto = request.body?.etaTexto || request.body?.eta_texto;
      return await notificarDesdeDestino(request.params.id, { demora, etaTexto });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });

  fastify.post("/incidencia/:id/avisar", async (request, reply) => {
    try {
      const etaTexto = request.body?.etaTexto || request.body?.eta_texto;
      return await avisarDemoraDesdeIncidencia(request.params.id, { etaTexto });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
