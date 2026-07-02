import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ROLES = /** @type {const} */ (["operador", "administrador"]);

/** @typedef {"operador" | "administrador"} RolUsuario */

const SCRYPT_KEYLEN = 64;
const JWT_ALG = "HS256";
const JWT_TTL = "7d";
const COOKIE_NAME = "andreu_session";

function jwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET requerido en producción");
  }
  return new TextEncoder().encode(secret || "andreu-dev-secret-cambiar");
}

export function authCookieName() {
  return COOKIE_NAME;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const raw = String(stored || "");
  if (!raw.startsWith("scrypt:")) return false;
  const [, saltB64, hashB64] = raw.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(String(password), salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * @param {{ id: string; username: string; rol: RolUsuario; nombre?: string }} user
 */
export async function signSessionToken(user) {
  return new SignJWT({
    username: user.username,
    rol: user.rol,
    nombre: user.nombre || user.username,
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(jwtSecret());
}

/** @returns {Promise<{ id: string; username: string; rol: RolUsuario; nombre: string }>} */
export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: [JWT_ALG] });
  const id = payload.sub;
  const username = payload.username;
  const rol = payload.rol;
  const nombre = payload.nombre;
  if (typeof id !== "string" || typeof username !== "string" || typeof rol !== "string") {
    throw new Error("Token inválido");
  }
  if (!ROLES.includes(/** @type {RolUsuario} */ (rol))) {
    throw new Error("Rol inválido en token");
  }
  return {
    id,
    username,
    rol: /** @type {RolUsuario} */ (rol),
    nombre: typeof nombre === "string" ? nombre : username,
  };
}

export function extractBearerToken(request) {
  const auth = request.headers?.authorization || request.headers?.Authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function extractCookieToken(request, cookieName = COOKIE_NAME) {
  const cookie = request.headers?.cookie || request.headers?.Cookie;
  if (typeof cookie !== "string") return null;
  const re = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`);
  const match = cookie.match(re);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function extractSessionToken(request) {
  return extractBearerToken(request) || extractCookieToken(request);
}

export function isAdmin(session) {
  return session?.rol === "administrador";
}

/** Rutas API públicas (sin sesión). */
export function isPublicApiPath(pathname, method) {
  if (pathname === "/health") return true;
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname.startsWith("/api/webhooks")) return true;
  return false;
}

/** Solo administrador puede mutar parámetros maestros. */
export function canMutateParametros(session) {
  return isAdmin(session);
}
