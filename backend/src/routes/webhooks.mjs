import {
  downloadMedia,
  mensajeEsperandoCorreccion,
  mensajeAudioSoloConfirmacion,
  mensajeAudioFallidoConfirmacion,
  mensajeAudioSinCorreccion,
  mensajeProcesandoRemito,
  mensajeSaludo,
  mensajeCorinaListoParaFoto,
  mensajeCorinaFaltaCliente,
  parseClienteMarcaCorina,
  mensajeWhatsApp,
  normalizeBuilderBotPayload,
  resolveTenant,
  esEventoAudio,
} from "../../../lib/builderbot-webhook.mjs";
import {
  mensajeCorreccionesAplicadas,
  buildPatchFromCorrecciones,
  resolveCorreccionesChofer,
} from "../../../lib/correcciones-chofer.mjs";
import { transcribirAudio } from "../../../lib/transcribe-audio.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { syncBotPausa } from "../../../lib/bot-pausa.mjs";
import * as convStore from "../db/conversations-store.mjs";
import { ingestarRemito, obtenerRemito, actualizarCampos } from "../services/remitos.mjs";
import {
  procesarRespuestaDestinoCliente,
  procesarRespuestaDestinoChofer,
} from "../services/destinos.mjs";
import { procesarMensajeViajeWhatsApp } from "../services/viajes-agent.mjs";
import { procesarGastoWhatsApp } from "../services/rendicion-agent.mjs";
import { clasificarIntencionWhatsApp } from "../../../lib/wa-intent-router.mjs";
import { procesarReclamoWhatsApp } from "../../../lib/reclamos-wa.mjs";
import {
  extractCodigoReclamo,
  pareceConsultaEstadoReclamo,
} from "../../../lib/reclamos.mjs";
import { pareceRendicionGasto } from "../../../lib/rendicion-wa.mjs";
import * as destinosStore from "../db/destinos-store.mjs";
import * as solViajesStore from "../db/viajes-solicitudes-store.mjs";
import * as reclamosStore from "../db/reclamos-store.mjs";
import * as master from "../db/master-data-store.mjs";

/**
 * Con Baileys self-hosted el envío confiable es POST /v1/messages.
 * fallBack del bot falla seguido con contactos nuevos (sesión Signal).
 * Si hay BAILEYS_BOT_URL: enviamos por API y no devolvemos `message` al bot
 * (evita doble envío y el canal frágil).
 */
const baileysBotUrl = process.env.BAILEYS_BOT_URL?.trim() || "";
const webhookSilent =
  Boolean(baileysBotUrl) || process.env.BUILDERBOT_WEBHOOK_SILENT !== "false";

function respuestaWebhook({ message = "", ...rest } = {}) {
  if (webhookSilent) return { received: true, ...rest };
  return { message, ...rest };
}

/** Tras OCR: avisa al chofer por WhatsApp y guarda en /contactos. */
async function notificarChofer(phone, message, { tenant, remito_id, log } = {}) {
  if (!phone || !message?.trim()) return false;
  try {
    // silent (o Baileys): enviar por API. Si no, el bot manda vía fallBack.
    if (webhookSilent) {
      await sendWhatsAppMessage({ number: phone, message });
    }
    await convStore.appendMensaje(
      phone,
      { texto: message, tipo: "text", remito_id: remito_id ?? null },
      { tenant, remito_id, dir: "out", from: "bot" },
    );
    return true;
  } catch (err) {
    log?.warn?.({ err: err.message, phone }, "No se pudo enviar WhatsApp al chofer");
    // Igual persistimos para que Contactos muestre lo que el agente “dijo”.
    try {
      await convStore.appendMensaje(
        phone,
        { texto: message, tipo: "text", remito_id: remito_id ?? null },
        { tenant, remito_id, dir: "out", from: "bot" },
      );
    } catch {
      /* ignore */
    }
    return false;
  }
}


async function resolverRemitoCorreccion(phone, conv, tenantCfg) {
  void tenantCfg;
  void phone;
  let activoId = conv?.remito_en_revision_id ?? null;
  if (
    !activoId &&
    conv?.ultimo_remito_id &&
    conv.ultimo_remito_id !== conv.remito_cerrado_id
  ) {
    activoId = conv.ultimo_remito_id;
  }
  if (!activoId) return null;
  return obtenerRemito(activoId);
}

function flujoRemitoAbierto(conv) {
  if (conv?.remito_en_revision_id) return true;
  return Boolean(
    conv?.ultimo_remito_id && conv.ultimo_remito_id !== conv.remito_cerrado_id,
  );
}

