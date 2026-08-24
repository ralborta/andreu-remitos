/**
 * SOL Tracking Express — lógica de dominio y orquestación.
 */
import * as trackingStore from "../db/tracking-store.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import { generateTrackingToken, buildTrackingPublicUrl } from "../../../lib/tracking/tokens.mjs";
import {
  isTrackingExpressEnabled,
  trackingConsentVersion,
  trackingGeofenceRadiusMeters,
  isTrackingWhatsAppEnabled,
  isTrackingAllowedForTrip,
  getTrackingPilotGateSnapshot,
} from "../../../lib/tracking/flags.mjs";
import { LINK_VALIDATION, VIAJE_ESTADOS_FINALES } from "../../../lib/tracking/constants.mjs";
import { computeTrackingStatus, positionAgeSeconds } from "../../../lib/tracking/status.mjs";
import { isInsideGeofence } from "../../../lib/tracking/geofence.mjs";
import { validatePositionsBatch } from "../../../lib/tracking/validation.mjs";
import { cambiarEstadoViaje } from "../db/viajes-store.mjs";
import * as podStore from "../db/pod-store.mjs";
import * as incidenciasStore from "../db/incidencias-store.mjs";
import { mapTrackingIncidentType } from "../../../lib/tracking/incidents.mjs";
import { persistTrackingMedia } from "./tracking-media.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

const rateBuckets = new Map();

function assertEnabled() {
  if (!isTrackingExpressEnabled()) {
    throw Object.assign(new Error("SOL Tracking Express no está habilitado"), {
      statusCode: 404,
      code: "feature_disabled",
    });
  }
}

function clientIp(request) {
  const xf = request.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return request.ip || null;
}

function clientUserAgent(request) {
  const ua = request.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 512) : null;
}

/** Rate limit simple en memoria por IP + acción. */
export function checkRateLimit(key, { max = 120, windowMs = 60_000 } = {}) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    throw Object.assign(new Error("Demasiadas solicitudes"), {
      statusCode: 429,
      code: "rate_limited",
    });
  }
}

async function loadViajeForLink(link) {
  return viajesStore.getViaje(link.trip_id);
}

function mapPublicTrip(viaje, link, session, state) {
  if (!viaje) return null;
  const status = state?.status || session?.status || "NOT_STARTED";
  const lastAt = state?.last_position_at || session?.last_position_at;
  return {
    empresa: viaje.tenant || null,
    viaje: {
      id: viaje.id,
      codigo: viaje.codigo,
      estado: viaje.estado,
      cliente: viaje.cliente,
      origen: viaje.origen,
      destino: viaje.destino,
      fecha: viaje.fecha,
      hora: viaje.hora,
      carga: viaje.carga,
      notas: viaje.notas,
    },
    chofer: viaje.chofer || null,
    vehiculo: {
      tractor: viaje.tractor || null,
      semi: viaje.semi || null,
    },
    link: {
      id: link.id,
      expiresAt: link.expires_at,
      usedAt: link.used_at,
    },
    session: session
      ? {
          id: session.id,
          status,
          startedAt: session.started_at,
          source: session.source,
        }
      : null,
    tracking: state
      ? {
          status,
          lastPosition: state.last_position || null,
          lastPositionAt: lastAt,
          positionAgeSeconds: positionAgeSeconds(lastAt),
          accuracy: state.accuracy ?? null,
          source: state.source || "BROWSER_GEOLOCATION",
          currentEta: state.current_eta ?? null,
          distanceRemaining: state.distance_remaining ?? null,
        }
      : null,
    consentVersion: trackingConsentVersion(),
    disclaimer:
      "El seguimiento funciona mientras esta pantalla permanece activa. No cierres el navegador durante el viaje.",
  };
}

function refreshTripState({ tripId, tenantId, session, lastPosition }) {
  const lastAt = lastPosition?.recorded_at || session?.last_position_at;
  const accuracy = lastPosition?.accuracy ?? null;
  const status = computeTrackingStatus({
    sessionStatus: session?.status,
    lastPositionAt: lastAt,
    lastHeartbeatAt: session?.last_heartbeat_at,
    pageHidden: session?.page_hidden,
    accuracyMeters: accuracy,
  });

  return trackingStore.upsertTripTrackingState(tripId, {
    tenant_id: tenantId,
    session_id: session?.id || null,
    status,
    last_position: lastPosition
      ? {
          latitude: lastPosition.latitude,
          longitude: lastPosition.longitude,
          accuracy: lastPosition.accuracy,
          recordedAt: lastPosition.recorded_at,
        }
      : null,
    last_position_at: lastAt || null,
    position_age_seconds: positionAgeSeconds(lastAt),
    accuracy,
    source: session?.source || "BROWSER_GEOLOCATION",
    current_eta: null,
    distance_remaining: null,
  });
}

