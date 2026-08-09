import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  RECLAMO_CRITICIDADES,
  RECLAMO_ESTADOS,
  RECLAMO_MOTIVOS,
} from "../../../lib/reclamos.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "reclamos.json");

const ESTADOS_DIALOG_ABIERTOS = new Set(["recolectando"]);

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

function codigoNuevo() {
  return `RC-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeMotivo(v) {
  const m = String(v || "otro").toLowerCase().trim();
  if (RECLAMO_MOTIVOS.includes(m)) return m;
  // aliases IA
  if (/demora/.test(m)) return "demora_entrega";
  if (/equivoc|incorrect|mal\s*producto|producto\s*mal|no\s*era\s*lo|otro\s*producto/.test(m)) {
    return "producto_equivocado";
  }
  if (/faltante|falta|faltan/.test(m)) return "faltante";
  if (/aver|dañ|dano|roto|rotura|golpead|quebr/.test(m)) return "averia";
  if (/docum|remito|factura/.test(m)) return "documentacion";
  if (/trato|atenci|maltrato/.test(m)) return "trato";
  return "otro";
}

function normalizeCriticidad(v) {
  const c = String(v || "media").toLowerCase().trim();
  return RECLAMO_CRITICIDADES.includes(c) ? c : "media";
}

export async function getReclamoPendientePorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find((r) => r.telefono === phone && ESTADOS_DIALOG_ABIERTOS.has(r.estado)) ??
    null
  );
}

export async function getReclamo(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function crearReclamoDialogo({ telefono, nombre, seed = {} } = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });
  const now = new Date().toISOString();

  // Un solo diálogo abierto por teléfono
  const rows = readAll().filter(
    (r) => !(r.telefono === phone && ESTADOS_DIALOG_ABIERTOS.has(r.estado)),
  );

  const row = {
    id: codigoNuevo(),
    telefono: phone,
    nombre: nombre || null,
    cliente: seed.cliente || nombre || null,
    canal: "whatsapp",
    estado: "recolectando",
    motivo: null,
    criticidad: null,
    viaje_ref: seed.viaje_ref || null,
    remito_ref: seed.remito_ref || null,
    pedido_ref: seed.pedido_ref || null,
    resumen: null,
    detalle: seed.detalle || null,
    imagen_url: seed.imagen_url || null,
    mensajes: [],
    historial: [`${now} · Diálogo iniciado`],
    escalado_a: null,
    nota_interna: null,
    created_at: now,
    updated_at: now,
  };

  rows.unshift(row);
  writeAll(rows.slice(0, 800));
  return row;
}

export async function actualizarReclamo(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];

  if (patch.nombre !== undefined) row.nombre = patch.nombre;
  if (patch.cliente !== undefined) row.cliente = patch.cliente;
  if (patch.estado && RECLAMO_ESTADOS.includes(patch.estado)) row.estado = patch.estado;
  if (patch.motivo !== undefined) row.motivo = normalizeMotivo(patch.motivo);
  if (patch.criticidad !== undefined) row.criticidad = normalizeCriticidad(patch.criticidad);
  if (patch.viaje_ref !== undefined) row.viaje_ref = patch.viaje_ref;
  if (patch.remito_ref !== undefined) row.remito_ref = patch.remito_ref;
  if (patch.pedido_ref !== undefined) row.pedido_ref = patch.pedido_ref;
  if (patch.resumen !== undefined) row.resumen = patch.resumen;
  if (patch.detalle !== undefined) row.detalle = patch.detalle;
  if (patch.imagen_url !== undefined) row.imagen_url = patch.imagen_url;
  if (patch.escalado_a !== undefined) row.escalado_a = patch.escalado_a;
  if (patch.nota_interna !== undefined) row.nota_interna = patch.nota_interna;
  if (patch.mensaje_push) {
    row.mensajes = [...(row.mensajes || []), patch.mensaje_push].slice(-40);
  }
  if (patch.historial_push) {
    row.historial = [...(row.historial || []), patch.historial_push];
  }

  row.updated_at = new Date().toISOString();
  rows[i] = row;
  writeAll(rows);
  return row;
}

/** Cierra el diálogo: pasa a nuevo/escalado con datos clasificados. */
export async function abrirCasoDesdeDialogo(id, { motivo, criticidad, resumen, detalle, viaje_ref, remito_ref, pedido_ref, imagen_url, escalar = false, escalado_a = null } = {}) {
  const now = new Date().toISOString();
  return actualizarReclamo(id, {
    estado: escalar ? "escalado" : "nuevo",
    motivo: motivo || "otro",
    criticidad: criticidad || "media",
    resumen,
    detalle,
    viaje_ref,
    remito_ref,
    pedido_ref,
    imagen_url: imagen_url || undefined,
    escalado_a: escalar ? escalado_a || "Coordinación operativa" : null,
    historial_push: `${now} · Caso ${escalar ? "escalado" : "abierto"}`,
  });
}

export async function decidirReclamo(id, { estado, nota, aprobado_por } = {}) {
  if (!["en_proceso", "escalado", "resuelto"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido"), { statusCode: 400 });
  }
  const now = new Date().toISOString();
  return actualizarReclamo(id, {
    estado,
    nota_interna: nota || null,
    historial_push: `${now} · ${estado}${aprobado_por ? ` · ${aprobado_por}` : ""}${nota ? ` · ${nota}` : ""}`,
  });
}

export async function listReclamos({ limit = 100, estado, telefono } = {}) {
  let rows = readAll();
  if (telefono) {
    const phone = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === phone);
  }
  if (estado && estado !== "todos") {
    rows = rows.filter((r) => r.estado === estado);
  }
  // No listar diálogos a medias en cola operativa por defecto
  if (!estado || estado === "todos") {
    rows = rows.filter((r) => r.estado !== "recolectando");
  }
  return rows.slice(0, limit);
}

export async function resumenReclamos() {
  const rows = readAll().filter((r) => r.estado !== "recolectando");
  const count = (e) => rows.filter((r) => r.estado === e).length;
  return {
    abiertos: count("nuevo") + count("en_proceso") + count("escalado"),
    nuevo: count("nuevo"),
    en_proceso: count("en_proceso"),
    escalado: count("escalado"),
    resuelto: count("resuelto"),
    total: rows.length,
  };
}