function esConfirmacionOk(texto) {
  const raw = String(texto ?? "").trim();
  if (!raw) return false;
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.!?,¿¡]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(ok|okey|okay|dale|listo|correcto|confirmo|confirmado|perfecto|si|todo bien|esta bien|de acuerdo|claro|joya|genial)$/.test(t)) {
    return true;
  }
  if (/^(si|sí)\s+(dale|listo|ok|esta bien|correcto)?$/.test(t)) return true;
  if (/^(ok|listo|dale|correcto|confirmo|todo bien)(\s+(ok|listo|dale|perfecto|gracias))?$/.test(t)) return true;
  if (/\b(ok|listo|correcto|confirmo|todo bien|esta bien)\b/.test(t) && t.split(" ").length <= 5) return true;
  return false;
}

function esNegacion(texto) {
  return /^(no|nop|nope|incorrecto|mal|est[aá]\s*mal|no\s+est[aá]|negativo)$/i.test(
    String(texto ?? "").trim(),
  );
}

function dedupeCorrecciones(lista) {
  const seen = new Set();
  const out = [];
  for (const c of lista) {
    if (!c || c.campo === "_confirmacion" || seen.has(c.campo)) continue;
    seen.add(c.campo);
    out.push(c);
  }
  return out;
}

async function aplicarCorreccionesChofer({ phone, conv, tenantCfg, correcciones, pausado, log }) {
  const remito = await resolverRemitoCorreccion(phone, conv, tenantCfg);
  if (!remito) {
    log?.warn?.({ phone, n: correcciones.length }, "Correcciones detectadas pero sin remito vinculado");
    return null;
  }

  const patch = buildPatchFromCorrecciones(remito.tenant, correcciones, remito.datos);
  const updated = await actualizarCampos(remito.id, patch);
  if (!updated) {
    log?.warn?.({ remito_id: remito.id, patch }, "No se pudo persistir correcciones en remito");
    return null;
  }

  await convStore.setUltimoRemito(phone, remito.id, remito.tenant);
  await convStore.clearCorreccionesPendientes(phone);

  const msg = mensajeCorreccionesAplicadas(correcciones, updated.datos);
  log?.info?.(
    { remito_id: remito.id, campos: correcciones.map((c) => c.campo), patch, pausado },
    "Correcciones WhatsApp persistidas en remito",
  );

  if (phone && !pausado) {
    await notificarChofer(phone, msg, { tenant: remito.tenant, remito_id: remito.id, log });
  }

  return { message: msg, flow: "correccion", remito_id: remito.id, persisted: true, campos: correcciones.length };
}

async function aplicarConfirmacionChofer({ phone, conv, tenantCfg, pausado, log }) {
  const remito = await resolverRemitoCorreccion(phone, conv, tenantCfg);
  if (!remito) return null;

  // Solo correcciones pendientes (las ya enviadas se aplicaron al recibirlas).
  const pendientes = dedupeCorrecciones(conv?.correcciones_pendientes ?? []);
  if (pendientes.length > 0) {
    log?.info?.(
      { remito_id: remito.id, campos: pendientes.map((c) => c.campo) },
      "OK del chofer — aplicando correcciones pendientes",
    );
    return aplicarCorreccionesChofer({ phone, conv, tenantCfg, correcciones: pendientes, pausado, log });
  }

  const msg = "✅ Perfecto, queda registrado. ¡Buen viaje!";
  if (phone && !pausado) {
    await notificarChofer(phone, msg, { tenant: tenantCfg, remito_id: remito.id, log });
  }
  await convStore.clearCorreccionesPendientes(phone);
  await convStore.clearRemitoEnRevision(phone);
  return { message: msg, flow: "confirmado", remito_id: remito.id };
}

