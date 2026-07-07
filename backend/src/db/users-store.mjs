import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword, ROLES } from "../../../lib/auth.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "users.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    nombre: row.nombre,
    rol: row.rol,
    activo: row.activo !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getUserByUsername(username) {
  const u = String(username || "").trim().toLowerCase();
  return readAll().find((row) => row.username === u) ?? null;
}

export async function getUserById(id) {
  return readAll().find((row) => row.id === id) ?? null;
}

export async function listUsers() {
  return readAll().map(toPublicUser);
}

/**
 * @param {{ username: string; password: string; nombre?: string; rol?: string; activo?: boolean }} input
 */
export async function createUser(input) {
  const username = String(input.username || "").trim().toLowerCase();
  if (!username) throw new Error("Falta username");
  const passwordStr = String(input.password || "");
  if (passwordStr.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
  const rol = String(input.rol || "operador").toLowerCase();
  if (!ROLES.includes(/** @type {import("../../../lib/auth.mjs").RolUsuario} */ (rol))) {
    throw new Error(`Rol inválido: ${rol}`);
  }
  const rows = readAll();
  if (rows.some((r) => r.username === username)) {
    throw new Error("El usuario ya existe");
  }
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    username,
    nombre: String(input.nombre || username).trim() || username,
    rol,
    password_hash: hashPassword(passwordStr),
    activo: input.activo !== false,
    created_at: now,
    updated_at: now,
  };
  rows.push(row);
  writeAll(rows);
  return toPublicUser(row);
}

/** @param {string} id @param {{ rol?: string; nombre?: string; activo?: boolean }} input */
export async function updateUser(id, input) {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Usuario no encontrado");
  const row = { ...rows[idx] };
  if (input.rol !== undefined) {
    const rol = String(input.rol).toLowerCase();
    if (!ROLES.includes(/** @type {import("../../../lib/auth.mjs").RolUsuario} */ (rol))) {
      throw new Error(`Rol inválido: ${rol}`);
    }
    row.rol = rol;
  }
  if (input.nombre !== undefined) {
    row.nombre = String(input.nombre).trim() || row.username;
  }
  if (input.activo !== undefined) row.activo = !!input.activo;
  row.updated_at = new Date().toISOString();
  rows[idx] = row;
  writeAll(rows);
  return toPublicUser(row);
}

/** Crea admin/admin123 si no hay usuarios (primera instalación). */
export async function ensureSeedAdmin() {
  const rows = readAll();
  if (rows.some((r) => r.username === "admin")) return null;

  const username = process.env.AUTH_SEED_ADMIN_USER?.trim().toLowerCase() || "admin";
  const password = process.env.AUTH_SEED_ADMIN_PASSWORD || "admin123";
  const user = await createUser({
    username,
    password,
    nombre: "Administrador",
    rol: "administrador",
  });
  return user;
}
