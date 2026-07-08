const PROBE_TIMEOUT_MS = 8000;

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

/**
 * @param {string} botBase URL base del bot Baileys (sin barra final)
 */
export async function fetchBaileysWhatsappQr(botBase) {
  const base = botBase?.trim().replace(/\/$/, "") || "";
  if (!base) {
    return { ok: false, connected: false, error: "Bot Baileys no configurado" };
  }

  const status = await fetchBotJson(`${base}/v1/whatsapp/status`);
  if (status?.whatsapp === "connected") {
    return {
      ok: true,
      connected: true,
      phone: status.phone ?? null,
      message: "WhatsApp ya está conectado.",
    };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${base}/v1/whatsapp/qr`, { signal: ac.signal, cache: "no-store" });
    clearTimeout(timer);

    if (res.ok && res.headers.get("content-type")?.includes("png")) {
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        connected: false,
        qr_available: true,
        image_base64: `data:image/png;base64,${buf.toString("base64")}`,
        qr_updated_at: status?.qr_updated_at ?? null,
        auto_reconnect: status?.auto_reconnect ?? true,
        message: "Escaneá con WhatsApp → Dispositivos vinculados → Vincular dispositivo.",
      };
    }
  } catch {
    /* fallthrough */
  }

  return {
    ok: true,
    connected: false,
    qr_available: false,
    auto_reconnect: status?.auto_reconnect ?? true,
    message: "Generando código QR… reintentá en unos segundos.",
  };
}