async function procesarTextoChofer(ev, tenantCfg, texto, log, { remitoCtx: remitoCtxIn = null } = {}) {
  const phone = ev.from;
  if (phone) await syncBotPausa(phone);

  if (phone && texto) {
    await convStore.appendMensaje(
      phone,
      { texto, tipo: "text" },
      { tenant: tenantCfg, nombre: ev.nombre },
    );
  }

  const conv = phone ? await convStore.getConversacion(phone) : null;
  const pausado = conv?.bot_pausado;
  const remitoCtx = remitoCtxIn ?? (await resolverRemitoCorreccion(phone, conv, tenantCfg));
  const tenantEfectivo = remitoCtx?.tenant ?? tenantCfg ?? conv?.tenant;
  const choferRemitos = phone ? await master.resolverChoferPorTelefono(phone) : null;

  // El flujo/saludo de remitos SOLO es para choferes registrados en Parámetros/Remitos
  if (!choferRemitos && !flujoRemitoAbierto(conv)) {
    const msg =
      `Hola 👋 ¿En qué te puedo ayudar?\n\n` +
      `• *Viaje / flete* — pedir transporte\n` +
      `• *Reclamo* — demora, faltante, daño…\n\n` +
      `Contame qué necesitás.`;
    if (phone && !pausado) {
      await notificarChofer(phone, msg, { tenant: null, log });
    }
    return respuestaWebhook({ message: msg, flow: "no_chofer_remitos" });
  }

  // Corina: elegir Cervecería vs Eco antes de la foto / sin remito abierto
  if (tenantEfectivo === "corina" && phone && !flujoRemitoAbierto(conv)) {
    const marcaParseada = parseClienteMarcaCorina(texto);
    if (marcaParseada) {
      await convStore.setCorinaClienteMarca(phone, marcaParseada);
      const msg = mensajeCorinaListoParaFoto(marcaParseada);
      if (!pausado) await notificarChofer(phone, msg, { tenant: "corina", log });
      return respuestaWebhook({ message: msg, flow: "corina_cliente_ok", cliente_marca: marcaParseada });
    }
    if (!conv?.corina_cliente_marca) {
      const msg = mensajeSaludo("corina", choferRemitos?.nombre);
      if (!pausado) await notificarChofer(phone, msg, { tenant: "corina", log });
      return respuestaWebhook({ message: msg, flow: "corina_esperando_cliente" });
    }
  }

  if (esConfirmacionOk(texto)) {
    const out = await aplicarConfirmacionChofer({ phone, conv, tenantCfg, pausado, log });
    if (out) {
      return respuestaWebhook({ ...out, bot_pausado: pausado });
    }
    const msg = "✅ Ya quedó registrado. ¡Buen viaje!";
    if (phone && !pausado) {
      await notificarChofer(phone, msg, { tenant: tenantCfg, log });
    }
    return respuestaWebhook({ message: msg, flow: "confirmado_repetido" });
  }

  if (esNegacion(texto) && remitoCtx && flujoRemitoAbierto(conv)) {
    const msg = mensajeEsperandoCorreccion(remitoCtx);
    if (phone && !pausado) {
      await notificarChofer(phone, msg, {
        tenant: remitoCtx.tenant,
        remito_id: remitoCtx.id,
        log,
      });
    }
    return respuestaWebhook({ message: msg, flow: "esperando_correccion", remito_id: remitoCtx.id });
  }

  const correcciones = await resolveCorreccionesChofer(texto, {
    tenant: remitoCtx?.tenant ?? tenantCfg,
    datos: remitoCtx?.datos,
    remitoVinculado: Boolean(remitoCtx),
    log,
  });

  if (correcciones.length > 0) {
    if (phone) await convStore.setCorreccionesPendientes(phone, correcciones);
    const out = await aplicarCorreccionesChofer({ phone, conv, tenantCfg, correcciones, pausado, log });
    if (out) {
      return respuestaWebhook({
        ...out,
        bot_pausado: pausado,
        hint: pausado ? "Corrección guardada en remito (bot pausado — sin respuesta automática)" : undefined,
      });
    }
  }

  if (pausado) {
    return respuestaWebhook({
      flow: "bot_pausado",
      hint: "Bot pausado — operador responde desde Contactos",
    });
  }

  const ayuda =
    ev.message?.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("remito") ||
    texto.toLowerCase().includes("guia") ||
    texto.toLowerCase().includes("guía")
      ? "Enviame una *foto clara del remito* con la corrección (ej: km finales 71221)."
      : flujoRemitoAbierto(conv) && remitoCtx
        ? mensajeEsperandoCorreccion(remitoCtx)
        : await (async () => {
              const t = remitoCtx?.tenant ?? tenantCfg ?? conv?.tenant;
              if (t === "corina" && conv?.corina_cliente_marca && !flujoRemitoAbierto(conv)) {
                return mensajeCorinaListoParaFoto(conv.corina_cliente_marca);
              }
              return mensajeSaludo(t, choferRemitos?.nombre);
            })();

  if (phone && !pausado) {
    await notificarChofer(phone, ayuda, { tenant: tenantCfg, log });
  }

  return respuestaWebhook({
    message: ayuda,
    flow: conv?.ultimo_remito_id ? "esperando_correccion_o_foto" : "esperando_foto",
  });
}

