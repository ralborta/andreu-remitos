/**
 * Envío de mensajes WhatsApp vía BuilderBot Cloud API v2.
 * Patrón: empliados-support-desk/lib/builderbot.ts
 */

const BASE = process.env.BUILDERBOT_BASE_URL || "https://app.builderbot.cloud";

export async function sendWhatsAppMessage({ number, message, mediaUrl, checkIfExists = false }) {
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

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`BuilderBot ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
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
