/**
 * SOL Tracking Express — persistencia JSON.
 * Archivos bajo DATA_DIR/tracking/
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashTrackingToken, verifyTrackingToken, sealTrackingToken } from "../../../lib/tracking/tokens.mjs";
import { LINK_VALIDATION, VIAJE_ESTADOS_FINALES } from "../../../lib/tracking/constants.mjs";
import { trackingLinkTtlHours } from "../../../lib/tracking/flags.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const DIR = path.join(DATA_DIR, "tracking");

const FILES = {
  links: path.join(DIR, "links.json"),
  sessions: path.join(DIR, "sessions.json"),
  positions: path.join(DIR, "positions.json"),
  consents: path.join(DIR, "consents.json"),
  events: path.join(DIR, "events.json"),
  tripState: path.join(DIR, "trip-state.json"),
  notifications: path.join(DIR, "notifications.json"),
};

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readLinks() {
  const raw = readJson(FILES.links, []);
  return Array.isArray(raw) ? raw : [];
}

function writeLinks(rows) {
  writeJson(FILES.links, rows);
}

function readSessions() {
  const raw = readJson(FILES.sessions, []);
  return Array.isArray(raw) ? raw : [];
}

function writeSessions(rows) {
  writeJson(FILES.sessions, rows);
}

function readPositions() {
  const raw = readJson(FILES.positions, []);
  return Array.isArray(raw) ? raw : [];
}

function writePositions(rows) {
  writeJson(FILES.positions, rows);
}

function readConsents() {
  const raw = readJson(FILES.consents, []);
  return Array.isArray(raw) ? raw : [];
}

function writeConsents(rows) {
  writeJson(FILES.consents, rows);
}

function readEvents() {
  const raw = readJson(FILES.events, []);
  return Array.isArray(raw) ? raw : [];
}

function writeEvents(rows) {
  writeJson(FILES.events, rows);
}

function readTripStates() {
  const raw = readJson(FILES.tripState, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function writeTripStates(map) {
  writeJson(FILES.tripState, map);
}

function id(prefix) {
  return `${prefix}-${randomUUID().slice(0, 10).toUpperCase()}`;
}

// ─── Links ───────────────────────────────────────────────────────────────────

export function findLinkByToken(token) {
  const hash = hashTrackingToken(token);
  return readLinks().find((l) => l.token_hash === hash) ?? null;
}

export function getLinkById(linkId) {
  return readLinks().find((l) => l.id === linkId) ?? null;
}

export function listLinksByTrip(tripId) {
  return readLinks().filter((l) => l.trip_id === tripId);
}

/**
 * @param {object} input
 * @param {string} input.tripId
 * @param {string} input.tenantId
 * @param {string} [input.driverId]
 * @param {string} [input.createdBy]
 * @param {string} [input.expiresAt]
 * @param {string} plainToken
 */
export function createLinkRecord(input, plainToken) {
  const now = new Date().toISOString();
  const ttlH = trackingLinkTtlHours();
  const expiresAt =
    input.expiresAt ||
    new Date(Date.now() + ttlH * 3600 * 1000).toISOString();

  const row = {
    id: id("TLK"),
    tenant_id: input.tenantId,
    trip_id: input.tripId,
    driver_id: input.driverId || null,
    token_hash: hashTrackingToken(plainToken),
    token_sealed: sealTrackingToken(plainToken),
    expires_at: expiresAt,
    revoked_at: null,
    used_at: null,
    created_at: now,
    created_by: input.createdBy || null,
    last_wa_at: null,
    last_wa_kind: null,
  };

  const rows = readLinks();
  rows.unshift(row);
  writeLinks(rows);
  return row;
}

export function markLinkUsed(linkId) {
  const rows = readLinks();
  const i = rows.findIndex((l) => l.id === linkId);
  if (i < 0) return null;
  if (!rows[i].used_at) rows[i].used_at = new Date().toISOString();
  writeLinks(rows);
  return rows[i];
}

export function revokeLinkRecord(linkId) {
  const rows = readLinks();
  const i = rows.findIndex((l) => l.id === linkId);
  if (i < 0) return null;
  rows[i].revoked_at = new Date().toISOString();
  writeLinks(rows);
  return rows[i];
}

export function patchLinkRecord(linkId, patch) {
  const rows = readLinks();
  const i = rows.findIndex((l) => l.id === linkId);
  if (i < 0) return null;
  const allowed = ["last_wa_at", "last_wa_kind", "used_at"];
  for (const k of allowed) {
    if (patch[k] !== undefined) rows[i][k] = patch[k];
  }
  writeLinks(rows);
  return rows[i];
}