async function resolveContext(token, request) {
  assertEnabled();
  const link = trackingStore.findLinkByToken(token);
  if (!link) {
    throw Object.assign(new Error("Enlace inválido"), { statusCode: 404, code: "invalid" });
  }
  const viaje = await loadViajeForLink(link);
  const validation = trackingStore.validateLinkToken(token, viaje);
  if (validation.status !== LINK_VALIDATION.VALID) {
    const codes = {
      [LINK_VALIDATION.EXPIRED]: "expired",
      [LINK_VALIDATION.REVOKED]: "revoked",
      [LINK_VALIDATION.TRIP_FINALIZED]: "trip_finalized",
      [LINK_VALIDATION.TRIP_CANCELLED]: "trip_cancelled",
      [LINK_VALIDATION.INVALID]: "invalid",
    };
    throw Object.assign(new Error(`Enlace ${validation.status}`), {
      statusCode: 410,
      code: codes[validation.status] || "invalid",
      linkStatus: validation.status,
    });
  }
  trackingStore.markLinkUsed(link.id);
  let session = trackingStore.getActiveSessionForLink(link.id);
  return { link, viaje, session, requestMeta: { ip: clientIp(request), userAgent: clientUserAgent(request) } };
}

// ─── API autenticada ───────────────────────────────────────────────────────────

export async function createTrackingLink({ tripId, createdBy, expiresAt, sendWhatsApp = false }) {
  assertEnabled();
  const viaje = await viajesStore.getViaje(tripId);
  if (!viaje) {
    throw Object.assign(new Error("Viaje no encontrado"), { statusCode: 404 });
  }
  if (VIAJE_ESTADOS_FINALES.has(viaje.estado) || viaje.estado === "cancelado") {
    throw Object.assign(new Error("Viaje no admite tracking"), { statusCode: 400 });
  }

  const gate = isTrackingAllowedForTrip(viaje);
  if (!gate.ok) {
    const messages = {
      feature_disabled: "SOL Tracking Express no está habilitado",
      tenant_not_allowlisted: "Tenant fuera del piloto (allowlist)",
      phone_missing: "El viaje necesita teléfono de chofer para el piloto",
      phone_not_allowlisted: "Chofer fuera del piloto (allowlist de teléfonos)",
    };
    throw Object.assign(new Error(messages[gate.reason] || "No autorizado para tracking"), {
      statusCode: gate.reason === "feature_disabled" ? 404 : 403,
      code: gate.reason,
    });
  }

  const existing = trackingStore.listLinksByTrip(viaje.id).find((l) => !l.revoked_at);
  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    throw Object.assign(
      new Error("Ya existe un enlace activo para este viaje. Revocalo antes de crear otro."),
      { statusCode: 409, existingLinkId: existing.id },
    );
  }

  const plainToken = generateTrackingToken();
  const link = trackingStore.createLinkRecord(
    {
      tripId: viaje.id,
      tenantId: viaje.tenant || "tsb",
      driverId: viaje.chofer || viaje.telefono_chofer || null,
      createdBy,
      expiresAt,
    },
    plainToken,
  );

  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: null,
    type: "TRACKING_LINK_CREATED",
    payload: { linkId: link.id },
  });

  const trackingUrl = buildTrackingPublicUrl(plainToken);
  const result = {
    link: {
      id: link.id,
      tripId: link.trip_id,
      tenantId: link.tenant_id,
      expiresAt: link.expires_at,
      createdAt: link.created_at,
    },
    token: plainToken,
    trackingUrl,
    whatsapp: null,
  };

  if (sendWhatsApp && isTrackingWhatsAppEnabled()) {
    try {
      const { sendTrackingWhatsApp } = await import("./tracking-wa.mjs");
      result.whatsapp = await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "assigned",
        force: true,
      });
    } catch (err) {
      result.whatsapp = { ok: false, error: err.message };
    }
  }

  return result;
}

