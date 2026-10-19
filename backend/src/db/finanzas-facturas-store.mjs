import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "finanzas-facturas.json");
const FILES_DIR = path.join(DATA_DIR, "finanzas", "facturas");

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

function publicRow(row) {
  if (!row) return null;
  const { archivo_path, ...rest } = row;
  return rest;
}

export function finanzasFacturaId() {
  return `FAC-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function saveFacturaArchivo(id, buffer, filename = "factura.pdf") {
  fs.mkdirSync(FILES_DIR, { recursive: true });
  const ext = path.extname(filename || "").toLowerCase() || ".pdf";
  const dest = path.join(FILES_DIR, `${id}${ext}`);
  fs.writeFileSync(dest, buffer);
  return dest;
}

export async function insertFactura(row) {
  const rows = readAll();
  const now = new Date().toISOString();
  const saved = { ...row, created_at: now, updated_at: now };
  rows.unshift(saved);
  writeAll(rows);
  return publicRow(saved);
}

export async function listFacturas({ tipo, limit = 100 } = {}) {
  let rows = readAll();
  if (tipo === "pagar" || tipo === "cobrar") {
    rows = rows.filter((r) => r.tipo === tipo);
  }
  return rows.slice(0, limit).map(publicRow);
}

export async function getFactura(id) {
  return publicRow(readAll().find((r) => r.id === id) ?? null);
}

export async function getFacturaInterna(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function findFacturaPagarDuplicada({ cuit, numero, excludeId } = {}) {
  const cuitN = String(cuit || "").replace(/\D/g, "");
  const nro = String(numero || "").replace(/\s/g, "").toLowerCase();
  if (!cuitN || !nro) return null;
  return (
    readAll().find((r) => {
      if (excludeId && r.id === excludeId) return false;
      if (r.tipo !== "pagar") return false;
      const c = String(r.cuit_emisor || "").replace(/\D/g, "");
      const n = String(r.numero || "").replace(/\s/g, "").toLowerCase();
      return c === cuitN && n === nro;
    }) ?? null
  );
}

export async function updateFactura(id, patch) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
  writeAll(rows);
  return publicRow(rows[i]);
}
