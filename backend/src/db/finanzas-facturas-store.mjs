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

export async function appendPasoFactura(id, paso) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const pasos = Array.isArray(rows[i].pasos) ? [...rows[i].pasos, paso] : [paso];
  rows[i] = { ...rows[i], pasos, updated_at: new Date().toISOString() };
  writeAll(rows);
  return publicRow(rows[i]);
}

export async function findFacturaCobrarDuplicada({ numero, excludeId } = {}) {
  const nro = String(numero || "").replace(/\s/g, "").toLowerCase();
  if (!nro) return null;
  return (
    readAll().find((r) => {
      if (excludeId && r.id === excludeId) return false;
      if (r.tipo !== "cobrar") return false;
      return String(r.numero || "").replace(/\s/g, "").toLowerCase() === nro;
    }) ?? null
  );
}

function isoDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Demo SOL: facturas a cobrar que “vinieron por sistema”. */
export async function ensureSeedFacturasCobrar() {
  const rows = readAll();
  if (rows.some((r) => r.tipo === "cobrar")) return false;
  const now = new Date().toISOString();
  const seed = [
    {
      id: "FAC-SYS-0001",
      tipo: "cobrar",
      origen: "sistema",
      estado: "abierta",
      tipo_comprobante: "A",
      punto_venta: "0003",
      numero: "A-0003-00018421",
      fecha: isoDateOffset(-20),
      fecha_vto: isoDateOffset(-5),
      cuit_emisor: "30-71111111-2",
      razon_social: "TSB Logística S.A.",
      cuit_receptor: "30-70000000-4",
      telefono: "5492615551001",
      email: "cobranzas.tsb@example.com",
      monto: 1482500,
      monto_aplicado: 0,
      moneda: "ARS",
      cae: null,
      confianza: 1,
      pasos: [{ at: now, agente: "facturas", label: "Emitida por sistema" }],
      created_at: now,
      updated_at: now,
    },
    {
      id: "FAC-SYS-0002",
      tipo: "cobrar",
      origen: "sistema",
      estado: "abierta",
      tipo_comprobante: "A",
      punto_venta: "0001",
      numero: "A-0001-00009012",
      fecha: isoDateOffset(-8),
      fecha_vto: isoDateOffset(4),
      cuit_emisor: "30-72222222-9",
      razon_social: "Beraldi Transportes",
      cuit_receptor: "30-70000000-4",
      telefono: "5492615551002",
      email: "admin@beraldi.example",
      monto: 890000,
      monto_aplicado: 0,
      moneda: "ARS",
      cae: null,
      confianza: 1,
      pasos: [{ at: now, agente: "facturas", label: "Emitida por sistema" }],
      created_at: now,
      updated_at: now,
    },
    {
      id: "FAC-SYS-0003",
      tipo: "cobrar",
      origen: "sistema",
      estado: "abierta",
      tipo_comprobante: "B",
      punto_venta: "0008",
      numero: "B-0008-00004410",
      fecha: isoDateOffset(-35),
      fecha_vto: isoDateOffset(-12),
      cuit_emisor: "30-73333333-5",
      razon_social: "MYE Cargas",
      cuit_receptor: "30-70000000-4",
      telefono: "5492615551003",
      email: "pagos@mye.example",
      monto: 312400,
      monto_aplicado: 0,
      moneda: "ARS",
      cae: null,
      confianza: 1,
      pasos: [{ at: now, agente: "facturas", label: "Emitida por sistema" }],
      created_at: now,
      updated_at: now,
    },
  ];
  writeAll([...seed, ...rows]);
  return true;
}
