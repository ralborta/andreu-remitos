#!/usr/bin/env node
/**
 * Regresión SOL Tracking Express — Fase 1 (dominio + backend).
 * Usa DATA_DIR temporal; no toca producción.
 *
 *   SOL_TRACKING_EXPRESS_ENABLED=true node scripts/verify-tracking-express.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-express-"));
process.env.DATA_DIR = tmp;
process.env.SOL_TRACKING_EXPRESS_ENABLED = "true";
process.env.SOL_TRACKING_LINK_TTL_HOURS = "24";
// Piloto abierto para tests (en prod usar listas concretas, nunca * sin autorización)
process.env.SOL_TRACKING_ALLOWLIST_TENANTS = "*";
process.env.SOL_TRACKING_ALLOWLIST_PHONES = "*";
process.env.SOL_TRACKING_WA_ENABLED = "false";

const { generateTrackingToken, hashTrackingToken, verifyTrackingToken } = await import(
  "../lib/tracking/tokens.mjs"
);
const { computeTrackingStatus, positionAgeSeconds } = await import("../lib/tracking/status.mjs");
const { isInsideGeofence, distanceMeters } = await import("../lib/tracking/geofence.mjs");
const { validatePositionsBatch } = await import("../lib/tracking/validation.mjs");
const { isTrackingExpressEnabled } = await import("../lib/tracking/flags.mjs");
const trackingStore = await import("../backend/src/db/tracking-store.mjs");
const viajesStore = await import("../backend/src/db/viajes-store.mjs");
const tracking = await import("../backend/src/services/tracking-service.mjs");

function mockRequest(overrides = {}) {
  return {
    ip: "127.0.0.1",
    headers: { "user-agent": "verify-script", ...overrides.headers },
    ...overrides,
  };
}

console.log("0) Feature flag");
assert.equal(isTrackingExpressEnabled(), true);

console.log("1) Tokens — hash y verificación");
const tok = generateTrackingToken();
assert.ok(tok.length >= 32);
const hash = hashTrackingToken(tok);
assert.ok(verifyTrackingToken(tok, hash));
assert.equal(verifyTrackingToken("wrong", hash), false);

console.log("2) Status — ACTIVE / STALE / BACKGROUND");
const now = new Date("2026-08-23T12:00:00.000Z");
assert.equal(
  computeTrackingStatus({
    sessionStatus: "ACTIVE",
    lastPositionAt: "2026-08-23T11:59:30.000Z",
    now,
  }),
  "ACTIVE",
);
assert.equal(
  computeTrackingStatus({
    sessionStatus: "ACTIVE",
    lastPositionAt: "2026-08-23T11:57:00.000Z",
    now,
  }),
  "STALE",
);
assert.equal(
  computeTrackingStatus({
    sessionStatus: "ACTIVE",
    lastPositionAt: "2026-08-23T11:57:00.000Z",
    pageHidden: true,
    now,
  }),
  "BACKGROUND_SUSPECTED",
);
assert.equal(positionAgeSeconds("2026-08-23T11:59:00.000Z", now), 60);

console.log("3) Geocerca");
const d = distanceMeters(-34.6, -58.4, -34.601, -58.401);
assert.ok(d > 0 && d < 2000);
assert.equal(isInsideGeofence(-34.6, -58.4, -34.6, -58.4, 300), true);
assert.equal(isInsideGeofence(-34.7, -58.4, -34.6, -58.4, 300), false);

console.log("4) Crear viaje + enlace");
const viaje = await viajesStore.crearViaje({
  cliente: "Cliente Test",
  origen: "Origen A",
  destino: "Destino B",
  tenant: "tsb",
  chofer: "Juan Pérez",
  telefono_chofer: "5491112345678",
  tractor: "AB 123 CD",
});
assert.ok(viaje.id);

const { token, link, trackingUrl } = await tracking.createTrackingLink({
  tripId: viaje.id,
  createdBy: "test-admin",
});
assert.ok(link.id);
assert.ok(trackingUrl.includes(token));

console.log("5) Token válido / vencido / revocado");
const pub = await tracking.getPublicTracking(token, mockRequest());
assert.equal(pub.linkStatus, "valid");
assert.ok(pub.trip?.session?.id);

const expiredTok = generateTrackingToken();
trackingStore.createLinkRecord(
  {
    tripId: viaje.id,
    tenantId: "tsb",
    expiresAt: "2020-01-01T00:00:00.000Z",
  },
  expiredTok,
);
const expired = trackingStore.validateLinkToken(expiredTok, viaje);
assert.equal(expired.status, "expired");

await tracking.revokeTrackingLink(link.id);
const revoked = trackingStore.validateLinkToken(token, viaje);
assert.equal(revoked.status, "revoked");

console.log("6) Nuevo enlace para flujo completo");
const link2 = await tracking.createTrackingLink({ tripId: viaje.id, createdBy: "test" });
const token2 = link2.token;
const sessionId = (await tracking.getPublicTracking(token2, mockRequest())).trip.session.id;

console.log("7) Consentimiento + inicio");
await tracking.acceptConsent(token2, mockRequest(), { consentVersion: "1.0" });
const started = await tracking.startTracking(token2, mockRequest(), {
  confirmDriver: true,
  confirmVehicle: true,
});
assert.equal(started.status, "ACTIVE");
assert.equal(started.sessionId, sessionId);

const dupStart = await tracking.startTracking(token2, mockRequest(), {
  confirmDriver: true,
  confirmVehicle: true,
});
assert.equal(dupStart.duplicate, true);

console.log("8) Posiciones — idempotencia y lote");
const posBody = {
  positions: [
    {
      sessionId,
      sequence: 1,
      latitude: -34.6037,
      longitude: -58.3816,
      accuracyMeters: 18,
      altitudeMeters: null,
      speedMps: 5,
      headingDegrees: 90,
      recordedAt: "2026-08-23T12:01:00.000Z",
    },
    {
      sessionId,
      sequence: 2,
      latitude: -34.604,
      longitude: -58.382,
      accuracyMeters: 20,
      altitudeMeters: null,
      speedMps: 6,
      headingDegrees: 95,
      recordedAt: "2026-08-23T12:01:30.000Z",
    },
  ],
};
const batch1 = await tracking.ingestPositionsBatch(token2, mockRequest(), posBody);
assert.equal(batch1.accepted, 2);
assert.equal(batch1.duplicates, 0);

const batchDup = await tracking.ingestPositionsBatch(token2, mockRequest(), posBody);
assert.equal(batchDup.duplicates, 2);
assert.equal(batchDup.accepted, 0);

console.log("9) Aislamiento tenant en live");
const live = await tracking.getTripLive(viaje.id);
assert.equal(live.tracking?.last_position?.latitude, -34.604);

await assert.rejects(
  () => tracking.getTripLive(viaje.id, { tenantId: "beraldi" }),
  (err) => err.statusCode === 403,
);

console.log("10) Heartbeat + visibilidad");
await tracking.recordHeartbeat(token2, mockRequest(), { pageVisibility: "hidden" });
await tracking.recordHeartbeat(token2, mockRequest(), { pageVisibility: "visible" });

console.log("11) Llegada + POD + incidencia");
await tracking.confirmArrival(token2, mockRequest());
const pod = await tracking.submitPod(token2, mockRequest(), {
  deliveryOutcome: "complete",
  receiverName: "María",
  imageUrl: "/api/tracking/public/media/test.jpg",
});
assert.equal(pod.status, "COMPLETED");
assert.ok(pod.podId);

console.log("12) Feature flag off");
process.env.SOL_TRACKING_EXPRESS_ENABLED = "false";
await assert.rejects(
  () => tracking.createTrackingLink({ tripId: viaje.id }),
  (err) => err.statusCode === 404,
);

console.log("13) Validación batch vacío");
const bad = validatePositionsBatch([]);
assert.equal(bad.ok, false);

console.log("14) Seal/open token + plantillas WA");
const { sealTrackingToken, openTrackingToken, buildTrackingPublicUrl } = await import(
  "../lib/tracking/tokens.mjs"
);
const sealed = sealTrackingToken(tok);
assert.equal(openTrackingToken(sealed), tok);
assert.ok(buildTrackingPublicUrl(tok).includes(tok));

const wa = await import("../lib/tracking/wa-templates.mjs");
const msg = wa.mensajeTrackingAsignado({
  chofer: "Juan",
  viaje: { codigo: "VJ-1", origen: "A", destino: "B", tractor: "XX" },
  trackingUrl: "https://example.com/t/abc",
});
assert.ok(msg.includes("Juan") && msg.includes("https://example.com/t/abc"));

console.log("15) Watcher tick con WA off");
process.env.SOL_TRACKING_EXPRESS_ENABLED = "true";
process.env.SOL_TRACKING_WA_ENABLED = "false";
const trackingWa = await import("../backend/src/services/tracking-wa.mjs");
const tick = await trackingWa.tickTrackingWhatsApp({});
assert.equal(tick.skipped, true);

console.log("16) Allowlist piloto fail-closed / gate");
const { isTrackingAllowedForTrip, getTrackingPilotGateSnapshot } = await import(
  "../lib/tracking/flags.mjs"
);
process.env.SOL_TRACKING_ALLOWLIST_TENANTS = "";
process.env.SOL_TRACKING_ALLOWLIST_PHONES = "";
assert.equal(
  isTrackingAllowedForTrip({ tenant: "tsb", telefono_chofer: "5491112345678" }).ok,
  false,
);
process.env.SOL_TRACKING_ALLOWLIST_TENANTS = "tsb";
process.env.SOL_TRACKING_ALLOWLIST_PHONES = "5491112345678";
assert.equal(
  isTrackingAllowedForTrip({ tenant: "tsb", telefono_chofer: "5491112345678" }).ok,
  true,
);
assert.equal(
  isTrackingAllowedForTrip({ tenant: "beraldi", telefono_chofer: "5491112345678" }).ok,
  false,
);
assert.equal(
  isTrackingAllowedForTrip({ tenant: "tsb", telefono_chofer: "5491199999999" }).ok,
  false,
);
const snap = getTrackingPilotGateSnapshot();
assert.equal(snap.gated, true);
assert.equal(snap.tenants_mode, "list");

console.log("17) Métricas piloto");
process.env.SOL_TRACKING_ALLOWLIST_TENANTS = "*";
process.env.SOL_TRACKING_ALLOWLIST_PHONES = "*";
const { collectTrackingPilotMetrics } = await import(
  "../backend/src/services/tracking-metrics.mjs"
);
const metrics = collectTrackingPilotMetrics();
assert.ok(metrics.totals);
assert.ok(metrics.last24h);
assert.ok(metrics.gate.enabled);

console.log("OK verify-tracking-express");
fs.rmSync(tmp, { recursive: true, force: true });
