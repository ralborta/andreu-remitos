/**
 * Store unificado Evidencias de Transporte (POP/POD).
 * Archivo: DATA_DIR/transport-evidence.json
 * Migra automáticamente desde pod-casos.json (backward-compatible).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  EVIDENCE_ESTADOS,
  EVIDENCE_ESTADOS_DIALOG,
  EVIDENCE_TYPES,
  buildCodigoEvidence,
  normalizeQuantities,
} from "../../../lib/transport-evidence.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "transport-evidence.json");
const LEGACY_FILE = path.join(DATA_DIR, "pod-casos.json");
const MILESTONES_FILE = path.join(DATA_DIR, "trip-evidence-milestones.json");

function readJson(file, fallback) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizeLegacyPod(row) {
  const attachments = [];
  if (row.imagen_url) {
    attachments.push({
      id: `ATT-${randomUUID().slice(0, 8).toUpperCase()}`,
      url: row.imagen_url,
      mime_type: "image/jpeg",
      kind: "photo",
      created_at: row.created_at || new Date().toISOString(),
    });
  }
  return {
    ...row,
    type: row.type || "POD",
    tenant_id: row.tenant_id || null,
    trip_id: row.trip_id || null,
    attachments,
    reported_quantities: row.reported_quantities || null,
    expected_quantities: row.expected_quantities || null,
    condition: row.condition || null,
    observed: Boolean(row.observed),
    difference_notes: row.difference_notes || null,
    location: row.location || null,
    source: row.source || "whatsapp",
    responsable_nombre: row.responsable_nombre || row.receptor_nombre || null,
    approved_at: row.estado === "ok" ? row.updated_at : null,
    received_at: row.estado === "pendiente" ? row.updated_at : row.received_at || null,
  };
}

function ensureMigrated() {
  if (fs.existsSync(FILE)) return;
  const legacy = readJson(LEGACY_FILE, []);
  if (!Array.isArray(legacy) || !legacy.length) {
    writeJson(FILE, []);
    return;
  }
  const migrated = legacy.map(normalizeLegacyPod);
  writeJson(FILE, migrated);
  const backup = `${LEGACY_FILE}.migrated-${Date.now()}.bak`;
  try {
    fs.copyFileSync(LEGACY_FILE, backup);
  } catch {
    /* no bloquear */
  }
}

