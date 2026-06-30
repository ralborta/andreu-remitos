import {
  downloadMedia,
  mensajeProcesandoRemito,
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
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";
import { ingestarRemito, obtenerRemito, actualizarCampos } from "../services/remitos.mjs";
import { procesarRespuestaDestinoCliente } from "../services/destinos.mjs";
import * as destinosStore from "../db/destinos-store.mjs";

/** En modo IA (webhook de proyecto BB), no devolvemos texto al chofer — responde add_chatpdf. */
const webhookSilent = process.env.BUILDERBOT_WEBHOOK_SILENT !== "false";

function respuestaWebhook({ message = "", ...rest } = {}) {
  if (webhookSilent) return { received: true, ...rest };
  return { message, ...rest };
}

/** Tras OCR: avisa al chofer por WhatsApp (API BB) y guarda en /contactos. */
async function notificarChofer(phone, message, { tenant, remito_id, log } = {}) {
  if (!phone || !message?.trim()) return false;
  try {
    await sendWhatsAppMessage({ number: phone, message });
    await convStore.appendMensaje(
      phone,
      { texto: message, tipo: "text", remito_id: remito_id ?? null },
      { tenant, remito_id, dir: "out", from: "bot" },
    );
    return true;
  } catch (err) {
    log?.warn?.({ err: err.message, phone }, "No se pudo enviar WhatsApp al chofer");
    return false;
  }
}

function mapCorreccionCampo(tenant, campo) {
  if (tenant === "beraldi") {
    if (campo === "patente_chasis") return "tractor";
    if (campo === "patente_acoplado") return "semi";
  }
  if (tenant === "corina") {
    if (campo === "patente_chasis" || campo === "dominio" || campo === "patente") return "tractor";
    if (campo === "patente_acoplado") return "semi";
    if (campo === "chofer") return "conductor";
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
    return respuestaWebhook({
      flow: "bot_pausado",
      hint: "Bot pausado — operador responde desde Contactos",
    });
  }

  const correccion = parseCorreccionChofer(texto);

  if (correccion && conv?.ultimo_remito_id) {
    if (correccion.campo === "_confirmacion") {
      const msg = "✅ Perfecto, queda registrado. ¡Buen viaje!";
      if (!webhookSilent) {
        await convStore.appendMensaje(phone, { texto: msg, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
      }
      return respuestaWebhook({ message: msg, flow: "confirmado" });
    }

    const remito = await obtenerRemito(conv.ultimo_remito_id);
    if (remito) {
      const campo = mapCorreccionCampo(remito.tenant, correccion.campo);
      const updated = await actualizarCampos(remito.id, { [campo]: correccion.valor });
      const msg = mensajeCorreccionAplicada(correccion, updated?.datos);
      if (!webhookSilent) {
        await convStore.appendMensaje(
          phone,
          { texto: msg, tipo: "text", remito_id: remito.id },
          { tenant: remito.tenant, remito_id: remito.id, dir: "out", from: "bot" },
        );
      }
      return respuestaWebhook({ message: msg, flow: "correccion", remito_id: remito.id });
    }
  }

  const ayuda =
    ev.message?.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("guia") ||
    texto.toLowerCase().includes("guía")
      ? "Enviame una *foto clara del remito* o un *audio* con la corrección (ej: km finales 71221)."
      : mensajeSaludo(tenantCfg);

  if (phone && !webhookSilent) {
    await convStore.appendMensaje(phone, { texto: ayuda, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
  }

  return respuestaWebhook({
    message: ayuda,
    flow: conv?.ultimo_remito_id ? "esperando_correccion_o_foto" : "esperando_foto",
  });
}

async function tryProcesarDestinos(ev, { texto, log } = {}) {
  if (!ev.from) return null;
  const pending = await destinosStore.getDestinoPendientePorTelefono(ev.from);
  if (!pending) return null;
  if (!ev.location && !String(texto ?? "").trim()) {
    return { flow: "destinos_sin_contenido", destino: pending };
  }

  try {
    return await procesarRespuestaDestinoCliente(ev.from, {
      texto,
      lat: ev.location?.lat,
      lng: ev.location?.lng,
      nombre: ev.nombre,
      log,
    });
  } catch (err) {
    log?.error?.({ err: err.message, from: ev.from }, "destinos webhook error");
    const msg =
      `No pude ubicar esa dirección.\n\n` +
      `Escribí *calle, número y ciudad* (ej: Echeverría 1200, Pacheco) o enviá tu ubicación 📌`;
    if (ev.from) {
      await sendWhatsAppMessage({ number: ev.from, message: msg }).catch(() => {});
      await convStore.appendMensaje(
        ev.from,
        { texto: msg, tipo: "text", destino_id: pending?.id ?? null },
        { dir: "out", from: "bot" },
      );
    }
    return {
      flow: "destinos_error",
      error: err.message,
      destino: pending,
      message: msg,
    };
  }
}

export default async function webhooksRoutes(fastify) {
  fastify.get("/builderbot/health", async () => ({
    ok: true,
    channel: "whatsapp-builderbot",
    endpoint: "POST /api/webhooks/builderbot",
    features: ["foto", "audio", "correcciones", "destinos"],
  }));

  fastify.post("/builderbot", async (request, reply) => {
    const ev = normalizeBuilderBotPayload(request.body);
    request.log.info({ event: ev.event, eventName: ev.eventName, from: ev.from, hasMedia: !!ev.media?.url }, "webhook BB");

    const tenantCfg = resolveTenant(ev.from, ev.tenant);

    try {
      if (ev.event === "status") {
        return { received: true, event: ev.event };
      }

      // Respuestas del agente IA (message.outgoing) — solo historial para /contactos
      if (ev.event === "outgoing") {
        if (ev.from && (ev.message || ev.media?.url)) {
          await convStore.appendMensaje(
            ev.from,
            {
              texto: ev.message || (ev.media?.name ? `[${ev.media.name}]` : "[Archivo adjunto]"),
              tipo: ev.media?.url && /audio/i.test(ev.media.mime_type ?? "") ? "audio" : ev.media?.url ? "image" : "text",
              imagen_url: ev.media?.url ?? null,
            },
            { tenant: tenantCfg, nombre: ev.nombre, dir: "out", from: "bot" },
          );
        }
        return respuestaWebhook({ ok: true, event: "outgoing" });
      }

      const texto = ev.message?.trim() || "";

      // Destinos primero — cliente en validación no debe caer en flujo de remitos
      const destinoOut = await tryProcesarDestinos(ev, { texto, log: request.log });
      if (destinoOut) {
        return respuestaWebhook({ ...destinoOut, received: true });
      }

      // Audio — si hay destino pendiente, transcribir y procesar como corrección
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

        const destinoAudio = await tryProcesarDestinos(ev, {
          texto: transcripcion,
          log: request.log,
        });
        if (destinoAudio) {
          return respuestaWebhook({ ...destinoAudio, transcripcion, flow: destinoAudio.flow ?? "destinos_audio" });
        }

        const out = await procesarTextoChofer(ev, tenantCfg, transcripcion);
        return respuestaWebhook({ ...out, transcripcion, flow: out.flow ?? "audio" });
      }

      // Foto — solo remitos si NO hay destino pendiente para este número
      if (ev.media?.url && !esAudioMime(ev.media.mime_type)) {
        const destinoPendiente = ev.from
          ? await destinosStore.getDestinoPendientePorTelefono(ev.from)
          : null;
        if (destinoPendiente) {
          const hint =
            "Recibí una imagen, pero estoy esperando que confirmes el *destino*.\n" +
            "Respondé *SÍ*, escribí la dirección corregida, o enviá tu ubicación 📌";
          if (ev.from) {
            await sendWhatsAppMessage({ number: ev.from, message: hint }).catch(() => {});
          }
          return respuestaWebhook({ flow: "destinos_esperando_texto", destino_id: destinoPendiente.id });
        }
        const telefono = ev.from || null;

        if (ev.from) {
          await convStore.appendMensaje(
            ev.from,
            { texto: ev.message || "envía imagen", tipo: "image", imagen_url: ev.media.url },
            { tenant: tenantCfg, nombre: ev.nombre },
          );
        }

        const pausado = ev.from ? (await convStore.getConversacion(ev.from))?.bot_pausado : false;

        if (ev.from && !pausado) {
          await notificarChofer(ev.from, mensajeProcesandoRemito(), {
            tenant: tenantCfg,
            log: request.log,
          });
        }

        const { buffer, filename } = await downloadMedia(ev.media.url);
        const resultado = await ingestarRemito(buffer, {
          filename,
          telefono,
          tenantForzado: tenantCfg ?? undefined,
        });

        const message = mensajeWhatsApp(resultado);

        if (ev.from && !pausado) {
          await notificarChofer(ev.from, message, {
            tenant: resultado.tenant,
            remito_id: resultado.id,
            log: request.log,
          });
        } else if (ev.from && resultado.id) {
          await convStore.appendMensaje(
            ev.from,
            { texto: message, tipo: "text", remito_id: resultado.id },
            { tenant: resultado.tenant, remito_id: resultado.id, dir: "out", from: "bot" },
          );
        }

        return respuestaWebhook({
          message,
          remito_id: resultado.id,
          tenant: resultado.tenant,
          estado: resultado.estado,
          guia: resultado.lectura?.nro_guia ?? resultado.lectura?.nro_remito ?? null,
          flow: resultado.estado === "bloqueado" ? "revision" : "ok",
          bot_pausado: pausado,
        });
      }

      if (!texto && !ev.media?.url && !ev.location) {
        return respuestaWebhook({ ok: true, message: "Mensaje vacío, ignorado" });
      }
      if (!texto) {
        return respuestaWebhook({ flow: ev.location ? "ubicacion_sin_pendiente" : "esperando_foto" });
      }

      return procesarTextoChofer(ev, tenantCfg, texto);
    } catch (err) {
      request.log.error(err);
      const destinoPendiente = ev.from
        ? await destinosStore.getDestinoPendientePorTelefono(ev.from)
        : null;
      const errMsg = destinoPendiente
        ? "Hubo un problema al procesar tu respuesta sobre el destino. Probá de nuevo con calle, número y ciudad."
        : ev.event === "audio"
          ? "No pude entender el audio. Probá de nuevo más claro, o escribí la corrección."
          : "No pude leer el remito. Probá con mejor luz, sin sombras, y que se vea la guía completa.";

      const pausadoErr = ev.from ? (await convStore.getConversacion(ev.from))?.bot_pausado : false;
      if (ev.from && !pausadoErr) {
        await notificarChofer(ev.from, errMsg, { tenant: tenantCfg, log: request.log });
      } else if (ev.from) {
        await convStore.appendMensaje(ev.from, { texto: errMsg, tipo: "text" }, { tenant: tenantCfg, dir: "out", from: "bot" });
      }

      return reply.code(200).send(
        respuestaWebhook({
          message: errMsg,
          error: err.message,
          flow: "error",
        }),
      );
    }
  });
}
