import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  formatearCodigoViaje,
  normalizarAltaViaje,
  puedeTransicionar,
  VIAJE_ESTADOS,
} from "../../../lib/viajes.mjs";
import { syncViajeConfirmado, syncViajeEstado } from "../../../lib/tms/adapter.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "viajes.json");

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

function nextCodigo(rows, fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  const prefix = `VJ-${y}${m}${d}-`;
  let max = 0;
  for (const r of rows) {
    const c = String(r.codigo || "");
    if (!c.startsWith(prefix)) continue;
    const n = parseInt(c.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return formatearCodigoViaje(fecha, max + 1);
}

function pushHist(row, msg) {
  row.historial = [...(row.historial ?? []), `${new Date().toISOString()} · ${msg}`];
}

export async function listViajes({ limit = 100, estado, tenant } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (tenant) rows = rows.filter((r) => r.tenant === tenant);
  return rows.slice(0, limit);
}

export async function getViaje(id) {
  return readAll().find((r) => r.id === id || r.codigo === id) ?? null;
}

export async function crearViaje(body) {
  const data = normalizarAltaViaje(body);
  const rows = readAll();
  const now = new Date().toISOString();
  const codigo = nextCodigo(rows);
  const viaje = {
    id: `viaje_${randomUUID().slice(0, 8)}`,
    codigo,
    estado: "solicitado",
    historial: [`${now} · Viaje creado`],
    created_at: now,
    updated_at: now,
    ...data,
  };
  rows.unshift(viaje);
  writeAll(rows);
  return viaje;
}

export async function actualizarViaje(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id || r.codigo === id);
  if (i < 0) return null;
  const row = rows[i];
  const allowed = [
    "cliente",
    "origen",
    "destino",
    "carga",
    "fecha",
    "tenant",
    "chofer",
    "telefono_chofer",
    "tractor",
    "semi",
    "notas",
    "remito_ids",
    "destino_validacion_id",
    "tms_id",
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (patch.telefonoChofer !== undefined) row.telefono_chofer = patch.telefonoChofer;
  if (patch.destinoValidacionId !== undefined) row.destino_validacion_id = patch.destinoValidacionId;
  if (patch.tmsId !== undefined) row.tms_id = patch.tmsId;
  row.updated_at = new Date().toISOString();
  pushHist(row, "Datos actualizados");
  writeAll(rows);
  return row;
}

export async function cambiarEstadoViaje(id, nuevoEstado) {
  if (!VIAJE_ESTADOS.includes(nuevoEstado)) {
    throw Object.assign(new Error(`Estado inválido: ${nuevoEstado}`), { statusCode: 400 });
  }
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id || r.codigo === id);
  if (i < 0) return null;
  const row = rows[i];
  if (row.estado === nuevoEstado) return row;
  if (!puedeTransicionar(row.estado, nuevoEstado)) {
    throw Object.assign(
      new Error(`No se puede pasar de ${row.estado} a ${nuevoEstado}`),
      { statusCode: 400 },
    );
  }

  const prev = row.estado;
  row.estado = nuevoEstado;
  row.updated_at = new Date().toISOString();
  pushHist(row, `Estado: ${prev} → ${nuevoEstado}`);

  // Ganchos TMS (no-op si TMS_ENABLED no está)
  if (nuevoEstado === "confirmado") {
    const sync = await syncViajeConfirmado(row);
    if (sync.skipped) {
      pushHist(row, "TMS: sync omitido (sin conector)");
    } else if (sync.ok) {
      row.tms_id = sync.tms_id ?? row.tms_id;
      row.tms_sync_status = "synced";
      row.tms_synced_at = new Date().toISOString();
      pushHist(row, `TMS: sincronizado (${row.tms_id || "ok"})`);
    } else {
      row.tms_sync_status = "error";
      pushHist(row, `TMS: error — ${sync.error || "desconocido"}`);
    }
  } else if (["asignado", "en_curso", "entregado", "cerrado", "cancelado"].includes(nuevoEstado)) {
    const sync = await syncViajeEstado(row);
    if (!sync.skipped && !sync.ok) {
      row.tms_sync_status = "error";
      pushHist(row, `TMS estado: error — ${sync.error || "desconocido"}`);
    }
  }

  writeAll(rows);
  return row;
}

export async function eliminarViaje(id) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id || r.codigo === id);
  if (i < 0) return false;
  rows.splice(i, 1);
  writeAll(rows);
  return true;
}