export async function sendLinkWhatsApp(linkId, { kind = "assigned", force = false } = {}) {
  assertEnabled();
  const { sendTrackingWhatsApp } = await import("./tracking-wa.mjs");
  return sendTrackingWhatsApp({ linkId, kind, force });
}

export async function revokeTrackingLink(linkId, { tenantId } = {}) {
  assertEnabled();
  const link = trackingStore.getLinkById(linkId);
  if (!link) {
    throw Object.assign(new Error("Enlace no encontrado"), { statusCode: 404 });
  }
  if (tenantId && link.tenant_id !== tenantId) {
    throw Object.assign(new Error("No autorizado"), { statusCode: 403 });
  }
  const revoked = trackingStore.revokeLinkRecord(linkId);
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: null,
    type: "TRACKING_STOPPED",
    payload: { linkId, reason: "revoked" },
  });
  return revoked;
}

export async function getTripLive(tripId, { tenantId } = {}) {
  assertEnabled();
  const viaje = await viajesStore.getViaje(tripId);
  if (!viaje) {
    throw Object.assign(new Error("Viaje no encontrado"), { statusCode: 404 });
  }
  if (tenantId && viaje.tenant !== tenantId) {
    throw Object.assign(new Error("No autorizado"), { statusCode: 403 });
  }
  const state = trackingStore.getTripTrackingState(tripId);
  const sessions = trackingStore.listSessionsByTrip(tripId);
  const active = sessions.find((s) => !["COMPLETED", "CANCELLED", "STOPPED_BY_DRIVER"].includes(s.status));
  return {
    tripId,
    viaje: { codigo: viaje.codigo, estado: viaje.estado, origen: viaje.origen, destino: viaje.destino },
    tracking: state,
    session: active || null,
  };
}

export async function getTripHistory(tripId, { tenantId } = {}) {
  assertEnabled();
  const viaje = await viajesStore.getViaje(tripId);
  if (!viaje) {
    throw Object.assign(new Error("Viaje no encontrado"), { statusCode: 404 });
  }
  if (tenantId && viaje.tenant !== tenantId) {
    throw Object.assign(new Error("No autorizado"), { statusCode: 403 });
  }
  return {
    tripId,
    positions: trackingStore.listPositionsByTrip(tripId),
    events: trackingStore.listEventsByTrip(tripId),
  };
}

export async function listActiveTrackingTrips({ tenantId } = {}) {
  assertEnabled();
  return trackingStore.listActiveTripStates({ tenantId });
}

// ─── API pública (token) ───────────────────────────────────────────────────────

export async function getPublicTracking(token, request) {
  checkRateLimit(`public:get:${clientIp(request)}`, { max: 60 });
  const link = trackingStore.findLinkByToken(token);
  if (!link) {
    return { linkStatus: LINK_VALIDATION.INVALID, trip: null };
  }
  const viaje = await loadViajeForLink(link);
  const validation = trackingStore.validateLinkToken(token, viaje);
  if (validation.status !== LINK_VALIDATION.VALID) {
    return { linkStatus: validation.status, trip: null };
  }
  assertEnabled();
  trackingStore.markLinkUsed(link.id);
  let session = trackingStore.getActiveSessionForLink(link.id);
  if (!session) {
    session = trackingStore.createSessionRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      driverId: link.driver_id,
      vehicleId: viaje?.tractor || null,
      trackingLinkId: link.id,
    });
  }
  const state = trackingStore.getTripTrackingState(link.trip_id);
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "TRACKING_LINK_OPENED",
    payload: {},
  });
  return {
    linkStatus: LINK_VALIDATION.VALID,
    trip: mapPublicTrip(viaje, link, session, state),
  };
}

export async function acceptConsent(token, request, body = {}) {
  const { link, viaje, session, requestMeta } = await resolveContext(token, request);
  checkRateLimit(`public:consent:${clientIp(request)}`, { max: 30 });

  let activeSession = session;
  if (!activeSession) {
    activeSession = trackingStore.createSessionRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      driverId: link.driver_id,
      vehicleId: viaje?.tractor || null,
      trackingLinkId: link.id,
    });
  }

  const version = String(body.consentVersion || trackingConsentVersion());
  const consent = trackingStore.createConsentRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: activeSession.id,
    driverId: link.driver_id,
    consentVersion: version,
    ip: requestMeta.ip,
    userAgent: requestMeta.userAgent,
  });

  trackingStore.patchSession(activeSession.id, { status: "AWAITING_PERMISSION" });
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: activeSession.id,
    type: "CONSENT_ACCEPTED",
    payload: { consentId: consent.id, version },
  });

  return { ok: true, sessionId: activeSession.id, consentVersion: version };
}

