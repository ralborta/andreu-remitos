import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  buildCodigoReclamo,
  extractCodigoReclamo,
  RECLAMO_CRITICIDADES,
  RECLAMO_ESTADOS,
  RECLAMO_MOTIVOS,
} from "../../../lib/reclamos.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "reclamos.json");

const ESTADOS_DIALOG_ABIERTOS = new Set(["recolectando"]);
const ESTADOS_CASO_ACTIVOS = new Set(["nuevo", "en_proceso", "escalado"]);

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

function idInterno() {
  return `RID-${randomUUID().slice(0, 10).toUpperCase()}`;
}

function normalizeMotivo(v) {
  const m = String(v || "otro").toLowerCase().trim();
  if (RECLAMO_MOTIVOS.includes(m)) return m;
  if (/demora|retraso|tard/.test(m)) return "demora_entrega";
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

export async function getReclamo(idOrCodigo) {
  const key = String(idOrCodigo || "").trim();
  if (!key) return null;
  const rows = readAll();
  const byId = rows.find((r) => r.id === key);
  if (byId) return byId;
  const codigo = extractCodigoReclamo(key) || key.toUpperCase();
  return (
    rows.find(
      (r) =>
        String(r.codigo || "").toUpperCase() === codigo ||
        String(r.id || "").toUpperCase() === codigo,
    ) ?? null
  );
}

/** Último caso activo (abierto) del teléfono — para consultas de estado. */
export async function getReclamoActivoPorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find(
      (r) => r.telefono === phone && ESTADOS_CASO_ACTIVOS.has(r.estado) && r.codigo,
    ) ?? null
  );
}

export async function listReclamosActivosPorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return [];
  return readAll().filter(
    (r) => r.telefono === phone && ESTADOS_CASO_ACTIVOS.has(r.estado) && r.codigo,
  );
}

export async function crearReclamoDialogo({ telefono, nombre, seed = {} } = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });
  const now = new Date().toISOString();

  const rows = readAll().filter(
    (r) => !(r.telefono === phone && ESTADOS_DIALOG_ABIERTOS.has(r.estado)),
  );

  const row = {
    id: idInterno(),
    codigo: null, // se asigna al abrir el caso (fecha + seq + tipo)
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
  if (patch.codigo !== undefined) row.codigo = patch.codigo;
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

/** Cierra el diálogo: asigna código público y pasa a nuevo/escalado. */
export async function abrirCasoDesdeDialogo(
  id,
  {
    motivo,
    criticidad,
    resumen,
    detalle,
    viaje_ref,
    remito_ref,
    pedido_ref,
    imagen_url,
    escalar = false,
    escalado_a = null,
  } = {},
) {
  const now = new Date().toISOString();
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;

  const motivoNorm = normalizeMotivo(motivo || rows[i].motivo || "otro");
  const codigo =
    rows[i].codigo ||
    buildCodigoReclamo(
      motivoNorm,
      rows.map((r) => ({ codigo: r.codigo || r.id })),
    );

  rows[i] = {
    ...rows[i],
    codigo,
    estado: escalar ? "escalado" : "nuevo",
    motivo: motivoNorm,
    criticidad: normalizeCriticidad(criticidad || rows[i].criticidad || "media"),
    resumen: resumen ?? rows[i].resumen,
    detalle: detalle ?? rows[i].detalle,
    viaje_ref: viaje_ref !== undefined ? viaje_ref : rows[i].viaje_ref,
    remito_ref: remito_ref !== undefined ? remito_ref : rows[i].remito_ref,
    pedido_ref: pedido_ref !== undefined ? pedido_ref : rows[i].pedido_ref,
    imagen_url: imagen_url !== undefined ? imagen_url : rows[i].imagen_url,
    escalado_a: escalar ? escalado_a || "Coordinación operativa" : rows[i].escalado_a,
    historial: [
      ...(rows[i].historial || []),
      `${now} · Caso ${escalar ? "escalado" : "abierto"} · ${codigo}`,
    ],
    updated_at: now,
  };
  writeAll(rows);
  return rows[i];
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
