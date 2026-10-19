import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "finanzas-cobros.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export function finanzasCobroId() {
  return `COB-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function listCobros({ estado, limit = 100 } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  return rows.slice(0, limit);
}

export async function getCobro(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function findCobroByExternalRef(ref) {
  const key = String(ref || "").trim();
  if (!key) return null;
  return readAll().find((r) => r.external_ref === key) ?? null;
}

export async function insertCobro(row) {
  const rows = readAll();
  const now = new Date().toISOString();
  const saved = { ...row, created_at: now, updated_at: now };
  rows.unshift(saved);
  writeAll(rows);
  return saved;
}

export async function updateCobro(id, patch) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}
