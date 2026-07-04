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
  if (botProbe.whatsapp === "connected") return true;
  if (botProbe.phone) return true;
  return false;
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
        detail: waConnected ? "Sesión activa" : bot.ok ? "Bot arriba — falta escanear QR o reconectar" : "Bot no responde",
      },
      webhook,
    };

    const ok = api.ok && botOperational;

    return {
      ok,
      checked_at: new Date().toISOString(),
      services,
      hints: !waConnected && bot.ok
        ? ["WhatsApp desconectado: abrí https://logistica-andreu-bot.wd75db.easypanel.host/ y escaneá el QR"]
        : !bot.ok
          ? ["Servicio andreu-bot caído — revisá logs en Easypanel"]
          : [],
    };
  });
}