function readAll() {
  ensureMigrated();
  const raw = readJson(FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function writeAll(rows) {
  writeJson(FILE, rows);
}

function syncLegacyPodFile(rows) {
  const pods = rows.filter((r) => (r.type || "POD") === "POD");
  try {
    writeJson(LEGACY_FILE, pods);
  } catch {
    /* mirror opcional */
  }
}

function primaryImage(row) {
  if (row.imagen_url) return row.imagen_url;
  const att = (row.attachments || []).find((a) => a.url);
  return att?.url || null;
}

function appendAttachment(row, { url, mimeType = "image/jpeg", kind = "photo" } = {}) {
  if (!url) return row;
  row.attachments = row.attachments || [];
  const exists = row.attachments.some((a) => a.url === url);
  if (!exists) {
    row.attachments.push({
      id: `ATT-${randomUUID().slice(0, 8).toUpperCase()}`,
      url,
      mime_type: mimeType,
      kind,
      created_at: new Date().toISOString(),
    });
  }
  if (!row.imagen_url) row.imagen_url = url;
  return row;
}

export function listEvidence({
  limit = 100,
  estado,
  telefono,
  type,
  tripId,
  tenantId,
} = {}) {
  let rows = readAll();
  if (type) rows = rows.filter((r) => (r.type || "POD") === type);
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (tripId) {
    rows = rows.filter(
      (r) => r.trip_id === tripId || r.viaje_ref === tripId,
    );
  }
  if (tenantId) rows = rows.filter((r) => !r.tenant_id || r.tenant_id === tenantId);
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  return rows.slice(0, Math.min(Number(limit) || 100, 500));
}

export function getEvidence(idOrCodigo) {
  const key = String(idOrCodigo || "");
  return (
    readAll().find(
      (r) =>
        r.id === key ||
        r.codigo === key ||
        (key.startsWith("POD-") && r.id === key),
    ) ?? null
  );
}

export function getEvidenceDialogByTelefono(telefono, { type } = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return (
    readAll().find((r) => {
      if (r.telefono !== phone || !EVIDENCE_ESTADOS_DIALOG.has(r.estado)) return false;
      if (type && (r.type || "POD") !== type) return false;
      return true;
    }) ?? null
  );
}

/** Compat POD. */
export async function getPodPendientePorTelefono(telefono) {
  return getEvidenceDialogByTelefono(telefono, { type: "POD" });
}

export function getEvidenceByTrip(tripId, type) {
  const rows = listEvidence({ tripId, type, limit: 50 });
  return rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || null;
}

export function createEvidence(body = {}) {
  const phone = sanitizePhone(body.telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });

  const evidenceType = EVIDENCE_TYPES.includes(body.type) ? body.type : "POD";
  const now = new Date().toISOString();
  let rows = readAll().filter(
    (r) =>
      !(
        r.telefono === phone &&
        EVIDENCE_ESTADOS_DIALOG.has(r.estado) &&
        (r.type || "POD") === evidenceType
      ),
  );

  let estado = String(body.estado || (evidenceType === "POP" ? "esperando_foto" : "esperando_receptor"));
  if (!EVIDENCE_ESTADOS.includes(estado)) {
    estado = evidenceType === "POP" ? "esperando_foto" : "esperando_receptor";
  }

  const row = {
    id: body.id || `${evidenceType === "POP" ? "POP" : "POD"}-${randomUUID().slice(0, 8).toUpperCase()}`,
    type: evidenceType,
    codigo: null,
    estado,
    tenant_id: body.tenant_id || body.tenantId || null,
    trip_id: body.trip_id || body.tripId || null,
    telefono: phone,
    chofer_nombre: body.chofer_nombre || body.nombre || null,
    receptor_nombre: body.receptor_nombre ? String(body.receptor_nombre).trim() : null,
    responsable_nombre: body.responsable_nombre
      ? String(body.responsable_nombre).trim()
      : body.receptor_nombre
        ? String(body.receptor_nombre).trim()
        : null,
    imagen_url: body.imagen_url || null,
    attachments: [],
    viaje_ref: body.viaje_ref || null,
    origen: body.origen || null,
    destino: body.destino || null,
    destino_id: body.destino_id || null,
    nota_chofer: body.nota_chofer || null,
    texto_ocr: body.texto_ocr ? String(body.texto_ocr).slice(0, 12000) : null,
    reported_quantities: normalizeQuantities(body.reported_quantities || body.quantities),
    expected_quantities: normalizeQuantities(body.expected_quantities),
    condition: body.condition || null,
    observed: Boolean(body.observed),
    difference_notes: body.difference_notes || null,
    location: body.location || null,
    source: body.source || "whatsapp",
    nota_backoffice: null,
    aprobado_por: null,
    historial: [`${now} · Creado ${evidenceType} (${estado})`],
    received_at: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
  };

  if (body.imagen_url) appendAttachment(row, { url: body.imagen_url });
  if (Array.isArray(body.attachments)) {
    for (const a of body.attachments) appendAttachment(row, a);
  }

  if (["pendiente", "ok", "observado"].includes(estado)) {
    row.codigo = buildCodigoEvidence(evidenceType, rows);
    if (estado === "pendiente") row.received_at = now;
    if (estado === "ok") row.approved_at = now;
  }

  rows.unshift(row);
  writeAll(rows);
  syncLegacyPodFile(rows);
  return row;
}

export function updateEvidence(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();
  const evidenceType = row.type || "POD";

  for (const k of [
    "receptor_nombre",
    "responsable_nombre",
    "imagen_url",
    "viaje_ref",
    "trip_id",
    "tenant_id",
    "origen",
    "destino",
    "destino_id",
    "nota_chofer",
    "texto_ocr",
    "nota_backoffice",
    "aprobado_por",
    "chofer_nombre",
    "condition",
    "observed",
    "difference_notes",
    "location",
    "source",
  ]) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }

  if (patch.reported_quantities !== undefined) {
    row.reported_quantities = normalizeQuantities(patch.reported_quantities);
  }
  if (patch.expected_quantities !== undefined) {
    row.expected_quantities = normalizeQuantities(patch.expected_quantities);
  }
  if (patch.texto_ocr !== undefined && patch.texto_ocr != null) {
    row.texto_ocr = String(patch.texto_ocr).slice(0, 12000);
  }
  if (patch.imagen_url) appendAttachment(row, { url: patch.imagen_url });
  if (patch.attachment) appendAttachment(row, patch.attachment);

  if (patch.estado && EVIDENCE_ESTADOS.includes(patch.estado)) {
    row.estado = patch.estado;
    if (patch.estado === "pendiente" && !row.received_at) row.received_at = now;
    if (patch.estado === "ok" && !row.approved_at) row.approved_at = now;
    if (patch.estado === "observado") row.observed = true;
  }

  if (
    ["pendiente", "ok", "observado"].includes(row.estado) &&
    !row.codigo
  ) {
    row.codigo = buildCodigoEvidence(evidenceType, rows);
  }

  if (Array.isArray(patch.historial)) {
    row.historial = patch.historial;
  } else if (patch.historial_push) {
    row.historial = [...(row.historial || []), `${now} · ${patch.historial_push}`];
  }

  row.updated_at = now;
  rows[i] = row;
  writeAll(rows);
  syncLegacyPodFile(rows);
  return row;
}