async function tryProcesarViajes(ev, { texto, log, conv, forzar = false } = {}) {
  if (!ev.from || !texto?.trim()) return null;
  // Remito abierto solo bloquea si nadie forzó el agente (router IA / pending).
  if (!forzar && flujoRemitoAbierto(conv)) return null;

  const pendingViaje = await solViajesStore.getSolicitudPendientePorTelefono(ev.from);
  // Full IA: solo entra por solicitud pendiente o porque el router IA ya decidió "viaje".
  // No usamos heurística regex para abrir o cerrar el agente.
  if (!pendingViaje && !forzar) return null;

  try {
    const out = await procesarMensajeViajeWhatsApp({
      telefono: ev.from,
      texto,
      nombre: ev.nombre,
      log,
      forzar: true,
    });
    if (!out) return null;
    return {
      ...out,
      message: out.message ?? out.mensaje ?? "",
      received: true,
    };
  } catch (err) {
    log?.warn?.({ err: err.message, from: ev.from }, "viajes webhook error");
    const msg =
      `Recibí tu mensaje de viaje pero tuve un problema: ${err.message}\n\n` +
      `Probá de nuevo o pedí a tráfico que lo cargue.`;
    if (ev.from) {
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    }
    return { flow: "viajes_error", error: err.message, message: msg };
  }
}

async function tryProcesarRendicion(ev, { texto, log, imageBuffer, mime, forzar = false } = {}) {
  if (!ev.from) return null;
  const t = String(texto ?? "").trim();
  if (!forzar && !imageBuffer && !pareceRendicionGasto(t)) return null;
  try {
    const out = await procesarGastoWhatsApp({
      telefono: ev.from,
      texto: t,
      nombre: ev.nombre,
      imageBuffer,
      mime,
      imagenUrl: ev.media?.url || null,
      log,
      forzar: Boolean(forzar || imageBuffer),
    });
    if (!out) return null;
    return { ...out, message: out.message ?? out.mensaje ?? "", received: true };
  } catch (err) {
    log?.warn?.({ err: err.message, from: ev.from }, "rendicion webhook error");
    const msg = `Recibí tu gasto pero tuve un problema: ${err.message}. Probá de nuevo.`;
    if (ev.from) await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return { flow: "rendicion_error", error: err.message, message: msg };
  }
}

async function tryProcesarReclamo(
  ev,
  { texto, log, forzar = false, imageBuffer = null, mime = null } = {},
) {
  const tieneFoto = Boolean(imageBuffer?.length || ev.media?.url);
  if (!ev.from || (!texto?.trim() && !tieneFoto && !forzar)) return null;
  try {
    await convStore.appendMensaje(
      ev.from,
      {
        texto: texto || (tieneFoto ? "[Foto del producto / daño]" : ""),
        tipo: tieneFoto ? "image" : "text",
        imagen_url: ev.media?.url || null,
      },
      { dir: "in", from: "client", nombre: ev.nombre, agente: "reclamos" },
    );
    const out = await procesarReclamoWhatsApp({
      telefono: ev.from,
      texto,
      nombre: ev.nombre,
      log,
      forzar,
      imageBuffer,
      mime,
      imagenUrl: ev.media?.url || null,
    });
    if (!out?.mensaje) return null;
    await notificarChofer(ev.from, out.mensaje, { log, tenant: null }).catch(() => {});
    await convStore.appendMensaje(
      ev.from,
      { texto: out.mensaje, tipo: "text", reclamo_id: out.reclamo?.id },
      { dir: "out", from: "bot", agente: "reclamos", nombre: ev.nombre },
    );
    return { ...out, message: out.mensaje, received: true };
  } catch (err) {
    log?.warn?.({ err: err.message, from: ev.from }, "reclamos webhook error");
    const msg =
      `Recibí tu reclamo pero tuve un problema: ${err.message}.\n` +
      `¿Me lo volvés a contar en un momento?`;
    if (ev.from) await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return { flow: "reclamo_error", error: err.message, message: msg };
  }
}

/**
 * Router IA de inicio: remito (choferes de remitos) vs viaje vs reclamo.
 */