export async function startTracking(token, request, body = {}) {
  const { link, viaje, session, requestMeta } = await resolveContext(token, request);
  checkRateLimit(`public:start:${clientIp(request)}`, { max: 20 });

  let activeSession = session;
  if (!activeSession) {
    activeSession = trackingStore.createSessionRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      driverId: link.driver_id,
      vehicleId: viaje?.tractor || null,
      trackingLinkId: link.id,
    });
  }

  const consent = trackingStore.getLatestConsentForSession(activeSession.id);
  if (!consent) {
    throw Object.assign(new Error("Consentimiento requerido"), { statusCode: 400, code: "consent_required" });
  }

  if (body.confirmDriver === false || body.confirmVehicle === false) {
    trackingStore.appendEventRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      sessionId: activeSession.id,
      type: "INCIDENT_REPORTED",
      payload: { kind: "confirmation_mismatch", body },
    });
    throw Object.assign(new Error("Confirmación de chofer/unidad requerida"), {
      statusCode: 400,
      code: "confirmation_required",
    });
  }

  const now = new Date().toISOString();
  if (activeSession.status === "ACTIVE" && activeSession.started_at) {
    return { ok: true, sessionId: activeSession.id, status: "ACTIVE", duplicate: true };
  }

  activeSession = trackingStore.patchSession(activeSession.id, {
    status: "ACTIVE",
    started_at: now,
    last_heartbeat_at: now,
  });

  if (viaje.estado === "asignado") {
    try {
      await cambiarEstadoViaje(viaje.id, "en_curso");
    } catch {
      /* no bloquear tracking si transición no aplica */
    }
  }

  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: activeSession.id,
    type: "TRACKING_STARTED",
    payload: { ip: requestMeta.ip },
  });

  refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: activeSession,
    lastPosition: null,
  });

  return { ok: true, sessionId: activeSession.id, status: "ACTIVE" };
}

export async function recordHeartbeat(token, request, body = {}) {
  const { link, session, requestMeta } = await resolveContext(token, request);
  checkRateLimit(`public:hb:${clientIp(request)}`, { max: 180 });

  if (!session) {
    throw Object.assign(new Error("Sesión no iniciada"), { statusCode: 400, code: "no_session" });
  }

  const now = new Date().toISOString();
  const pageHidden = body.pageVisibility === "hidden";
  const prevHidden = session.page_hidden;
  const updated = trackingStore.patchSession(session.id, {
    last_heartbeat_at: now,
    page_hidden: pageHidden,
  });

  if (pageHidden && !prevHidden) {
    trackingStore.appendEventRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      sessionId: session.id,
      type: "DRIVER_PAGE_HIDDEN",
      payload: {},
    });
  } else if (!pageHidden && prevHidden) {
    trackingStore.appendEventRecord({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      sessionId: session.id,
      type: "DRIVER_PAGE_VISIBLE",
      payload: {},
    });
  }

  const state = refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: updated,
    lastPosition: null,
  });

  return { ok: true, status: state.status, serverTime: now };
}

