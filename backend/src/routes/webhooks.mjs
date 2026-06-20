import {
  downloadMedia,
  mensajeWhatsApp,
  normalizeBuilderBotPayload,
  resolveTenant,
} from "../../../lib/builderbot-webhook.mjs";
import { ingestarRemito } from "../services/remitos.mjs";

export default async function webhooksRoutes(fastify) {
  fastify.get("/builderbot/health", async () => ({
    ok: true,
    channel: "whatsapp-builderbot",
  }));

  /**
   * BuilderBot Cloud → POST cuando el chofer manda foto por WhatsApp.
   * Configurar en BB: Petición HTTP → URL de este endpoint.
   * Variables útiles en el body: tenant (tsb|beraldi), from viene automático.
   */
  fastify.post("/builderbot", async (request, reply) => {
    try {
      const ev = normalizeBuilderBotPayload(request.body);

      if (ev.event === "outgoing" || ev.event === "status") {
        return { received: true, event: ev.event };
      }

      if (!ev.media?.url) {
        const ayuda =
          ev.message?.toLowerCase().includes("remito") || ev.message?.toLowerCase().includes("guia")
            ? "Enviame una *foto clara del remito* (guía TSB o remito Beraldi) y lo proceso al instante."
            : "Hola 👋 Soy el bot de remitos. Mandame una *foto del remito* para cargarlo.";
        return {
          message: ayuda,
          flow: "esperando_foto",
        };
      }

      const telefono = ev.from || null;
      const tenantExplicito = resolveTenant(telefono, ev.tenant);

      const { buffer, filename } = await downloadMedia(ev.media.url);

      const resultado = await ingestarRemito(buffer, {
        filename,
        telefono,
        tenantForzado: tenantExplicito ?? undefined,
      });

      const message = mensajeWhatsApp(resultado);

      return {
        message,
        remito_id: resultado.id,
        tenant: resultado.tenant,
        estado: resultado.estado,
        guia:
          resultado.lectura?.nro_guia ??
          resultado.lectura?.nro_remito ??
          null,
        flow: resultado.estado === "bloqueado" ? "revision" : "ok",
      };
    } catch (err) {
      request.log.error(err);
      return reply.code(200).send({
        message:
          "No pude leer el remito. Probá con mejor luz, sin sombras, y que se vea la guía completa.",
        error: err.message,
        flow: "error",
      });
    }
  });
}
