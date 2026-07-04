/**
 * Envío de mensajes WhatsApp vía BuilderBot Cloud API v2.
 * Patrón: empliados-support-desk/lib/builderbot.ts
 */

const BASE = process.env.BUILDERBOT_BASE_URL || "https://app.builderbot.cloud";
const BAILEYS_BOT_URL = process.env.BAILEYS_BOT_URL?.trim().replace(/\/$/, "") || "";

async function sendViaBaileysBot({ number, message, mediaUrl }) {
  const phone = String(number).replace(/\D/g, "");
  const res = await fetch(`${BAILEYS_BOT_URL}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, message: message || " ", urlMedia: mediaUrl ?? null }),
  });
  const raw = await res.text().catch(() => "");
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.slice(0, 200) };
  }
  if (!res.ok) {
    throw new Error(data.error || `Bot Baileys respondió ${res.status}`);
  }
  return data;
}

async function setBaileysBlacklist(number, intent) {
  const phone = String(number).replace(/\D/g, "");
  if (phone.length < 9) return;
  const res = await fetch(`${BAILEYS_BOT_URL}/v1/blacklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, intent }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Baileys blacklist ${res.status}: ${errText.slice(0, 200)}`);
  }
}

export async function sendWhatsAppMessage({ number, message, mediaUrl, checkIfExists = false }) {
  if (BAILEYS_BOT_URL) {
    void checkIfExists;
    return sendViaBaileysBot({ number, message, mediaUrl });
  }

  const botId = process.env.BUILDERBOT_BOT_ID?.trim();
  const apiKey = process.env.BUILDERBOT_API_KEY?.trim();

  if (!botId || !apiKey) {
    throw new Error("BuilderBot no configurado: BUILDERBOT_BOT_ID y BUILDERBOT_API_KEY");
  }

  const phone = String(number).replace(/\D/g, "");
  const body = {
    messages: { content: message || " " },
    number: phone,
    checkIfExists,
  };
  if (mediaUrl) body.messages.mediaUrl = mediaUrl;

  const res = await fetch(`${BASE}/api/v2/${botId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-builderbot": apiKey,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text().catch(() => "");
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.slice(0, 200) };
  }

  if (!res.ok) {
    throw new Error(formatBuilderBotSendError(res.status, data));
  }
  if (data?.error) {
    throw new Error(formatBuilderBotSendError(res.status, data));
  }
  return data;
}

function formatBuilderBotSendError(status, data) {
  const msg = String(data?.error || data?.message || "").trim();
  const lower = msg.toLowerCase();
  if (lower.includes("deploy not found")) {
    return "WhatsApp no disponible: el bot no tiene deploy activo en BuilderBot. Hay que volver a desplegarlo.";
  }
  if (lower.includes("not online") || lower.includes("not connected")) {
    return "WhatsApp no conectado: escaneá el QR del bot en BuilderBot (estado READY_TO_SCAN).";
  }
  if (msg) return `BuilderBot: ${msg}`;
  return `BuilderBot respondió ${status} sin detalle`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BLACKLIST_RETRIES = 3;
const BLACKLIST_DELAY_MS = 1500;
const BLACKLIST_SETTLE_MS = 800;

/**
 * Pausa/reactiva flujo automático del bot para un número (BuilderBot Cloud v2).
 * Patrón: MisReclamos/src/lib/builderbot.ts → setBuilderBotCloudBlacklist
 * intent: "add" | "remove"
 */
export async function setBuilderBotBlacklist(number, intent) {
  if (BAILEYS_BOT_URL) {
    return setBaileysBlacklist(number, intent);
  }

  const botId = process.env.BUILDERBOT_BOT_ID?.trim();
  const apiKey = process.env.BUILDERBOT_API_KEY?.trim();
  if (!botId || !apiKey) return;

  const phone = String(number).replace(/\D/g, "");
  if (phone.length < 9) return;

  const url = `${BASE.replace(/\/$/, "")}/api/v2/${botId}/blacklist`;
  const headers = {
    "Content-Type": "application/json",
    "x-api-builderbot": apiKey,
  };
  const body = JSON.stringify({ number: phone, intent });

  let lastError = null;
  for (let attempt = 1; attempt <= BLACKLIST_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`BuilderBot blacklist ${res.status}: ${errText.slice(0, 200)}`);
      }
      await sleep(BLACKLIST_SETTLE_MS);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < BLACKLIST_RETRIES) await sleep(BLACKLIST_DELAY_MS);
    }
  }
  throw lastError ?? new Error("BuilderBot blacklist falló tras reintentos");
}
