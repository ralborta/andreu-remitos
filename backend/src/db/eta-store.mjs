import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "eta-notificaciones.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

/**
 * @param {{
 *   fuente: "destino" | "incidencia" | "viaje",
 *   ref_id: string,
 *   telefono_cliente: string,
 *   cliente?: string | null,
 *   eta_texto?: string | null,
 *   tipo: "eta" | "demora" | "actualizacion",
 *   mensaje: string,
 *   viaje_ref?: string | null,
 * }} body
 */
export async function registrarNotificacion(body) {
  const rows = readAll();
  const row = {
    id: randomUUID(),
    fuente: body.fuente,
    ref_id: body.ref_id,
    telefono_cliente: body.telefono_cliente,
    cliente: body.cliente ?? null,
    eta_texto: body.eta_texto ?? null,
    tipo: body.tipo,
    mensaje: body.mensaje,
    viaje_ref: body.viaje_ref ?? null,
    created_at: new Date().toISOString(),
  };
  rows.unshift(row);
  writeAll(rows.slice(0, 500));
  return row;
}

export async function listNotificaciones({ limit = 40 } = {}) {
  return readAll().slice(0, Math.min(Number(limit) || 40, 200));
}

export async function resumenNotificaciones() {
  const rows = readAll();
  const hoy = new Date().toISOString().slice(0, 10);
  const hoyRows = rows.filter((r) => String(r.created_at || "").startsWith(hoy));
  return {
    total: rows.length,
    hoy: hoyRows.length,
    demorasHoy: hoyRows.filter((r) => r.tipo === "demora").length,
    etasHoy: hoyRows.filter((r) => r.tipo === "eta" || r.tipo === "actualizacion").length,
  };
}