export async function ingestPositionsBatch(token, request, body = {}) {
  const { link, session, requestMeta } = await resolveContext(token, request);
  checkRateLimit(`public:pos:${clientIp(request)}`, { max: 120 });

  if (!session) {
    throw Object.assign(new Error("Sesión no iniciada"), { statusCode: 400, code: "no_session" });
  }
  if (!["ACTIVE", "LOW_ACCURACY", "STALE", "BACKGROUND_SUSPECTED", "OFFLINE", "ARRIVED"].includes(session.status) && !session.started_at) {
    throw Object.assign(new Error("Tracking no iniciado"), { statusCode: 400, code: "not_started" });
  }

  const batch = validatePositionsBatch(body.positions || body.items || []);
  if (!batch.ok) {
    throw Object.assign(new Error(batch.error), { statusCode: 400 });
  }

  let accepted = 0;
  let duplicates = 0;
  let lastRow = null;

  for (const pos of batch.value) {
    if (pos.sessionId !== session.id) {
      throw Object.assign(new Error("sessionId no coincide"), { statusCode: 400, code: "session_mismatch" });
    }
    const { row, duplicate } = trackingStore.insertPosition({
      tenantId: link.tenant_id,
      tripId: link.trip_id,
      sessionId: session.id,
      sequence: pos.sequence,
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracyMeters,
      altitude: pos.altitudeMeters,
      speed: pos.speedMps,
      heading: pos.headingDegrees,
      recordedAt: pos.recordedAt,
      audit: { ip: requestMeta.ip, userAgent: requestMeta.userAgent },
    });
    if (duplicate) duplicates += 1;
    else accepted += 1;
    lastRow = row;
    if (!duplicate) {
      trackingStore.appendEventRecord({
        tenantId: link.tenant_id,
        tripId: link.trip_id,
        sessionId: session.id,
        type: "POSITION_RECEIVED",
        payload: { sequence: pos.sequence },
      });
    }
  }

  const maxSeq = Math.max(session.last_sequence ?? -1, ...batch.value.map((p) => p.sequence));
  const lastAt = lastRow?.recorded_at || session.last_position_at;
  const updatedSession = trackingStore.patchSession(session.id, {
    last_sequence: maxSeq,
    last_position_at: lastAt,
    status: "ACTIVE",
  });

  const state = refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: updatedSession,
    lastPosition: lastRow,
  });

  // Geocerca destino (si hay coordenadas en body.destination o env)
  const dest = body.destination || {};
  const destLat = Number(dest.latitude ?? process.env.SOL_TRACKING_DEST_LAT);
  const destLng = Number(dest.longitude ?? process.env.SOL_TRACKING_DEST_LNG);
  if (lastRow && Number.isFinite(destLat) && Number.isFinite(destLng)) {
    if (isInsideGeofence(lastRow.latitude, lastRow.longitude, destLat, destLng, trackingGeofenceRadiusMeters())) {
      trackingStore.appendEventRecord({
        tenantId: link.tenant_id,
        tripId: link.trip_id,
        sessionId: session.id,
        type: "DESTINATION_GEOFENCE_ENTERED",
        payload: { latitude: lastRow.latitude, longitude: lastRow.longitude },
      });
    }
  }

  return {
    ok: true,
    accepted,
    duplicates,
    status: state.status,
    lastSequence: maxSeq,
  };
}

export async function stopTracking(token, request, body = {}) {
  const { link, session } = await resolveContext(token, request);
  if (!session) {
    return { ok: true, status: "NOT_STARTED" };
  }
  const now = new Date().toISOString();
  const updated = trackingStore.patchSession(session.id, {
    status: "STOPPED_BY_DRIVER",
    stopped_at: now,
  });
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "TRACKING_STOPPED",
    payload: { reason: body.reason || "driver" },
  });
  refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: updated,
    lastPosition: null,
  });
  return { ok: true, status: "STOPPED_BY_DRIVER" };
}

export async function confirmArrival(token, request) {
  const { link, session } = await resolveContext(token, request);
  if (!session) {
    throw Object.assign(new Error("Sesión no iniciada"), { statusCode: 400 });
  }
  const updated = trackingStore.patchSession(session.id, { status: "ARRIVED" });
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "DRIVER_ARRIVAL_CONFIRMED",
    payload: {},
  });
  refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: updated,
    lastPosition: null,
  });
  return { ok: true, status: "ARRIVED" };
}

