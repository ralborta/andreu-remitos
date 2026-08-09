/**
 * Persiste media de WhatsApp para el chat de Contactos / Rendición.
 * Las URLs del bot (/v1/files/…) son temporales e internas.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MEDIA_DIR = path.join(UPLOAD_DIR, "chat-media");

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("pdf")) return ".pdf";
  return ".jpg";
}

/**
 * @returns {{ absPath: string, publicUrl: string, filename: string } | null}
 */
export function persistChatMedia(buffer, mime = "image/jpeg") {
  if (!buffer?.length) return null;
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${extFromMime(mime)}`;
  const absPath = path.join(MEDIA_DIR, filename);
  fs.writeFileSync(absPath, buffer);
  return {
    absPath,
    filename,
    publicUrl: `/api/media/local/${filename}`,
  };
}

export function resolveLocalMediaPath(filename) {
  const safe = path.basename(String(filename || ""));
  if (!safe || safe.includes("..")) return null;
  const abs = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function mediaMimeFromFilename(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  return "image/jpeg";
}

/** Reescribe URL interna del bot a proxy autenticado del API. */
export function toBrowsableMediaUrl(url) {
  const u = String(url || "").trim();
  if (!u) return null;
  if (u.startsWith("/api/media/")) return u;
  const m = u.match(/\/v1\/files\/([a-fA-F0-9]+)/);
  if (m) return `/api/media/bot/${m[1]}`;
  return u;
}

void DATA_DIR;