export function decideEvidence(id, { estado, nota, aprobado_por, observed } = {}) {
  if (!["ok", "rechazado", "observado"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido"), { statusCode: 400 });
  }
  const now = new Date().toISOString();
  return updateEvidence(id, {
    estado: estado === "observado" ? "observado" : estado,
    observed: observed ?? estado === "observado",
    nota_backoffice: nota ? String(nota).trim() : null,
    aprobado_por: aprobado_por || null,
    approved_at: estado === "ok" ? now : undefined,
    historial_push: `Decisión: ${estado}${nota ? ` — ${nota}` : ""}`,
  });
}

export function resumenEvidence({ type } = {}) {
  let rows = readAll().filter((r) => !EVIDENCE_ESTADOS_DIALOG.has(r.estado));
  if (type) rows = rows.filter((r) => (r.type || "POD") === type);
  const pendientes = rows.filter((r) => r.estado === "pendiente").length;
  const observados = rows.filter((r) => r.estado === "observado" || r.observed).length;
  const ok = rows.filter((r) => r.estado === "ok").length;
  const rechazados = rows.filter((r) => r.estado === "rechazado").length;
  const dialog = readAll().filter((r) => {
    if (type && (r.type || "POD") !== type) return false;
    return EVIDENCE_ESTADOS_DIALOG.has(r.estado);
  }).length;
  return {
    total: rows.length,
    pendientes,
    observados,
    ok,
    rechazados,
    en_dialogo: dialog,
  };
}

// ─── Milestones por viaje ───────────────────────────────────────────────────

function readMilestones() {
  const raw = readJson(MILESTONES_FILE, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function writeMilestones(map) {
  writeJson(MILESTONES_FILE, map);
}

export function getTripMilestones(tripId) {
  const map = readMilestones();
  return map[tripId] || { pop: { status: "not_required" }, pod: { status: "not_required" } };
}

export function setTripMilestone(tripId, kind, patch) {
  const map = readMilestones();
  const prev = map[tripId] || {};
  map[tripId] = {
    ...prev,
    [kind]: { ...(prev[kind] || {}), ...patch, updated_at: new Date().toISOString() },
  };
  writeMilestones(map);
  return map[tripId];
}

export { primaryImage, appendAttachment, normalizeLegacyPod, FILE, LEGACY_FILE };

/** Solo tests. */
export function __dangerousResetEvidenceForTests() {
  for (const f of [FILE, MILESTONES_FILE]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
