import { createReadStream, existsSync, readSync, openSync, closeSync } from "node:fs";
import { basename, extname } from "node:path";
import crypto from "node:crypto";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

/** @type {Map<string, { path: string, mime: string, expiresAt: number }>} */
const tempFiles = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of tempFiles) {
    if (entry.expiresAt <= now) tempFiles.delete(id);
  }
}, 60_000).unref();

export function sanitizePhone(from) {
  return String(from ?? "").replace(/\D/g, "");
}

export function registerTempFile(absPath, mimeOverride = null) {
  const id = crypto.randomBytes(16).toString("hex");
  const mime = mimeOverride || MIME[extname(absPath).toLowerCase()] || "application/octet-stream";
  tempFiles.set(id, { path: absPath, mime, expiresAt: Date.now() + 15 * 60 * 1000 });
  return { id, mime };
}

export function mountFileRoutes(server) {
  server.get("/v1/files/:id", (req, res) => {
    const entry = tempFiles.get(req.params.id);
    if (!entry || !existsSync(entry.path)) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": entry.mime });
    createReadStream(entry.path).pipe(res);
  });
}

function isMediaBody(body) {
  return /_event_(media|voice_note|audio|document|image|video)__/i.test(String(body ?? ""));
}

function isLocationBody(body) {
  return /_event_location__/i.test(String(body ?? ""));
}

function inferMediaKind(body) {
  const b = String(body ?? "");
  if (/_event_voice_note__/i.test(b)) return "voice_note";
  if (/_event_audio__/i.test(b)) return "audio";
  if (/_event_image__/i.test(b)) return "image";
  if (/_event_video__/i.test(b)) return "video";
  if (/_event_document__/i.test(b)) return "document";
  if (/_event_media__/i.test(b)) return "media";
  return null;
}

function ctxHasMedia(ctx) {
  const msg = ctx?.message;
  return !!(
    msg?.audioMessage ||
    msg?.imageMessage ||
    msg?.videoMessage ||
    msg?.documentMessage ||
    msg?.documentWithCaptionMessage ||
    msg?.stickerMessage
  );
}

function inferMediaKindFromCtx(ctx, rawBody) {
  const msg = ctx?.message;
  if (msg?.audioMessage) return "voice_note";
  if (msg?.imageMessage || msg?.stickerMessage) return "image";
  if (msg?.videoMessage) return "video";
  if (msg?.documentMessage || msg?.documentWithCaptionMessage) return "document";
  return inferMediaKind(rawBody);
}

/** WhatsApp voice notes son OGG/Opus aunque la extensión no lo indique. */
function fileLooksLikeAudio(absPath) {
  const ext = extname(absPath).toLowerCase();
  if ([".ogg", ".opus", ".mp3", ".m4a", ".webm", ".aac", ".amr"].includes(ext)) return true;
  let fd;
  try {
    fd = openSync(absPath, "r");
    const buf = Buffer.alloc(4);
    readSync(fd, buf, 0, 4, 0);
    return buf.toString("ascii", 0, 4) === "OggS";
  } catch {
    return false;
  } finally {
    if (fd != null) closeSync(fd);
  }
}

/**
 * Reenvía el mensaje al webhook Andreu (mismo contrato que BuilderBot Cloud).
 */
export async function forwardToAndreu(ctx, provider, { publicBaseUrl }) {
  const phone = sanitizePhone(ctx.from);
  if (!phone) throw new Error("Sin teléfono en ctx.from");

  const name = ctx.name ?? ctx.pushName ?? null;
  const rawBody = String(ctx.body ?? "");
  const mediaKind = inferMediaKindFromCtx(ctx, rawBody);
  let urlTempFile = null;
  let attachmentMime = null;
  let attachmentName = null;

  if ((isMediaBody(rawBody) || ctxHasMedia(ctx)) && provider?.saveFile) {
    const mediaDir = process.env.MEDIA_DIR || "./assets/inbound";
    const filePath = await provider.saveFile(ctx, { path: mediaDir });
    const waMime = provider.getMimeType?.(ctx) ?? null;
    const looksAudio =
      mediaKind === "voice_note" ||
      mediaKind === "audio" ||
      fileLooksLikeAudio(filePath) ||
      /^audio\//i.test(String(waMime ?? ""));
    const forcedMime = looksAudio ? ( /^audio\//i.test(String(waMime ?? "")) ? waMime : "audio/ogg" ) : null;
    const { id, mime } = registerTempFile(filePath, forcedMime);
    urlTempFile = `${publicBaseUrl.replace(/\/$/, "")}/v1/files/${id}`;
    attachmentMime = mime;
    attachmentName = basename(filePath);
  }

  const data = {
    from: phone,
    name,
    body: rawBody.startsWith("_event_") ? "" : rawBody,
    mediaKind,
    urlTempFile,
    attachment: urlTempFile
      ? [{ url: urlTempFile, mime_type: attachmentMime, filename: attachmentName }]
      : [],
  };

  if (isLocationBody(rawBody) && ctx.message?.locationMessage) {
    data.locationMessage = ctx.message.locationMessage;
  }

  const apiUrl = (process.env.ANDREU_API_URL || "http://localhost:3001").replace(/\/$/, "");
  const res = await fetch(`${apiUrl}/api/webhooks/builderbot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName: "message.incoming", data }),
  });

  const text = await res.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }

  if (!res.ok) {
    console.error("[andreu-bot] API error", res.status, parsed);
    throw new Error(parsed.error || `Andreu API respondió ${res.status}`);
  }

  return parsed;
}
