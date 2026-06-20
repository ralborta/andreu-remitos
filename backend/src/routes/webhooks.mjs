import {
  downloadMedia,
  mensajeSaludo,
  mensajeWhatsApp,
  normalizeBuilderBotPayload,
  resolveTenant,
} from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import { ingestarRemito } from "../services/remitos.mjs";

export default async function webhooksRoutes(fastify) {
  fastify.get("/builderbot/health", async () => ({
    ok: true,
    channel: "whatsapp-builderbot",
    endpoint: "POST /api/webhooks/builderbot",
  }));

  /**
   * BuilderBot Cloud → add_http o webhook externo cuando el chofer manda foto.
   * Respuesta JSON: { message: "..." } → BB se lo manda al chofer.
   */
  fastify.post("/builderbot", async (request, reply) => {
    const ev = normalizeBuilderBotPayload(request.body);
    const tenantCfg = resolveTenant(ev.from, ev.tenant);

    try {
      if (ev.event === "outgoing" || ev.event === "status") {
        return { received: true, event: ev.event };
      }

      // Texto sin foto
      if (!ev.media?.url) {
        const ayuda =
          ev.message?.toLowerCase().includes("remito") ||
          ev.message?.toLowerCase().includes("guia") ||
          ev.message?.toLowerCase().includes("guía")
            ? "Enviame una *foto clara del remito* (guía completa, buena luz) y lo proceso al instante."
            : mensajeSaludo(tenantCfg);

        if (ev.from && ev.message) {
          await convStore.appendMensaje(ev.from, { texto: ev.message, tipo: "text" }, { tenant: tenantCfg, nombre: ev.nombre });
        }
        if (ev.from) {
          await convStore.appendMensaje(ev.from, { texto: ayuda, tipo: "text" }, { tenant: tenantCfg, dir: "out" });
        }

        return { message: ayuda, flow: "esperando_foto" };
      }

      const telefono = ev.from || null;

      if (ev.from) {
        await convStore.appendMensaje(
          ev.from,
          { texto: ev.message || "envía imagen", tipo: "image", imagen_url: ev.media.url },
          { tenant: tenantCfg, nombre: ev.nombre },
        );
      }

      const { buffer, filename } = await downloadMedia(ev.media.url);

      const resultado = await ingestarRemito(buffer, {
        filename,
        telefono,
        tenantForzado: tenantCfg ?? undefined,
      });

      const message = mensajeWhatsApp(resultado);

      if (ev.from) {
        await convStore.appendMensaje(
          ev.from,
          { texto: message, tipo: "text", remito_id: resultado.id },
          { tenant: resultado.tenant, remito_id: resultado.id, dir: "out" },
        );
      }

      return {
        message,
        remito_id: resultado.id,
        tenant: resultado.tenant,
        estado: resultado.estado,
        guia: resultado.lectura?.nro_guia ?? resultado.lectura?.nro_remito ?? null,
        flow: resultado.estado === "bloqueado" ? "revision" : "ok",
      };
    } catch (err) {
      request.log.error(err);
      const errMsg =
        "No pude leer el remito. Probá con mejor luz, sin sombras, y que se vea la guía completa.";

      if (ev.from) {
        await convStore.appendMensaje(ev.from, { texto: errMsg, tipo: "text" }, { tenant: tenantCfg, dir: "out" });
      }

      return reply.code(200).send({
        message: errMsg,
        error: err.message,
        flow: "error",
      });
    }
  });
}
