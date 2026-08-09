/**
 * Maestros de flota para Gestión de Viajes (NO son los de Remitos/Parámetros).
 * Archivo: DATA_DIR/viajes-flota-maestros.json
 *
 * - choferes: nombre, teléfono WA, días de la semana, horarios, excepciones por fecha
 * - camiones: patente, tipo, tipos de carga, capacidad, días, horarios, excepciones
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_FLOTA } from "../seed/demo-flota.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "viajes-flota-maestros.json");

const DIAS_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function isoHoy() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoPlus(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyDb() {
  return { choferes: [], camiones: [], updated_at: null };
}

function readRaw() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return emptyDb();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return {
      choferes: Array.isArray(raw.choferes) ? raw.choferes : [],
      camiones: Array.isArray(raw.camiones) ? raw.camiones : [],
      updated_at: raw.updated_at ?? null,
    };
  } catch {
    return emptyDb();
  }
}

function writeRaw(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const out = {
    ...db,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2));
  return out;
}

function normTipos(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  return String(v ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function normDias(v) {
  if (!Array.isArray(v) || !v.length) return [1, 2, 3, 4, 5, 6];
  return [...new Set(v.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))];
}

function normHorarios(v) {
  if (!Array.isArray(v) || !v.length) return ["08:00", "11:00", "14:00"];
  return v
    .map((h) => String(h).trim())
    .filter((h) => /^\d{1,2}:\d{2}$/.test(h))
    .map((h) => {
      const [a, b] = h.split(":");
      return `${String(Number(a)).padStart(2, "0")}:${b}`;
    });
}

function seedCamion(c) {
  const excepciones = {};
  if (c.horarios_offset && typeof c.horarios_offset === "object") {
    for (const [off, horas] of Object.entries(c.horarios_offset)) {
      const fecha = isoPlus(Number(off) || 0);
      excepciones[fecha] = normHorarios(horas);
    }
  }
  return {
    id: c.id || `CAM-${randomUUID().slice(0, 6).toUpperCase()}`,
    tractor: c.tractor,
    semi: c.semi ?? null,
    tipo: c.tipo || "general",
    tipos_carga: normTipos(c.tipos_carga),
    capacidad_t: Number(c.capacidad_t) || 28,
    activo: c.disponible !== false,
    dias_semana: normDias(
      Array.isArray(c.disponibilidad_dias) && c.disponibilidad_dias.length >= 7
        ? [0, 1, 2, 3, 4, 5, 6]
        : [1, 2, 3, 4, 5, 6],
    ),
    horarios: normHorarios(c.horarios),
    excepciones,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function seedChofer(c) {
  const excepciones = {};
  if (c.horarios_offset && typeof c.horarios_offset === "object") {
    for (const [off, horas] of Object.entries(c.horarios_offset)) {
      const fecha = isoPlus(Number(off) || 0);
      excepciones[fecha] = normHorarios(horas);
    }
  }
  return {
    id: c.id || `CHF-${randomUUID().slice(0, 6).toUpperCase()}`,
    nombre: c.nombre,
    telefono: String(c.telefono || "").replace(/\D/g, ""),
    licencia: c.licencia || "E",
    activo: c.disponible !== false,
    dias_semana: normDias(
      Array.isArray(c.disponibilidad_dias) && c.disponibilidad_dias.length >= 7
        ? [0, 1, 2, 3, 4, 5, 6]
        : [1, 2, 3, 4, 5, 6],
    ),
    horarios: normHorarios(c.horarios),
    excepciones,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Si no hay maestros, carga el seed de Gestión de Viajes (independiente de Remitos). */
export function ensureViajesFlotaSeeded() {
  const db = readRaw();
  if (db.choferes.length || db.camiones.length) return db;
  const seeded = {
    choferes: (DEMO_FLOTA.choferes || []).map(seedChofer),
    camiones: (DEMO_FLOTA.camiones || []).map(seedCamion),
  };
  return writeRaw(seeded);
}

export function getViajesFlotaMaestros() {
  return ensureViajesFlotaSeeded();
}

export function listChoferesViajes() {
  return getViajesFlotaMaestros().choferes;
}

export function listCamionesViajes() {
  return getViajesFlotaMaestros().camiones;
}

export function crearChoferViajes(body = {}) {
  const db = getViajesFlotaMaestros();
  const now = new Date().toISOString();
  const row = {
    id: `CHF-${randomUUID().slice(0, 6).toUpperCase()}`,
    nombre: String(body.nombre ?? "").trim(),
    telefono: String(body.telefono ?? "").replace(/\D/g, ""),
    licencia: String(body.licencia ?? "E").trim() || "E",
    activo: body.activo !== false,
    dias_semana: normDias(body.dias_semana ?? body.diasSemana),
    horarios: normHorarios(body.horarios),
    excepciones:
      body.excepciones && typeof body.excepciones === "object" ? body.excepciones : {},
    created_at: now,
    updated_at: now,
  };
  if (!row.nombre) throw Object.assign(new Error("Falta nombre del chofer"), { statusCode: 400 });
  db.choferes.unshift(row);
  writeRaw(db);
  return row;
}

