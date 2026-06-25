import {
  downloadMedia,
  mensajeSaludo,
  mensajeWhatsApp,
  normalizeBuilderBotPayload,
  resolveTenant,
} from "../../../lib/builderbot-webhook.mjs";
import {
  mensajeCorreccionAplicada,
  parseCorreccionChofer,
} from "../../../lib/correcciones-chofer.mjs";
import { transcribirAudio, esAudioMime } from "../../../lib/transcribe-audio.mjs";
import * as convStore from "../db/conversations-store.mjs";
import { ingestarRemito, obtenerRemito, actualizarCampos } from "../services/remitos.mjs";

function mapCorreccionCampo(tenant, campo) {
  if (tenant === "beraldi") {
    if (campo === "patente_chasis") return "tractor";
    if (campo === "patente_acoplado") return "semi";
  }
  if (tenant === "tsb") {
    if (campo === "patente_chasis") return "chasis";
    if (campo === "patente_acoplado") return "acoplado";
  }
  return campo;
}

async function procesarTextoChofer(ev, tenantCfg, texto) {
  const phone = ev.from;
  const conv = phone ? await convStore.getConversacion(phone) : null;
  const pausado = conv?.bot_pausado;

  if (phone && texto) {
    await convStore.appendMensaje(
      phone,
      { texto, tipo: "text" },
      { tenant: tenantCfg, nombre: ev.nombre },
    );
  }

  if (pausado) {
    return {
      message: "",
      flow: "bot_pausado",
      hint: "Bot pausado — operador responde desde Contactos",
    };
  }

  const correccion = parseCorreccionChofer(texto);

  if (correccion && conv?.ultimo_remito_id) {
    if (correccion.campo === "_confirmacion") {
      const msg = "✅ Perfecto, queda registrado. ¡Buen viaje!";
      await convStore.appendMensaje(phone, { texto: msg, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
      return { message: msg, flow: "confirmado" };
    }

    const remito = await obtenerRemito(conv.ultimo_remito_id);
    if (remito) {
      const campo = mapCorreccionCampo(remito.tenant, correccion.campo);
      const updated = await actualizarCampos(remito.id, { [campo]: correccion.valor });
      const msg = mensajeCorreccionAplicada(correccion, updated?.datos);
      await convStore.appendMensaje(
        phone,
        { texto: msg, tipo: "text", remito_id: remito.id },
        { tenant: remito.tenant, remito_id: remito.id, dir: "out", from: "bot" },
      );
      return { message: msg, flow: "correccion", remito_id: remito.id };
    }
  }

  const ayuda =
    ev.message?.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("guia") ||
    texto.toLowerCase().includes("guía")
      ? "Enviame una *foto clara del remito* o un *audio* con la corrección (ej: km finales 71221)."
      : mensajeSaludo(tenantCfg);

  if (phone) {
    await convStore.appendMensaje(phone, { texto: ayuda, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
  }

  return { message: ayuda, flow: conv?.ultimo_remito_id ? "esperando_correccion_o_foto" : "esperando_foto" };
}

export default async function webhooksRoutes(fastify) {
  fastify.get("/builderbot/health", async () => ({
    ok: true,
    channel: "whatsapp-builderbot",
    endpoint: "POST /api/webhooks/builderbot",
    features: ["foto", "audio", "correcciones"],
  }));

  fastify.post("/builderbot", async (request, reply) => {
    const ev = normalizeBuilderBotPayload(request.body);
    const tenantCfg = resolveTenant(ev.from, ev.tenant);

    try {
      if (ev.event === "outgoing" || ev.event === "status") {
        return { received: true, event: ev.event };
      }

      // Audio (nota de voz)
      if (ev.event === "audio" && ev.media?.url) {
        const { buffer, mime, filename } = await downloadMedia(ev.media.url);
        const transcripcion = await transcribirAudio(buffer, { mimeType: mime, filename });

        if (ev.from) {
          await convStore.appendMensaje(
            ev.from,
            {
              texto: transcripcion,
              tipo: "audio",
              imagen_url: ev.media.url,
              transcripcion,
            },
            { tenant: tenantCfg, nombre: ev.nombre },
          );
        }

        const out = await procesarTextoChofer(ev, tenantCfg, transcripcion);
        return { ...out, transcripcion, flow: out.flow ?? "audio" };
      }

      // Foto / imagen remito
      if (ev.media?.url && !esAudioMime(ev.media.mime_type)) {
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
        const pausado = ev.from ? (await convStore.getConversacion(ev.from))?.bot_pausado : false;

        if (ev.from) {
          await convStore.appendMensaje(
            ev.from,
            { texto: message, tipo: "text", remito_id: resultado.id },
            { tenant: resultado.tenant, remito_id: resultado.id, dir: "out", from: "bot" },
          );
        }

        return {
          message: pausado ? "" : message,
          remito_id: resultado.id,
          tenant: resultado.tenant,
          estado: resultado.estado,
          guia: resultado.lectura?.nro_guia ?? resultado.lectura?.nro_remito ?? null,
          flow: resultado.estado === "bloqueado" ? "revision" : "ok",
        };
      }

      // Texto
      const texto = ev.message?.trim() || "";
      if (!texto) {
        const msg = mensajeSaludo(tenantCfg);
        return { message: msg, flow: "esperando_foto" };
      }

      return procesarTextoChofer(ev, tenantCfg, texto);
    } catch (err) {
      request.log.error(err);
      const errMsg =
        ev.event === "audio"
          ? "No pude entender el audio. Probá de nuevo más claro, o escribí la corrección."
          : "No pude leer el remito. Probá con mejor luz, sin sombras, y que se vea la guía completa.";

      if (ev.from) {
        await convStore.appendMensaje(ev.from, { texto: errMsg, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
      }

      return reply.code(200).send({
        message: errMsg,
        error: err.message,
        flow: "error",
      });
    }
  });
}
