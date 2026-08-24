import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

/** Genera token opaco URL-safe (nunca persistir en texto plano). */
export function generateTrackingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashTrackingToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function verifyTrackingToken(token, storedHash) {
  if (!token || !storedHash) return false;
  const actual = hashTrackingToken(token);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(String(storedHash), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sealKey() {
  const secret =
    process.env.SOL_TRACKING_TOKEN_SECRET?.trim() ||
    process.env.AUTH_JWT_SECRET?.trim() ||
    "andreu-dev-secret-cambiar";
  return scryptSync(secret, "sol-tracking-token-v1", 32);
}

/** Cifrado AES-GCM para reenvíos WA (no es texto plano en disco). */
export function sealTrackingToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const enc = Buffer.concat([cipher.update(String(token), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function openTrackingToken(sealed) {
  const parts = String(sealed || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const enc = Buffer.from(parts[2], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function buildTrackingPublicUrl(plainToken) {
  const baseUrl =
    process.env.SOL_TRACKING_PUBLIC_BASE_URL ||
    process.env.FRONTEND_PUBLIC_URL ||
    "http://localhost:3000";
  return `${String(baseUrl).replace(/\/$/, "")}/tracking/t/${plainToken}`;
}

