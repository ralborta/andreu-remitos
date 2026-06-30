import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "destinos-pendientes.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export async function crearDestinoPendiente(row) {
  const now = new Date().toISOString();
  const destino = {
    id: row.id ?? `PD-${randomUUID().slice(0, 8).toUpperCase()}`,
    estado: "esperando_cliente",
    historial: row.historial ?? [],
    created_at: now,
    updated_at: now,
    ...row,
    telefono_cliente: sanitizePhone(row.telefono_cliente),
    telefono_chofer: row.telefono_chofer ? sanitizePhone(row.telefono_chofer) : null,
  };
  const rows = readAll();
  rows.unshift(destino);
  writeAll(rows);
  return destino;
}

export async function getDestino(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function getDestinoPendientePorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  const rows = readAll().filter(
    (r) => r.telefono_cliente === phone && r.estado === "esperando_cliente",
  );
  if (rows.length === 0) return null;
  // El más reciente primero (unshift al crear)
  return rows[0];
}

export async function cancelarPendientesPorTelefono(telefono, exceptId) {
  const phone = sanitizePhone(telefono);
  if (!phone) return 0;
  const rows = readAll();
  let n = 0;
  for (const row of rows) {
    if (
      row.telefono_cliente === phone &&
      row.estado === "esperando_cliente" &&
      row.id !== exceptId
    ) {
      row.estado = "cancelado";
      row.updated_at = new Date().toISOString();
      row.historial = [...(row.historial ?? []), "Cancelado — nueva validación iniciada"];
      n++;
    }
  }
  if (n) writeAll(rows);
  return n;
}

export async function actualizarDestino(id, patch) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}

export async function listDestinos({ limit = 50, estado } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  return rows.slice(0, limit);
}
