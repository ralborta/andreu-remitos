const PROBE_TIMEOUT_MS = 8000;
/** WhatsApp renueva el QR ~cada 60s; uno viejo produce «No puede vincular dispositivos». */
const QR_MAX_AGE_MS = 90_000;

function isQrFresh(qrUpdatedAt) {
  if (!qrUpdatedAt) return false;
  const ts = Date.parse(qrUpdatedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= QR_MAX_AGE_MS;
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

/**
 * Intenta obtener PNG del bot. Devuelve { buf, qrUpdatedAt } o null.
 */
async function fetchQrPng(base, status) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${base}/v1/whatsapp/qr`, { signal: ac.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok || !res.headers.get("content-type")?.includes("png")) return null;
    const qrUpdatedAt =
      status?.qr_updated_at ?? res.headers.get("last-modified") ?? null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return { buf, qrUpdatedAt };
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

  const status =
    (await fetchBotJson(`${base}/v1/whatsapp/ready`)) ??
    (await fetchBotJson(`${base}/v1/whatsapp/status`));

  if (status?.can_send || (status?.ready && status?.whatsapp === "connected")) {
    return {
      ok: true,
      connected: true,
      can_send: true,
      phone: status.phone ?? null,
      message: "WhatsApp conectado y listo para enviar mensajes.",
    };
  }

  const sessionStale = Boolean(status?.phone && status?.last_send_error);
  const png = await fetchQrPng(base, status);

  if (png) {
    const fresh = isQrFresh(png.qrUpdatedAt);
    return {
      ok: true,
      connected: false,
      can_send: false,
      phone: status?.phone ?? null,
      session_stale: sessionStale || !fresh,
      qr_available: fresh,
      qr_stale: !fresh,
      image_base64: `data:image/png;base64,${png.buf.toString("base64")}`,
      qr_updated_at: png.qrUpdatedAt,
      auto_reconnect: status?.auto_reconnect ?? true,
      needs_reset: !fresh || sessionStale,
      message: fresh
        ? sessionStale
          ? "Sesión anterior caída — escaneá este QR nuevo para volver a vincular."
          : "Escaneá con WhatsApp → Dispositivos vinculados → Vincular dispositivo."
        : "El código QR en disco expiró. Tocá «Reiniciar sesión» (o reiniciá el bot) para generar uno nuevo.",
    };
  }

  return {
    ok: true,
    connected: false,
    can_send: false,
    phone: status?.phone ?? null,
    session_stale: sessionStale,
    qr_available: false,
    auto_reconnect: status?.auto_reconnect ?? true,
    needs_reset: true,
    message: sessionStale
      ? "La sesión expiró y no hay QR fresco. Reiniciá la sesión WhatsApp del bot para generar uno nuevo."
      : "Generando código QR… reintentá en unos segundos. Si no aparece, reiniciá la sesión del bot.",
  };
}
