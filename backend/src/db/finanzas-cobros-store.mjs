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

const DEMO_COBRO_IDS = ["COB-SYS-0001"];

function isoAtOffset(days, hours = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, 20, 0, 0);
  return d.toISOString();
}

/** Mismo ejemplo que MYE B-0008-00004410: cobro de pasarela aún sin imputar. */
export async function ensureSeedCobrosDemo() {
  const now = new Date().toISOString();
  const settled = isoAtOffset(-1, 14);
  const seed = [
    {
      id: "COB-SYS-0001",
      origen: "pasarela",
      estado: "pendiente",
      monto: 312400,
      moneda: "ARS",
      external_ref: "PAS-MYE-4410",
      cuit: "30-73333333-5",
      factura_id: null,
      factura_numero: "B-0008-00004410",
      settled_at: settled,
      metadata: { cliente: "MYE Cargas", nota: "Transferencia Cucuru / demo SOL" },
      created_at: settled,
      updated_at: now,
    },
  ];
  const rows = readAll();
  if (rows.some((r) => r.id === "COB-SYS-0001")) return false;
  writeAll([...seed, ...rows]);
  return true;
}

export async function updateCobro(id, patch) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}
