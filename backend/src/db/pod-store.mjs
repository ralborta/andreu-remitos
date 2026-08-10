/**
 * Store POD (Proof of Delivery).
 * Archivo: DATA_DIR/pod-casos.json
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  POD_ESTADOS,
  POD_ESTADOS_DIALOG,
  buildCodigoPod,
} from "../../../lib/pod.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "pod-casos.json");

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

export async function listPods({ limit = 100, estado, telefono } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  return rows.slice(0, Math.min(Number(limit) || 100, 200));
}

export async function getPod(idOrCodigo) {
  const key = String(idOrCodigo || "");
  return (
    readAll().find((r) => r.id === key || r.codigo === key) ?? null
  );
}

export async function getPodPendientePorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find(
      (r) => r.telefono === phone && POD_ESTADOS_DIALOG.has(r.estado),
    ) ?? null
  );
}

export async function crearPod(body = {}) {
  const phone = sanitizePhone(body.telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });

  const now = new Date().toISOString();
  let rows = readAll().filter(
    (r) => !(r.telefono === phone && POD_ESTADOS_DIALOG.has(r.estado)),
  );

  let estado = String(body.estado || "esperando_receptor");
  if (!POD_ESTADOS.includes(estado)) estado = "esperando_receptor";

  const row = {
    id: `POD-${randomUUID().slice(0, 8).toUpperCase()}`,
    codigo: null,
    estado,
    telefono: phone,
    chofer_nombre: body.chofer_nombre || body.nombre || null,
    receptor_nombre: body.receptor_nombre ? String(body.receptor_nombre).trim() : null,
    imagen_url: body.imagen_url || null,
    viaje_ref: body.viaje_ref || null,
    destino: body.destino || null,
    destino_id: body.destino_id || null,
    nota_chofer: body.nota_chofer || null,
    nota_backoffice: null,
    aprobado_por: null,
    historial: [`${now} · Creado (${estado})`],
    created_at: now,
    updated_at: now,
  };

  if (estado === "pendiente" || estado === "ok") {
    row.codigo = buildCodigoPod(rows);
  }

  rows.unshift(row);
  writeAll(rows);
  return row;
}

export async function actualizarPod(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();

  for (const k of [
    "receptor_nombre",
    "imagen_url",
    "viaje_ref",
    "destino",
    "destino_id",
    "nota_chofer",
    "nota_backoffice",
    "aprobado_por",
    "chofer_nombre",
  ]) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }

  if (patch.estado && POD_ESTADOS.includes(patch.estado)) {
    row.estado = patch.estado;
  }

  if (
    (row.estado === "pendiente" || row.estado === "ok") &&
    !row.codigo
  ) {
    row.codigo = buildCodigoPod(rows);
  }

  if (Array.isArray(patch.historial)) {
    row.historial = patch.historial;
  } else if (patch.historial_push) {
    row.historial = [...(row.historial || []), `${now} · ${patch.historial_push}`];
  }

  row.updated_at = now;
  rows[i] = row;
  writeAll(rows);
  return row;
}

export async function decidirPod(id, { estado, nota, aprobado_por } = {}) {
  if (!["ok", "rechazado"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido"), { statusCode: 400 });
  }
  const now = new Date().toISOString();
  return actualizarPod(id, {
    estado,
    nota_backoffice: nota ? String(nota).trim() : null,
    aprobado_por: aprobado_por || null,
    historial_push: `Decisión: ${estado}${nota ? ` — ${nota}` : ""}`,
  });
}

export async function resumenPods() {
  const rows = readAll().filter(
    (r) => !POD_ESTADOS_DIALOG.has(r.estado),
  );
  const pendientes = rows.filter((r) => r.estado === "pendiente").length;
  const ok = rows.filter((r) => r.estado === "ok").length;
  const rechazados = rows.filter((r) => r.estado === "rechazado").length;
  const dialog = readAll().filter((r) => POD_ESTADOS_DIALOG.has(r.estado)).length;
  return {
    total: rows.length,
    pendientes,
    ok,
    rechazados,
    en_dialogo: dialog,
  };
}
