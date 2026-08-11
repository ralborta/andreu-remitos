/**
 * Store de gastos / rendición (SOL).
 * Archivo: DATA_DIR/rendicion-gastos.json
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  GASTO_ESTADOS,
  RENDICION_CATEGORIAS,
} from "../../../lib/rendicion.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "rendicion-gastos.json");

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
  const n = rows.length + 1;
  return `RG-${String(n).padStart(4, "0")}`;
}

export async function listGastos({ limit = 100, estado, telefono } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  return rows.slice(0, limit);
}

export async function getGasto(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function crearGasto(body = {}) {
  const rows = readAll();
  const now = new Date().toISOString();
  const phone = sanitizePhone(body.telefono);
  let categoria = String(body.categoria || "otro").toLowerCase().trim();
  if (!RENDICION_CATEGORIAS.includes(categoria)) categoria = "otro";
  let estado = String(body.estado || "pendiente_aprobacion");
  if (!GASTO_ESTADOS.includes(estado)) estado = "pendiente_aprobacion";

  const row = {
    id: `RG-${randomUUID().slice(0, 8).toUpperCase()}`,
    codigo: nextCodigo(rows),
    estado,
    categoria,
    monto: body.monto != null && Number.isFinite(Number(body.monto)) ? Number(body.monto) : null,
    moneda: body.moneda || "ARS",
    proveedor: body.proveedor ? String(body.proveedor).trim() : null,
    fecha_comprobante: body.fecha_comprobante || null,
    descripcion: body.descripcion ? String(body.descripcion).trim() : null,
    viaje_ref: body.viaje_ref ? String(body.viaje_ref).trim() : null,
    telefono: phone || null,
    chofer_nombre: body.chofer_nombre || body.nombre || null,
    imagen_url: body.imagen_url || null,
    nota_chofer: body.nota_chofer || null,
    texto_ocr: body.texto_ocr ? String(body.texto_ocr).slice(0, 12000) : null,
    nota_aprobacion: null,
    aprobado_por: null,
    historial: [`${now} · Creado (${estado})`],
    created_at: now,
    updated_at: now,
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

export async function actualizarGasto(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();

  for (const k of [
    "categoria",
    "monto",
    "moneda",
    "proveedor",
    "fecha_comprobante",
    "descripcion",
    "viaje_ref",
    "chofer_nombre",
    "imagen_url",
    "nota_chofer",
    "texto_ocr",
    "nota_aprobacion",
    "aprobado_por",
  ]) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (patch.texto_ocr !== undefined && patch.texto_ocr != null) {
    row.texto_ocr = String(patch.texto_ocr).slice(0, 12000);
  }
  if (patch.monto != null) row.monto = Number(patch.monto);
  if (patch.categoria && RENDICION_CATEGORIAS.includes(patch.categoria)) {
    row.categoria = patch.categoria;
  }
  if (patch.estado && GASTO_ESTADOS.includes(patch.estado)) {
    row.estado = patch.estado;
  }
  if (patch.historial_push) {
    row.historial = [...(row.historial ?? []), patch.historial_push];
  }
  row.updated_at = now;
  writeAll(rows);
  return row;
}

export async function decidirGasto(id, { estado, nota, aprobado_por } = {}) {
  if (!["aprobado", "rechazado"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido (aprobado|rechazado)"), { statusCode: 400 });
  }
  return actualizarGasto(id, {
    estado,
    nota_aprobacion: nota || null,
    aprobado_por: aprobado_por || "backoffice",
    historial_push: `${new Date().toISOString()} · ${estado}${nota ? `: ${nota}` : ""}`,
  });
}

export async function resumenGastos() {
  const rows = readAll();
  const sum = (est) =>
    rows.filter((r) => r.estado === est).reduce((a, r) => a + (Number(r.monto) || 0), 0);
  return {
    total: rows.length,
    pendientes: rows.filter((r) => r.estado === "pendiente_aprobacion").length,
    aprobados: rows.filter((r) => r.estado === "aprobado").length,
    rechazados: rows.filter((r) => r.estado === "rechazado").length,
    monto_pendiente: sum("pendiente_aprobacion"),
    monto_aprobado: sum("aprobado"),
  };
}
