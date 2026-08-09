import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "viajes-solicitudes.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  return Array.isArray(raw) ? raw : [];
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export async function getSolicitudPendientePorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find(
      (r) =>
        r.telefono === phone &&
        (r.estado === "recolectando" || r.estado === "esperando_confirmacion_chofer"),
    ) ?? null
  );
}

export async function crearSolicitud({ telefono, nombre, datos = {} }) {
  const phone = sanitizePhone(telefono);
  const now = new Date().toISOString();
  const row = {
    id: `VS-${randomUUID().slice(0, 8).toUpperCase()}`,
    estado: "recolectando",
    telefono: phone,
    nombre: nombre || null,
    datos: {
      cliente: null,
      origen: null,
      destino: null,
      toneladas: null,
      tipo_carga: null,
      fecha_retiro: null,
      notas: null,
      ...datos,
    },
    historial: [`${now} · Solicitud iniciada`],
    viaje_id: null,
    created_at: now,
    updated_at: now,
  };
  const rows = readAll().filter(
    (r) => !(r.telefono === phone && r.estado === "recolectando"),
  );
  rows.unshift(row);
  writeAll(rows);
  return row;
}

export async function actualizarSolicitud(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  if (patch.datos) row.datos = { ...row.datos, ...patch.datos };
  if (patch.estado) row.estado = patch.estado;
  if (patch.viaje_id !== undefined) row.viaje_id = patch.viaje_id;
  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.historial_push) {
    row.historial = [...(row.historial ?? []), patch.historial_push];
  }
  row.updated_at = new Date().toISOString();
  writeAll(rows);
  return row;
}

export async function listSolicitudes({ limit = 50 } = {}) {
  return readAll().slice(0, limit);
}
