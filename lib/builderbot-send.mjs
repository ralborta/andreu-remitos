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

/**
 * Pausa/reactiva flujo automático del bot para un número.
 * intent: "add" | "remove"
 */
export async function setBuilderBotBlacklist(number, intent) {
  const botId = process.env.BUILDERBOT_BOT_ID?.trim();
  const apiKey = process.env.BUILDERBOT_API_KEY?.trim();
  if (!botId || !apiKey) return;

  const phone = String(number).replace(/\D/g, "");
  await fetch(`${BASE}/api/v2/${botId}/blacklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-builderbot": apiKey,
    },
    body: JSON.stringify({ number: phone, intent }),
  }).catch(() => {});
}