async function enrutarPorIntencion(ev, { texto, conv, log } = {}) {
  if (!ev.from || !texto?.trim()) return null;

  const choferRemitos = await master.resolverChoferPorTelefono(ev.from);
  const esChoferRemitos = Boolean(choferRemitos);

  const intent = await clasificarIntencionWhatsApp({
    texto,
    esChoferRemitos,
    nombre: ev.nombre || choferRemitos?.nombre || null,
    log,
  });

  log?.info?.(
    {
      from: ev.from,
      intent: intent.intent,
      fuente: intent.fuente,
      confianza: intent.confianza,
      esChoferRemitos,
    },
    "WA intent router",
  );

  if (intent.intent === "viaje") {
    const out = await tryProcesarViajes(ev, { texto, log, conv, forzar: true });
    if (out) return out;
    // Último recurso: abrir solicitud para no perder el hilo en el próximo mensaje
    try {
      const pending = await solViajesStore.getSolicitudPendientePorTelefono(ev.from);
      if (!pending) {
        await solViajesStore.crearSolicitud({
          telefono: ev.from,
          nombre: ev.nombre || null,
        });
      }
    } catch (err) {
      log?.warn?.({ err: err.message }, "viajes: no pude abrir solicitud fallback");
    }
    const msg =
      `Perfecto, vamos con tu *viaje*.\n\n` +
      `Pasame origen, destino, toneladas, tipo de carga y fecha/hora de retiro.`;
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    await convStore
      .appendMensaje(
        ev.from,
        { texto: msg, tipo: "text" },
        { dir: "out", from: "bot", agente: "viajes", nombre: ev.nombre },
      )
      .catch(() => {});
    return { flow: "viajes_fallback", message: msg };
  }

  if (intent.intent === "reclamo") {
    return tryProcesarReclamo(ev, { texto, log });
  }

  if (intent.intent === "rendicion") {
    const out = await tryProcesarRendicion(ev, { texto, log, forzar: true });
    if (out) return out;
    const msg =
      `Perfecto, vamos con la *rendición de gastos*.\n\n` +
      `Mandame la *foto del ticket/factura* o contame: nafta, peaje, llantas, aceite, remolque, auxilio o arreglo menor.\n` +
      `Queda sujeto a *aprobación humana*.`;
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return { flow: "rendicion_fallback", message: msg };
  }

  if (intent.intent === "remito") {
    // Solo la lista de choferes de Remitos (Parámetros) entra al flujo de remitos
    if (esChoferRemitos) return null;
    const msg =
      intent.mensaje ||
      `Para *remitos* escriben los choferes registrados.\n\n` +
        `Si necesitás un *viaje/flete* o abrir un *reclamo*, contame y te ayudo.`;
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return { flow: "remito_solo_choferes", message: msg };
  }

  if (intent.intent === "chat" || intent.intent === "desconocido") {
    if (esChoferRemitos) return null; // ayuda típica de remitos
    const msg =
      intent.mensaje ||
      `Hola 👋 ¿En qué te ayudo?\n\n` +
        `• *Viaje / flete*\n` +
        `• *Rendición* (gastos)\n` +
        `• *Reclamo*\n\n` +
        `Decime cuál y seguimos.`;
    await convStore.appendMensaje(
      ev.from,
      { texto, tipo: "text" },
      { dir: "in", from: "client", nombre: ev.nombre, agente: "router" },
    );
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    await convStore.appendMensaje(
      ev.from,
      { texto: msg, tipo: "text" },
      { dir: "out", from: "bot", agente: "router" },
    );
    return { flow: "intent_clarificar", message: msg };
  }

  return null;
}