export async function submitPod(token, request, body = {}) {
  const { link, viaje, session } = await resolveContext(token, request);
  if (!session) {
    throw Object.assign(new Error("Sesión no iniciada"), { statusCode: 400 });
  }
  const outcome = String(body.deliveryOutcome || "").trim();
  if (!outcome) {
    throw Object.assign(new Error("deliveryOutcome requerido"), { statusCode: 400 });
  }
  const receiverName = String(body.receiverName || "").trim();
  if (!receiverName) {
    throw Object.assign(new Error("receiverName requerido"), { statusCode: 400 });
  }
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  if (!imageUrl && body.photoRequired !== false) {
    throw Object.assign(new Error("Fotografía requerida"), { statusCode: 400, code: "photo_required" });
  }

  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "POD_REQUESTED",
    payload: { outcome },
  });

  const phone = sanitizePhone(viaje?.telefono_chofer || link.driver_id || "");
  let podRow = null;
  if (phone) {
    podRow = await podStore.crearPod({
      telefono: phone,
      chofer_nombre: viaje?.chofer || null,
      viaje_ref: viaje?.codigo || viaje?.id || link.trip_id,
      destino: viaje?.destino || null,
      receptor_nombre: receiverName,
      imagen_url: imageUrl,
      nota_chofer: body.observations || null,
      estado: "pendiente",
    });
  }

  const now = new Date().toISOString();
  const updated = trackingStore.patchSession(session.id, {
    status: "COMPLETED",
    completed_at: now,
  });

  if (viaje && viaje.estado === "en_curso") {
    try {
      await cambiarEstadoViaje(viaje.id, "entregado");
    } catch {
      /* no bloquear POD */
    }
  }

  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "POD_COMPLETED",
    payload: { receptor: receiverName, podId: podRow?.id || null },
  });
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "TRIP_TRACKING_COMPLETED",
    payload: {},
  });
  refreshTripState({
    tripId: link.trip_id,
    tenantId: link.tenant_id,
    session: updated,
    lastPosition: null,
  });

  if (isTrackingWhatsAppEnabled()) {
    try {
      const { sendTrackingWhatsApp } = await import("./tracking-wa.mjs");
      await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "completed",
        force: true,
      });
    } catch {
      /* no bloquear POD por WA */
    }
  }

  return {
    ok: true,
    status: "COMPLETED",
    podId: podRow?.id || null,
    podCodigo: podRow?.codigo || null,
  };
}

/** @deprecated alias */
export const submitPodPlaceholder = submitPod;

export async function reportIncident(token, request, body = {}) {
  const { link, viaje, session } = await resolveContext(token, request);
  if (!session) {
    throw Object.assign(new Error("Sesión no iniciada"), { statusCode: 400 });
  }
  if (!body.type) {
    throw Object.assign(new Error("type requerido"), { statusCode: 400 });
  }

  const phone = sanitizePhone(viaje?.telefono_chofer || link.driver_id || "");
  if (!phone) {
    throw Object.assign(new Error("Teléfono del chofer no disponible"), { statusCode: 400 });
  }

  const tipo = mapTrackingIncidentType(body.type);
  const resumen = body.text ? String(body.text).trim().slice(0, 2000) : null;

  const inc = await incidenciasStore.crearIncidencia({
    telefono: phone,
    chofer_nombre: viaje?.chofer || null,
    viaje_ref: viaje?.codigo || viaje?.id || link.trip_id,
    tipo,
    resumen,
    causa: resumen,
    lat: body.latitude ?? null,
    lng: body.longitude ?? null,
    imagen_url: body.imageUrl || null,
    origen: "tracking_express",
    estado: "nueva",
    historial: [`${new Date().toISOString()} · Reportada desde Tracking Express`],
  });

  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: session.id,
    type: "INCIDENT_REPORTED",
    payload: {
      type: body.type,
      incidenciaId: inc.id,
      codigo: inc.codigo,
    },
  });

  if (isTrackingWhatsAppEnabled()) {
    try {
      const { sendTrackingWhatsApp } = await import("./tracking-wa.mjs");
      await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "incident_escalated",
        force: true,
        extra: { tipo: body.type, codigo: inc.codigo },
      });
    } catch {
      /* no bloquear */
    }
  }

  return { ok: true, incidenciaId: inc.id, codigo: inc.codigo };
}

/** @deprecated alias */
export const reportIncidentPlaceholder = reportIncident;

export async function uploadTrackingPhoto(token, request, { buffer, mime }) {
  const { link } = await resolveContext(token, request);
  checkRateLimit(`public:upload:${clientIp(request)}`, { max: 20 });
  const saved = persistTrackingMedia(buffer, mime, { tripId: link.trip_id });
  if (!saved) {
    throw Object.assign(new Error("No se pudo guardar la imagen"), { statusCode: 400 });
  }
  return {
    ok: true,
    filename: saved.filename,
    url: saved.publicPath,
  };
}

export async function getPilotMetrics() {
  assertEnabled();
  const { collectTrackingPilotMetrics } = await import("./tracking-metrics.mjs");
  return collectTrackingPilotMetrics();
}

export function getPilotGate() {
  return getTrackingPilotGateSnapshot();
}
