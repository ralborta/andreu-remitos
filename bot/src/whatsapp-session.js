import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BOT_NAME = process.env.BOT_SESSION_NAME || "andreu";

function qrPath() {
  return join(process.cwd(), `${BOT_NAME}.qr.png`);
}

export function getSessionSnapshot(provider) {
  const host = provider?.globalVendorArgs?.host;
  const user = provider?.vendor?.user;
  const phone =
    host?.phone ?? (user?.id ? String(user.id).split(":").shift() : null);
  const connected = Boolean(phone);
  const path = qrPath();
  const qr_available = existsSync(path);
  let qr_updated_at = null;
  if (qr_available) {
    qr_updated_at = statSync(path).mtime.toISOString();
  }

  let whatsapp = "disconnected";
  if (connected) whatsapp = "connected";
  else if (qr_available) whatsapp = "awaiting_qr";

  return {
    ok: true,
    service: "andreu-baileys-bot",
    whatsapp,
    phone: phone ?? null,
    qr_available,
    qr_updated_at,
    auto_reconnect: true,
    reconnect_note:
      "Baileys intenta reconectar solo ante cortes de red. Si la sesión expiró, hay que escanear QR de nuevo.",
  };
}

export function readQrPng() {
  const path = qrPath();
  if (!existsSync(path)) return null;
  return readFileSync(path);
}