async function tryProcesarDestinos(ev, { texto, log, tieneFoto = false } = {}) {
  if (!ev.from) return null;
  // No robar mensajes de rendición de gastos (nafta, peaje, ticket…)
  if (pareceRendicionGasto(texto)) return null;

  const pendingCliente = await destinosStore.getDestinoPendientePorTelefono(ev.from);
  if (pendingCliente) {
    // Foto suelta no confirma dirección (sí ubicación GPS o texto)
    if (tieneFoto && !ev.location && !String(texto || "").trim()) return null;
    try {
      const out = await procesarRespuestaDestinoCliente(ev.from, {
        texto,
        lat: ev.location?.lat,
        lng: ev.location?.lng,
        nombre: ev.nombre,
        log,
      });
      if (!out) return null;
      return { ...out, message: out.message ?? out.mensaje ?? "" };
    } catch (err) {
      log?.error?.({ err: err.message, from: ev.from }, "destinos webhook error");
      const msg =
        `No pude ubicar esa dirección.\n\n` +
        `¿Me pasás *calle, número y localidad* (ej: Echeverría 1200, Pacheco) o tu ubicación 📌?\n` +
        `La necesitamos para que el chofer llegue bien.`;
      if (ev.from) {
        await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      }
      return {
        flow: "destinos_error",
        error: err.message,
        destino: pendingCliente,
        message: msg,
      };
    }
  }

  const pendingChofer = await destinosStore.getDestinoActivoPorChofer(ev.from);
  if (!pendingChofer) return null;

  // ETA del chofer es solo texto ("30 min") — nunca una foto de ticket
  if (tieneFoto || ev.media?.url) return null;

  try {
    const out = await procesarRespuestaDestinoChofer(ev.from, {
      texto,
      nombre: ev.nombre,
      log,
    });
    if (!out) return null;
    return { ...out, message: out.message ?? out.mensaje ?? "" };
  } catch (err) {
    log?.error?.({ err: err.message, from: ev.from }, "destinos ETA chofer error");
    const msg = `No pude interpretar el tiempo. Mandame algo como *30 min* o *1 hora*.`;
    if (ev.from) {
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    }
    return {
      flow: "destinos_eta_error",
      error: err.message,
      destino: pendingChofer,
      message: msg,
    };
  }
}

