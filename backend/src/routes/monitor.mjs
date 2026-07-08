import { fetchBaileysWhatsappQr } from "../services/baileys-qr.mjs";

const PROBE_TIMEOUT_MS = 6000;

/**
 * @param {string} url
 * @param {string} id
 */
async function probeJson(url, id) {
  if (!url) {
    return { id, ok: false, error: "URL no configurada" };
  }
  const started = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    clearTimeout(timer);
    const raw = await res.text().catch(() => "");
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw: raw.slice(0, 120) };
    }
    return {
      id,
      ok: res.ok && data.ok !== false,
      status: res.status,
      latency_ms: Date.now() - started,
      ...data,
    };
  } catch (err) {
    return {
      id,
      ok: false,
      latency_ms: Date.now() - started,
      error: err.name === "AbortError" ? "timeout" : err.message,
    };
  }
}

function whatsappOk(botProbe) {
  if (!botProbe?.ok) return false;
  return botProbe.whatsapp === "connected" && Boolean(botProbe.phone);
}

async function fetchBotJson(url) {
  if (!url) return null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function monitorRoutes(fastify) {
  fastify.get("/status", async () => {
    const botBase = process.env.BAILEYS_BOT_URL?.trim().replace(/\/$/, "") || "";
    const bot = await probeJson(botBase ? `${botBase}/health` : "", "bot");

    const api = {
      id: "api",
      ok: true,
      service: "andreu-api",
      latency_ms: 0,
    };

    const webhook = {
      id: "webhook",
      ok: true,
      path: "/api/webhooks/builderbot",
    };

    const waConnected = whatsappOk(bot);
    const botOperational = bot.ok && waConnected;

    const services = {
      api,
      bot: {
        ...bot,
        whatsapp: bot.whatsapp ?? (waConnected ? "connected" : "disconnected"),
      },
      whatsapp: {
        id: "whatsapp",
        ok: waConnected,
        phone: bot.phone ?? null,
        status: bot.whatsapp ?? (waConnected ? "connected" : "disconnected"),
        qr_available: bot.qr_available ?? false,
        qr_updated_at: bot.qr_updated_at ?? null,
        auto_reconnect: bot.auto_reconnect ?? true,
        detail: waConnected
          ? "Sesión activa"
          : bot.whatsapp === "awaiting_qr" || bot.qr_available
            ? "Esperando escaneo de QR"
            : bot.ok
              ? "Desconectado — el bot intenta reconectar"
              : "Bot no responde",
      },
      webhook,
    };

    const ok = api.ok && botOperational;

    return {
      ok,
      checked_at: new Date().toISOString(),
      services,
      hints: !waConnected && bot.ok
        ? [
            "WhatsApp desconectado — usá «Mostrar QR» abajo o abrí el monitor del bot.",
            bot.auto_reconnect
              ? "Baileys reconecta solo ante cortes de red; si la sesión expiró, escaneá QR."
              : null,
          ].filter(Boolean)
        : !bot.ok
          ? ["Servicio andreu-bot caído — revisá logs en Easypanel"]
          : [],
    };
  });

  fastify.get("/whatsapp/qr", async () => {
    const botBase = process.env.BAILEYS_BOT_URL?.trim().replace(/\/$/, "") || "";
    if (!botBase) {
      return { ok: false, connected: false, error: "BAILEYS_BOT_URL no configurado" };
    }
    return fetchBaileysWhatsappQr(botBase);
  });
}
