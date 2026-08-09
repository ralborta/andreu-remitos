/**
 * Store de incidencias en ruta.
 * Archivo: DATA_DIR/incidencias.json
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  INCIDENCIA_ESTADOS,
  INCIDENCIA_ORIGENES,
  buildCodigoIncidencia,
  extractCodigoIncidencia,
  normalizeTipo,
  normalizeCriticidad,
} from "../../../lib/incidencias.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "incidencias.json");

const ESTADOS_DIALOG = new Set(["esperando_causa"]);
const ESTADOS_ABIERTOS = new Set(["nueva", "en_gestion", "esperando_causa"]);

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
  return `IID-${randomUUID().slice(0, 10).toUpperCase()}`;
}

export async function listIncidencias({ limit = 100, estado, telefono } = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  return rows.slice(0, limit);
}

export async function getIncidencia(idOrCodigo) {
  const key = String(idOrCodigo || "").trim();
  if (!key) return null;
  const rows = readAll();
  const byId = rows.find((r) => r.id === key);
  if (byId) return byId;
  const codigo = extractCodigoIncidencia(key) || key.toUpperCase();
  return (
    rows.find(
      (r) =>
        String(r.codigo || "").toUpperCase() === codigo ||
        String(r.id || "").toUpperCase() === codigo,
    ) ?? null
  );
}

export async function getIncidenciaPendientePorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find((r) => r.telefono === phone && ESTADOS_DIALOG.has(r.estado)) ?? null
  );
}

export async function getIncidenciaActivaPorTelefono(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find(
      (r) => r.telefono === phone && ESTADOS_ABIERTOS.has(r.estado) && r.codigo,
    ) ?? null
  );
}

/**
 * Crea diálogo (agente preguntó) o caso abierto (chofer ya explicó).
 */
export async function crearIncidencia(body = {}) {
  const phone = sanitizePhone(body.telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });

  const now = new Date().toISOString();
  const rows = readAll().filter(
    (r) => !(r.telefono === phone && ESTADOS_DIALOG.has(r.estado)),
  );

  const tipo = body.tipo ? normalizeTipo(body.tipo) : null;
  const criticidad = body.criticidad
    ? normalizeCriticidad(body.criticidad, tipo)
    : tipo
      ? normalizeCriticidad(null, tipo)
      : null;

  let estado = String(body.estado || "nueva");
  if (!INCIDENCIA_ESTADOS.includes(estado)) estado = "nueva";

  let origen = String(body.origen || "chofer");
  if (!INCIDENCIA_ORIGENES.includes(origen)) origen = "chofer";

  let codigo = null;
  if (estado !== "esperando_causa" && tipo) {
    codigo = buildCodigoIncidencia(tipo, rows);
  }

  const row = {
    id: idInterno(),
    codigo,
    telefono: phone,
    chofer_nombre: body.chofer_nombre || body.nombre || null,
    canal: "whatsapp",
    origen,
    estado,
    tipo,
    criticidad,
    causa: body.causa ? String(body.causa).trim() : null,
    resumen: body.resumen ? String(body.resumen).trim() : null,
    viaje_ref: body.viaje_ref || null,
    destino_id: body.destino_id || null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    imagen_url: body.imagen_url || null,
    mensajes: Array.isArray(body.mensajes) ? body.mensajes : [],
    historial: [
      `${now} · Creada (${estado}${origen ? ` · ${origen}` : ""})`,
      ...(Array.isArray(body.historial) ? body.historial : []),
    ],
    nota_interna: null,
    /** Cuándo se hizo la 1ª pregunta al chofer (seguimiento auto). */
    consulta_at: estado === "esperando_causa" ? now : null,
    recordatorio_enviado_at: null,
    cerrado_sin_respuesta: false,
    created_at: now,
    updated_at: now,
  };

  rows.unshift(row);
  writeAll(rows.slice(0, 800));
  return row;
}

export async function actualizarIncidencia(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();

  if (patch.chofer_nombre !== undefined) row.chofer_nombre = patch.chofer_nombre;
  if (patch.estado && INCIDENCIA_ESTADOS.includes(patch.estado)) row.estado = patch.estado;
  if (patch.tipo !== undefined) {
    row.tipo = patch.tipo ? normalizeTipo(patch.tipo) : null;
  }
  if (patch.criticidad !== undefined) {
    row.criticidad = patch.criticidad
      ? normalizeCriticidad(patch.criticidad, row.tipo)
      : null;
  }
  for (const k of [
    "causa",
    "resumen",
    "viaje_ref",
    "destino_id",
    "lat",
    "lng",
    "imagen_url",
    "nota_interna",
    "origen",
    "consulta_at",
    "recordatorio_enviado_at",
    "cerrado_sin_respuesta",
  ]) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  if (patch.codigo !== undefined) row.codigo = patch.codigo;

  // Al abrir el caso, asignar código si falta
  if (
    (patch.estado === "nueva" || patch.asignar_codigo) &&
    !row.codigo &&
    row.tipo
  ) {
    row.codigo = buildCodigoIncidencia(row.tipo, rows.filter((_, idx) => idx !== i));
  }

  if (patch.mensaje_push) {
    row.mensajes = [...(row.mensajes ?? []), patch.mensaje_push];
  }
  if (patch.historial_push) {
    row.historial = [...(row.historial ?? []), patch.historial_push];
  }

  row.updated_at = now;
  writeAll(rows);
  return row;
}

export async function abrirCasoDesdeDialogo(id, { tipo, criticidad, causa, resumen, viaje_ref } = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();
  const t = normalizeTipo(tipo || row.tipo || "otro");
  const c = normalizeCriticidad(criticidad, t);
  row.tipo = t;
  row.criticidad = c;
  row.causa = causa || row.causa;
  row.resumen = resumen || row.resumen;
  if (viaje_ref) row.viaje_ref = viaje_ref;
  row.estado = "nueva";
  if (!row.codigo) {
    row.codigo = buildCodigoIncidencia(t, rows.filter((_, idx) => idx !== i));
  }
  row.historial = [
    ...(row.historial ?? []),
    `${now} · Caso abierto · ${row.codigo}`,
  ];
  row.updated_at = now;
  writeAll(rows);
  return row;
}

export async function decidirIncidencia(id, { estado, nota } = {}) {
  if (!["en_gestion", "resuelta", "nueva"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido (nueva|en_gestion|resuelta)"), {
      statusCode: 400,
    });
  }
  return actualizarIncidencia(id, {
    estado,
    nota_interna: nota ?? undefined,
    historial_push: `${new Date().toISOString()} · ${estado}${nota ? `: ${nota}` : ""}`,
  });
}

export async function listIncidenciasEsperandoCausa() {
  return readAll().filter((r) => r.estado === "esperando_causa");
}

export async function resumenIncidencias() {
  const rows = readAll();
  const abiertas = rows.filter((r) => ["nueva", "en_gestion", "esperando_causa"].includes(r.estado));
  return {
    total: rows.length,
    abiertas: abiertas.length,
    nueva: rows.filter((r) => r.estado === "nueva").length,
    en_gestion: rows.filter((r) => r.estado === "en_gestion").length,
    esperando_causa: rows.filter((r) => r.estado === "esperando_causa").length,
    resuelta: rows.filter((r) => r.estado === "resuelta").length,
    alta: abiertas.filter((r) => r.criticidad === "alta").length,
  };
}