export function actualizarChoferViajes(id, patch = {}) {
  const db = getViajesFlotaMaestros();
  const i = db.choferes.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const row = db.choferes[i];
  if (patch.nombre !== undefined) row.nombre = String(patch.nombre).trim();
  if (patch.telefono !== undefined) row.telefono = String(patch.telefono).replace(/\D/g, "");
  if (patch.licencia !== undefined) row.licencia = String(patch.licencia).trim() || "E";
  if (patch.activo !== undefined) row.activo = Boolean(patch.activo);
  if (patch.dias_semana !== undefined || patch.diasSemana !== undefined) {
    row.dias_semana = normDias(patch.dias_semana ?? patch.diasSemana);
  }
  if (patch.horarios !== undefined) row.horarios = normHorarios(patch.horarios);
  if (patch.excepciones !== undefined && typeof patch.excepciones === "object") {
    row.excepciones = patch.excepciones;
  }
  row.updated_at = new Date().toISOString();
  writeRaw(db);
  return row;
}

export function eliminarChoferViajes(id) {
  const db = getViajesFlotaMaestros();
  const before = db.choferes.length;
  db.choferes = db.choferes.filter((c) => c.id !== id);
  if (db.choferes.length === before) return false;
  writeRaw(db);
  return true;
}

export function crearCamionViajes(body = {}) {
  const db = getViajesFlotaMaestros();
  const now = new Date().toISOString();
  const row = {
    id: `CAM-${randomUUID().slice(0, 6).toUpperCase()}`,
    tractor: String(body.tractor ?? body.patente ?? "").trim().toUpperCase(),
    semi: String(body.semi ?? "").trim().toUpperCase() || null,
    tipo: String(body.tipo ?? "sider").trim().toLowerCase() || "sider",
    tipos_carga: normTipos(body.tipos_carga ?? body.tiposCarga),
    capacidad_t: Number(body.capacidad_t ?? body.capacidadT ?? 28) || 28,
    activo: body.activo !== false,
    dias_semana: normDias(body.dias_semana ?? body.diasSemana),
    horarios: normHorarios(body.horarios),
    excepciones:
      body.excepciones && typeof body.excepciones === "object" ? body.excepciones : {},
    created_at: now,
    updated_at: now,
  };
  if (!row.tractor) throw Object.assign(new Error("Falta patente del camión"), { statusCode: 400 });
  db.camiones.unshift(row);
  writeRaw(db);
  return row;
}

export function actualizarCamionViajes(id, patch = {}) {
  const db = getViajesFlotaMaestros();
  const i = db.camiones.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const row = db.camiones[i];
  if (patch.tractor !== undefined || patch.patente !== undefined) {
    row.tractor = String(patch.tractor ?? patch.patente).trim().toUpperCase();
  }
  if (patch.semi !== undefined) row.semi = String(patch.semi).trim().toUpperCase() || null;
  if (patch.tipo !== undefined) row.tipo = String(patch.tipo).trim().toLowerCase();
  if (patch.tipos_carga !== undefined || patch.tiposCarga !== undefined) {
    row.tipos_carga = normTipos(patch.tipos_carga ?? patch.tiposCarga);
  }
  if (patch.capacidad_t !== undefined || patch.capacidadT !== undefined) {
    row.capacidad_t = Number(patch.capacidad_t ?? patch.capacidadT) || row.capacidad_t;
  }
  if (patch.activo !== undefined) row.activo = Boolean(patch.activo);
  if (patch.dias_semana !== undefined || patch.diasSemana !== undefined) {
    row.dias_semana = normDias(patch.dias_semana ?? patch.diasSemana);
  }
  if (patch.horarios !== undefined) row.horarios = normHorarios(patch.horarios);
  if (patch.excepciones !== undefined && typeof patch.excepciones === "object") {
    row.excepciones = patch.excepciones;
  }
  row.updated_at = new Date().toISOString();
  writeRaw(db);
  return row;
}

export function eliminarCamionViajes(id) {
  const db = getViajesFlotaMaestros();
  const before = db.camiones.length;
  db.camiones = db.camiones.filter((c) => c.id !== id);
  if (db.camiones.length === before) return false;
  writeRaw(db);
  return true;
}

/** Formato listo para el motor de match. */
export function flotaParaMatch() {
  const db = getViajesFlotaMaestros();
  return {
    fuente: FILE,
    choferes: db.choferes.map((c) => ({
      ...c,
      disponible: c.activo !== false,
    })),
    camiones: db.camiones.map((c) => ({
      ...c,
      disponible: c.activo !== false,
    })),
  };
}

export { DIAS_LABEL, isoHoy };
