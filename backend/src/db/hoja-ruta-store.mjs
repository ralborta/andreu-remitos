/**
 * Store de hojas de ruta (Andreu) — ancla parcial de viaje/anticipo.
 * Archivo: DATA_DIR/hojas-ruta.json
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "hojas-ruta.json");

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

function nextCodigo(rows) {
  return `HR-${String(rows.length + 1).padStart(4, "0")}`;
}

function normStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export async function listHojasRuta({ limit = 50, telefono } = {}) {
  let rows = readAll();
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  return rows.slice(0, limit);
}

export async function getHojaRuta(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function crearHojaRuta(body = {}) {
  const rows = readAll();
  const now = new Date().toISOString();
  const phone = sanitizePhone(body.telefono);
  const row = {
    id: `HR-${randomUUID().slice(0, 8).toUpperCase()}`,
    codigo: nextCodigo(rows),
    telefono: phone || null,
    chofer_nombre: normStr(body.chofer_nombre || body.nombre),
    nro_viaje_delfos: normStr(body.nro_viaje_delfos),
    patente: normStr(body.patente),
    patente_semi: normStr(body.patente_semi),
    fecha_salida: body.fecha_salida || null,
    fecha_llegada: body.fecha_llegada || null,
    anticipo_monto:
      body.anticipo_monto != null && Number.isFinite(Number(body.anticipo_monto))
        ? Number(body.anticipo_monto)
        : null,
    peajes: Array.isArray(body.peajes) ? body.peajes : [],
    imagen_url: body.imagen_url || null,
    texto_ocr: body.texto_ocr ? String(body.texto_ocr).slice(0, 16000) : null,
    nota_chofer: normStr(body.nota_chofer),
    confianza: body.confianza != null ? Number(body.confianza) : null,
    fuente: body.fuente || null,
    estado: body.estado || "pendiente_revision",
    historial: [`${now} · Creada`],
    created_at: now,
    updated_at: now,
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

/** Hojas recientes del chofer para sugerir Nº Delfos al aprobar peajes. */
export async function sugerirDesdeHojasRuta({ telefono, limit = 5 } = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) return [];
  const rows = (await listHojasRuta({ limit: 40, telefono: phone })).filter(
    (r) => r.nro_viaje_delfos,
  );
  return rows.slice(0, limit).map((r) => ({
    hojaId: r.id,
    codigo: r.codigo,
    nroViajeDelfos: r.nro_viaje_delfos,
    anticipoMonto: r.anticipo_monto,
    patente: r.patente,
    fechaSalida: r.fecha_salida,
    fechaLlegada: r.fecha_llegada,
    choferNombre: r.chofer_nombre,
    createdAt: r.created_at,
    fuente: "hoja_ruta",
  }));
}

/** Busca hoja del chofer por Nº viaje Delfos (para comando viaje NNNNN). */
export async function findHojaPorNroViaje({ telefono, nroViajeDelfos } = {}) {
  const phone = sanitizePhone(telefono);
  const nro = String(nroViajeDelfos || "").trim();
  if (!phone || !nro) return null;
  const rows = await listHojasRuta({ limit: 80, telefono: phone });
  return (
    rows.find((r) => String(r.nro_viaje_delfos || "").trim() === nro) || null
  );
}
