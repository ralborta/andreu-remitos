import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "remitos.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export async function insertRemito(row) {
  const rows = readAll();
  rows.unshift({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  writeAll(rows);
  return row;
}

export async function listRemitos({ tenant, estado, pendientes, limit = 50 }) {
  let rows = readAll();
  if (tenant) rows = rows.filter((r) => r.tenant === tenant);
  if (pendientes === true || pendientes === "true" || pendientes === "1") {
    rows = rows.filter((r) => r.estado !== "confirmado");
  } else if (estado) {
    const estados = String(estado)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    rows = rows.filter((r) => (estados.length === 1 ? r.estado === estados[0] : estados.includes(r.estado)));
  }
  return rows.slice(0, limit).map(({ texto_ocr, ...rest }) => rest);
}

export async function getRemito(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function updateRemito(id, patch) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}