export default async function webhooksRoutes(fastify) {
  fastify.get("/builderbot/health", async () => ({
    ok: true,
    channel: "whatsapp-builderbot",
    endpoint: "POST /api/webhooks/builderbot",
    features: [
      "foto",
      "audio",
      "correcciones",
      "correcciones-ia",
      "destinos",
      "viajes",
      "reclamos",
      "rendicion",
      "intent-router",
      "tenant-ia",
    ],
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
      const convEarly = ev.from ? await convStore.getConversacion(ev.from) : null;
      const mediaEsAudio = esEventoAudio(ev, null);
      const esFoto =
        Boolean(ev.media?.url) && !mediaEsAudio && !ev.location;

      // ¿Hay destino activo pidiendo ETA al chofer?
      const destinoChoferActivo = ev.from
        ? await destinosStore.getDestinoActivoPorChofer(ev.from)
        : null;

      // Reclamo pendiente + foto/texto: ANTES de rendición/remito
      // (foto de producto dañado / equivocado no debe caer a OCR de remito)
      const pendingReclamoEarly = ev.from
        ? await reclamosStore.getReclamoPendientePorTelefono(ev.from)
        : null;
      if (pendingReclamoEarly && (texto || esFoto)) {
        let imageBuffer = null;
        let mime = null;
        if (esFoto) {
          try {
            const dl = await downloadMedia(ev.media.url);
            if (!/audio/i.test(dl.mime || "")) {
              imageBuffer = dl.buffer;
              mime = dl.mime;
            }
          } catch (err) {
            request.log.warn({ err: err.message }, "Reclamos: no pude bajar foto");
          }
        }
        const reclamoPend = await tryProcesarReclamo(ev, {
          texto,
          log: request.log,
          forzar: true,
          imageBuffer,
          mime,
        });
        if (reclamoPend) {
          return respuestaWebhook({ ...reclamoPend, received: true });
        }
      }

      // Consulta de caso ya abierto (código RC-… o "estado de mi reclamo")
      // antes de rendición/remito, para no mezclar flujos.
      if (
        ev.from &&
        texto &&
        !esFoto &&
        !pendingReclamoEarly &&
        (extractCodigoReclamo(texto) || pareceConsultaEstadoReclamo(texto))
      ) {
        const consulta = await tryProcesarReclamo(ev, {
          texto,
          log: request.log,
          forzar: true,
        });
        if (consulta) {
          return respuestaWebhook({ ...consulta, received: true });
        }
      }

      // Rendición ANTES de destinos/ETA:
      // - texto "nafta/gasto/ticket", o
      // - foto de comprobante (aunque no tenga caption) si hay ETA pendiente
      //   (si no, la foto sola seguiría a remito más abajo)
      const quiereRendicion =
        pareceRendicionGasto(texto) || (esFoto && Boolean(destinoChoferActivo));

      if (ev.from && quiereRendicion) {
        let imageBuffer = null;
        let mime = null;
        if (esFoto) {
          try {
            const dl = await downloadMedia(ev.media.url);
            if (!/audio/i.test(dl.mime || "")) {
              imageBuffer = dl.buffer;
              mime = dl.mime;
            }
          } catch (err) {
            request.log.warn({ err: err.message }, "Rendición: no pude bajar media");
          }
        }
        const gastoOut = await tryProcesarRendicion(ev, {
          texto: texto || (esFoto ? "comprobante de gasto" : ""),
          log: request.log,
          imageBuffer,
          mime,
          forzar: true,
        });
        if (gastoOut) {
          return respuestaWebhook({ ...gastoOut, received: true });
        }
      }

      // Destinos — cliente en validación / ETA chofer (nunca con foto: ETA es texto)
      const destinoOut = await tryProcesarDestinos(ev, {
        texto,
        log: request.log,
        tieneFoto: esFoto,
      });
      if (destinoOut) {
        return respuestaWebhook({ ...destinoOut, received: true });
      }

      // Viaje pendiente: siempre continuar (aunque sea chofer de remitos)
      const pendingViajeEarly = ev.from
        ? await solViajesStore.getSolicitudPendientePorTelefono(ev.from)
        : null;
      if (pendingViajeEarly) {
        const viajePend = await tryProcesarViajes(ev, {
          texto,
          log: request.log,
          conv: convEarly,
          forzar: true,
        });
        if (viajePend) {
          return respuestaWebhook({ ...viajePend, received: true });
        }
      }

      // Texto nuevo (sin foto): SIEMPRE router IA (remito / viaje / reclamo / chat).
      // Si hay remito abierto de un chofer de remitos, el router puede devolver null
      // en intent=remito y sigue el flujo de correcciones más abajo.
      if (texto && !ev.media?.url) {
        const routed = await enrutarPorIntencion(ev, {
          texto,
          conv: convEarly,
          log: request.log,
        });
        if (routed) {
          return respuestaWebhook({ ...routed, received: true });
        }
      }

      // Media adjunto — audio (nota de voz) o foto de remito
      if (ev.media?.url) {
        const { buffer, mime, filename } = await downloadMedia(ev.media.url);
        const evMedia = {
          ...ev,
          media: { ...ev.media, mime_type: mime, name: filename || ev.media.name },
        };

        if (esEventoAudio(evMedia, buffer)) {
          const convAudio = ev.from ? await convStore.getConversacion(ev.from) : null;
          const remitoAudio = await resolverRemitoCorreccion(ev.from, convAudio, tenantCfg);
          const pausadoAudio = convAudio?.bot_pausado;

          if (!flujoRemitoAbierto(convAudio) || !remitoAudio) {
            const msg =
              "Mandame una *foto del remito* para empezar.\n" +
              "Después podés *dictar* correcciones por audio o escribirlas, y confirmar con *OK*.";
            if (ev.from && !pausadoAudio) {
              await notificarChofer(ev.from, msg, { tenant: tenantCfg, log: request.log });
            }
            return respuestaWebhook({ message: msg, flow: "audio_sin_remito" });
          }

          let transcripcion;
          try {
            transcripcion = await transcribirAudio(buffer, {
              mimeType: mime,
              filename,
              log: request.log,
            });
          } catch (err) {
            request.log.warn({ err: err.message }, "Transcripción audio falló");
            const msg = mensajeAudioFallidoConfirmacion();
            if (ev.from && !pausadoAudio) {
              await notificarChofer(ev.from, msg, { tenant: tenantCfg, remito_id: remitoAudio.id, log: request.log });
            }
            return respuestaWebhook({ message: msg, flow: "audio_no_entendido" });
          }

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

          if (esConfirmacionOk(transcripcion)) {
            const out = await aplicarConfirmacionChofer({
              phone: ev.from,
              conv: convAudio,
              tenantCfg,
              pausado: pausadoAudio,
              log: request.log,
            });
            if (out) {
              return respuestaWebhook({ ...out, transcripcion, flow: out.flow ?? "audio_ok" });
            }
            const msg = "✅ Ya quedó registrado. ¡Buen viaje!";
            if (ev.from && !pausadoAudio) {
              await notificarChofer(ev.from, msg, { tenant: tenantCfg, log: request.log });
            }
            return respuestaWebhook({ message: msg, transcripcion, flow: "confirmado_repetido" });
          }

          // Correcciones por audio: misma IA/heurística que el texto
          const correccionesAudio = await resolveCorreccionesChofer(transcripcion, {
            tenant: remitoAudio?.tenant ?? tenantCfg,
            datos: remitoAudio?.datos,
            remitoVinculado: Boolean(remitoAudio),
            log: request.log,
          });
          if (correccionesAudio.length > 0) {
            if (ev.from) {
              await convStore.setCorreccionesPendientes(ev.from, correccionesAudio);
            }
            const out = await aplicarCorreccionesChofer({
              phone: ev.from,
              conv: convAudio,
              tenantCfg,
              correcciones: correccionesAudio,
              pausado: pausadoAudio,
              log: request.log,
            });
            if (out) {
              return respuestaWebhook({
                ...out,
                transcripcion,
                flow: out.flow ?? "audio_correccion",
              });
            }
          }

          const msg =
            correccionesAudio.length === 0
              ? mensajeAudioSinCorreccion(transcripcion)
              : mensajeAudioSoloConfirmacion();
          if (ev.from && !pausadoAudio) {
            await notificarChofer(ev.from, msg, {
              tenant: remitoAudio.tenant,
              remito_id: remitoAudio.id,
              log: request.log,
            });
          }
          return respuestaWebhook({
            message: msg,
            transcripcion,
            flow: "audio_sin_correccion",
          });
        }

        // Foto — rendición de gastos (caption), destino pendiente, o remito
        const caption = texto || ev.message?.trim() || "";
        if (pareceRendicionGasto(caption)) {
          const gastoOut = await tryProcesarRendicion(ev, {
            texto: caption,
            log: request.log,
            imageBuffer: buffer,
            mime,
            forzar: true,
          });
          if (gastoOut) {
            return respuestaWebhook({ ...gastoOut, received: true });
          }
        }

        const destinoPendiente = ev.from
          ? await destinosStore.getDestinoPendientePorTelefono(ev.from)
          : null;
        if (destinoPendiente) {
          const hint =
            "Recibí una imagen, pero estoy esperando que confirmes el *destino*.\n" +
            "Respondé *SÍ*, escribí la dirección corregida, o enviá tu ubicación 📌";
          if (ev.from) {
            await notificarChofer(ev.from, hint, { log: request.log }).catch(() => {});
          }
          return respuestaWebhook({ message: hint, flow: "destinos_esperando_texto", destino_id: destinoPendiente.id });
        }

        const telefono = ev.from || null;

        if (ev.from) {
          await syncBotPausa(ev.from);
          await convStore.appendMensaje(
            ev.from,
            { texto: ev.message || "envía imagen", tipo: "image", imagen_url: ev.media.url },
            { tenant: tenantCfg, nombre: ev.nombre },
          );
        }

        const convFoto = ev.from ? await convStore.getConversacion(ev.from) : null;
        const pausado = !!convFoto?.bot_pausado;
        const tenantFoto = tenantCfg ?? convFoto?.tenant;

        // Corina: exigir Cervecería / Eco antes de OCR
        if (tenantFoto === "corina" && ev.from && !convFoto?.corina_cliente_marca) {
          const msg = mensajeCorinaFaltaCliente();
          if (!pausado) await notificarChofer(ev.from, msg, { tenant: "corina", log: request.log });
          return respuestaWebhook({ message: msg, flow: "corina_esperando_cliente" });
        }

        if (ev.from && !pausado) {
          await notificarChofer(ev.from, mensajeProcesandoRemito(), {
            tenant: tenantCfg,
            log: request.log,
          });
        }

        // No forzar TSB/Beraldi/M&E por conversación previa: el papel manda.
        // Solo Corina se fuerza (flujo de marca de cliente).
        const resultado = await ingestarRemito(buffer, {
          filename,
          telefono,
          tenantForzado: tenantFoto === "corina" ? "corina" : undefined,
          tenantSugerido: tenantFoto ?? tenantCfg ?? undefined,
          corinaClienteMarca: convFoto?.corina_cliente_marca ?? undefined,
        });

        if (ev.from && resultado.id) {
          await convStore.setUltimoRemito(ev.from, resultado.id, resultado.tenant);
        }

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

      return procesarTextoChofer(ev, tenantCfg, texto, request.log);
    } catch (err) {
      request.log.error(err);
      const destinoPendiente = ev.from
        ? await destinosStore.getDestinoPendientePorTelefono(ev.from)
        : null;
      const errMsg = destinoPendiente
        ? "Hubo un problema al procesar tu respuesta sobre el destino. Probá de nuevo con calle, número y ciudad."
        : esEventoAudio(ev)
          ? mensajeAudioFallidoConfirmacion()
          : "No pude leer el remito. Probá con mejor luz, sin sombras, y que se vea la guía completa.";

      if (ev.from) await syncBotPausa(ev.from);
      const pausadoErr = ev.from ? !!(await convStore.getConversacion(ev.from))?.bot_pausado : false;
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
