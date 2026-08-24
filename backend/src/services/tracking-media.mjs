/**
 * Media de Tracking Express (POD / incidencias desde webapp pública).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MEDIA_DIR = path.join(UPLOAD_DIR, "tracking-media");

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  return ".jpg";
}

export function persistTrackingMedia(buffer, mime = "image/jpeg", { tripId } = {}) {
  if (!buffer?.length) return null;
  if (buffer.length > 8 * 1024 * 1024) {
    throw Object.assign(new Error("Archivo demasiado grande (máx 8 MB)"), { statusCode: 400 });
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const m = String(mime || "image/jpeg").toLowerCase();
  if (!allowed.some((a) => m.startsWith(a.split("/")[0] + "/") && m.includes(a.split("/")[1]))) {
    if (!m.startsWith("image/")) {
      throw Object.assign(new Error("Solo imágenes JPEG, PNG o WebP"), { statusCode: 400 });
    }
  }
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const safeTrip = String(tripId || "trip").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  const filename = `${safeTrip}-${Date.now()}-${randomUUID().slice(0, 8)}${extFromMime(mime)}`;
  const absPath = path.join(MEDIA_DIR, filename);
  fs.writeFileSync(absPath, buffer);
  return { filename, absPath, publicPath: `/api/tracking/public/media/${filename}` };
}

export function resolveTrackingMediaPath(filename) {
  const safe = path.basename(String(filename || ""));
  if (!safe || safe.includes("..")) return null;
  const abs = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(abs)) return null;
  return abs;
}

export function trackingMediaMime(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
