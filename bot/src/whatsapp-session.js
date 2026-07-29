import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = process.env.BOT_SESSION_NAME || "andreu";

/** Último envío exitoso — se actualiza en POST /v1/messages */
let lastSendOkAt = null;
/** Último error de envío (ej. sesión expirada) */
let lastSendError = null;

export function markSendOk() {
  lastSendOkAt = Date.now();
  lastSendError = null;
}

export function markSendError(message) {
  lastSendError = String(message ?? "error de envío").slice(0, 240);
}

function qrPath() {
  return join(process.cwd(), `${BOT_NAME}.qr.png`);
}

/** ¿La conexión Baileys permite enviar mensajes? */
export function canSendMessages(provider) {
  const vendor = provider?.vendor;
  if (!vendor?.user?.id) return false;

  const wsState = vendor?.ws?.readyState;
  if (wsState !== undefined && wsState !== 1) return false;

  if (lastSendError && /log in|qr code|not connected|100/i.test(lastSendError)) {
    return false;
  }

  return true;
}

export function getSessionSnapshot(provider) {
  const host = provider?.globalVendorArgs?.host;
  const user = provider?.vendor?.user;
  const phone =
    host?.phone ?? (user?.id ? String(user.id).split(":").shift() : null);
  const path = qrPath();
  const qr_available = existsSync(path);
  let qr_updated_at = null;
  if (qr_available) {
    qr_updated_at = statSync(path).mtime.toISOString();
  }

  const can_send = canSendMessages(provider);
  let whatsapp = "disconnected";
  if (can_send) whatsapp = "connected";
  else if (qr_available || phone) whatsapp = "awaiting_qr";

  return {
    ok: true,
    service: "andreu-baileys-bot",
    whatsapp,
    can_send,
    phone: phone ?? null,
    qr_available,
    qr_updated_at,
    last_send_ok_at: lastSendOkAt ? new Date(lastSendOkAt).toISOString() : null,
    last_send_error: lastSendError,
    auto_reconnect: true,
    reconnect_note:
      "Baileys intenta reconectar solo ante cortes de red. Si la sesión expiró, escaneá el QR de nuevo.",
  };
}

export function readQrPng() {
  const path = qrPath();
  if (!existsSync(path)) return null;
  return readFileSync(path);
}
