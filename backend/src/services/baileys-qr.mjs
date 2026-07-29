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
 * @param {string} botBase URL base del bot Baileys (sin barra final)
 */
export async function fetchBaileysWhatsappQr(botBase) {
  const base = botBase?.trim().replace(/\/$/, "") || "";
  if (!base) {
    return { ok: false, connected: false, error: "Bot Baileys no configurado" };
  }

  const status = await fetchBotJson(`${base}/v1/whatsapp/ready`) ?? (await fetchBotJson(`${base}/v1/whatsapp/status`));
  if (status?.can_send || (status?.ready && status?.whatsapp === "connected")) {
    return {
      ok: true,
      connected: true,
      can_send: true,
      phone: status.phone ?? null,
      message: "WhatsApp conectado y listo para enviar mensajes.",
    };
  }

  if (status?.phone && status?.last_send_error) {
    return {
      ok: true,
      connected: false,
      can_send: false,
      phone: status.phone,
      session_stale: true,
      message:
        "La sesión expiró — escaneá el QR de nuevo. El monitor puede mostrar «conectado» pero no envía mensajes.",
    };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${base}/v1/whatsapp/qr`, { signal: ac.signal, cache: "no-store" });
    clearTimeout(timer);

    if (res.ok && res.headers.get("content-type")?.includes("png")) {
      const qrUpdatedAt =
        status?.qr_updated_at ?? res.headers.get("last-modified") ?? null;
      if (!isQrFresh(qrUpdatedAt)) {
        return {
          ok: true,
          connected: false,
          qr_available: false,
          qr_stale: true,
          qr_updated_at: qrUpdatedAt,
          auto_reconnect: status?.auto_reconnect ?? true,
          message:
            "El código QR expiró. Esperá unos segundos a que se genere uno nuevo y tocá Actualizar.",
        };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        connected: false,
        qr_available: true,
        image_base64: `data:image/png;base64,${buf.toString("base64")}`,
        qr_updated_at: qrUpdatedAt,
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