export function listActiveLinks() {
  const now = Date.now();
  return readLinks().filter(
    (l) => !l.revoked_at && new Date(l.expires_at).getTime() > now,
  );
}

/**
 * @param {string} token
 * @param {{ estado?: string } | null} viaje
 */
export function validateLinkToken(token, viaje = null) {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { status: LINK_VALIDATION.INVALID, link: null };
  }
  const link = findLinkByToken(token);
  if (!link) return { status: LINK_VALIDATION.INVALID, link: null };
  if (link.revoked_at) return { status: LINK_VALIDATION.REVOKED, link };
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return { status: LINK_VALIDATION.EXPIRED, link };
  }
  if (viaje) {
    if (viaje.estado === "cancelado") {
      return { status: LINK_VALIDATION.TRIP_CANCELLED, link };
    }
    if (VIAJE_ESTADOS_FINALES.has(viaje.estado)) {
      return { status: LINK_VALIDATION.TRIP_FINALIZED, link };
    }
  }
  return { status: LINK_VALIDATION.VALID, link };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSession(sessionId) {
  return readSessions().find((s) => s.id === sessionId) ?? null;
}

export function getActiveSessionForLink(linkId) {
  const terminal = new Set(["COMPLETED", "CANCELLED", "STOPPED_BY_DRIVER"]);
  return (
    readSessions().find(
      (s) => s.tracking_link_id === linkId && !terminal.has(s.status),
    ) ?? null
  );
}

export function listSessionsByTrip(tripId) {
  return readSessions().filter((s) => s.trip_id === tripId);
}

export function createSessionRecord({
  tenantId,
  tripId,
  driverId,
  vehicleId,
  trackingLinkId,
  source = "BROWSER_GEOLOCATION",
}) {
  const now = new Date().toISOString();
  const row = {
    id: id("TSN"),
    tenant_id: tenantId,
    trip_id: tripId,
    driver_id: driverId || null,
    vehicle_id: vehicleId || null,
    tracking_link_id: trackingLinkId,
    source,
    status: "NOT_STARTED",
    started_at: null,
    stopped_at: null,
    completed_at: null,
    last_heartbeat_at: null,
    last_position_at: null,
    last_sequence: -1,
    page_hidden: false,
    created_at: now,
    updated_at: now,
  };
  const rows = readSessions();
  rows.unshift(row);
  writeSessions(rows);
  return row;
}

export function patchSession(sessionId, patch) {
  const rows = readSessions();
  const i = rows.findIndex((s) => s.id === sessionId);
  if (i < 0) return null;
  const row = rows[i];
  const allowed = [
    "status",
    "started_at",
    "stopped_at",
    "completed_at",
    "last_heartbeat_at",
    "last_position_at",
    "last_sequence",
    "page_hidden",
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  row.updated_at = new Date().toISOString();
  rows[i] = row;
  writeSessions(rows);
  return row;
}

// ─── Positions ─────────────────────────────────────────────────────────────────

export function findPosition(sessionId, sequence) {
  return (
    readPositions().find(
      (p) => p.session_id === sessionId && p.sequence === sequence,
    ) ?? null
  );
}

export function listPositionsBySession(sessionId, { limit = 5000 } = {}) {
  return readPositions()
    .filter((p) => p.session_id === sessionId)
    .sort((a, b) => a.sequence - b.sequence)
    .slice(-limit);
}

export function listPositionsByTrip(tripId, { limit = 5000 } = {}) {
  return readPositions()
    .filter((p) => p.trip_id === tripId)
    .sort((a, b) => {
      const ta = new Date(a.recorded_at).getTime();
      const tb = new Date(b.recorded_at).getTime();
      return ta - tb || a.sequence - b.sequence;
    })
    .slice(-limit);
}

export function insertPosition({
  tenantId,
  tripId,
  sessionId,
  sequence,
  latitude,
  longitude,
  accuracy,
  altitude,
  speed,
  heading,
  recordedAt,
  source = "BROWSER_GEOLOCATION",
  audit = {},
}) {
  const existing = findPosition(sessionId, sequence);
  if (existing) return { row: existing, duplicate: true };

  const now = new Date().toISOString();
  const row = {
    id: id("TPOS"),
    tenant_id: tenantId,
    trip_id: tripId,
    session_id: sessionId,
    sequence,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    altitude: altitude ?? null,
    speed: speed ?? null,
    heading: heading ?? null,
    recorded_at: recordedAt,
    received_at: now,
    source,
    audit_ip: audit.ip || null,
    audit_user_agent: audit.userAgent || null,
  };
  const rows = readPositions();
  rows.push(row);
  writePositions(rows);
  return { row, duplicate: false };
}

// ─── Consents ──────────────────────────────────────────────────────────────────

export function createConsentRecord({
  tenantId,
  tripId,
  sessionId,
  driverId,
  consentVersion,
  ip,
  userAgent,
}) {
  const now = new Date().toISOString();
  const row = {
    id: id("TCON"),
    tenant_id: tenantId,
    trip_id: tripId,
    session_id: sessionId,
    driver_id: driverId || null,
    consent_version: consentVersion,
    accepted_at: now,
    revoked_at: null,
    ip: ip || null,
    user_agent: userAgent || null,
  };
  const rows = readConsents();
  rows.unshift(row);
  writeConsents(rows);
  return row;
}

export function getLatestConsentForSession(sessionId) {
  return (
    readConsents()
      .filter((c) => c.session_id === sessionId && !c.revoked_at)
      .sort((a, b) => new Date(b.accepted_at) - new Date(a.accepted_at))[0] ?? null
  );
}

// ─── Events ────────────────────────────────────────────────────────────────────

export function appendEventRecord({
  tenantId,
  tripId,
  sessionId,
  type,
  payload = {},
}) {
  const now = new Date().toISOString();
  const row = {
    id: id("TEVT"),
    tenant_id: tenantId,
    trip_id: tripId,
    session_id: sessionId || null,
    type,
    payload,
    occurred_at: now,
    created_at: now,
  };
  const rows = readEvents();
  rows.push(row);
  if (rows.length > 50_000) rows.splice(0, rows.length - 50_000);
  writeEvents(rows);
  return row;
}

export function listEventsByTrip(tripId, { limit = 500 } = {}) {
  return readEvents()
    .filter((e) => e.trip_id === tripId)
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
    .slice(-limit);
}

// ─── Trip tracking state (proyección) ─────────────────────────────────────────

export function getTripTrackingState(tripId) {
  const map = readTripStates();
  const st = map[tripId] ?? null;
  if (!st) return null;
  // Hidratar last_position desde el log si la proyección quedó vacía (p.ej. heartbeat previo).
  if (!st.last_position) {
    const last = listPositionsByTrip(tripId).at(-1);
    if (last) {
      return {
        ...st,
        last_position: {
          latitude: last.latitude,
          longitude: last.longitude,
          accuracy: last.accuracy,
          recordedAt: last.recorded_at,
        },
        accuracy: st.accuracy ?? last.accuracy ?? null,
        last_position_at: st.last_position_at || last.recorded_at,
      };
    }
  }
  return st;
}

export function upsertTripTrackingState(tripId, patch) {
  const map = readTripStates();
  const prev = map[tripId] ?? { trip_id: tripId };
  const next = {
    ...prev,
    ...patch,
    trip_id: tripId,
    updated_at: new Date().toISOString(),
  };
  map[tripId] = next;
  writeTripStates(map);
  return next;
}

export function listActiveTripStates({ tenantId } = {}) {
  const terminal = new Set(["COMPLETED", "CANCELLED", "NOT_STARTED"]);
  return Object.values(readTripStates())
    .filter((s) => {
      if (tenantId && s.tenant_id !== tenantId) return false;
      return s.status && !terminal.has(s.status);
    })
    .map((s) => getTripTrackingState(s.trip_id) || s);
}

function readNotifications() {
  const raw = readJson(FILES.notifications, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function writeNotifications(map) {
  writeJson(FILES.notifications, map);
}

/**
 * Cooldown por viaje+kind. Devuelve true si se puede enviar (y registra el envío).
 */
export function claimNotificationSlot(tripId, kind, cooldownMs) {
  const key = `${tripId}::${kind}`;
  const map = readNotifications();
  const prev = map[key];
  const now = Date.now();
  if (prev?.at && now - new Date(prev.at).getTime() < cooldownMs) {
    return false;
  }
  map[key] = { at: new Date().toISOString(), kind, trip_id: tripId };
  writeNotifications(map);
  return true;
}

export function getNotificationSlot(tripId, kind) {
  const map = readNotifications();
  return map[`${tripId}::${kind}`] ?? null;
}

/** Solo tests — resetea stores en DATA_DIR temporal. */
export function __dangerousResetAllForTests() {
  ensureDir();
  for (const f of Object.values(FILES)) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

export { verifyTrackingToken };
