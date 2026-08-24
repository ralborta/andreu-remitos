/**
 * Métricas agregadas del piloto Tracking Express (sin coords en logs).
 */
import fs from "node:fs";
import path from "node:path";
import { getTrackingPilotGateSnapshot } from "../../../lib/tracking/flags.mjs";
import { positionAgeSeconds } from "../../../lib/tracking/status.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const DIR = path.join(DATA_DIR, "tracking");

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function hoursAgoIso(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

export function collectTrackingPilotMetrics() {
  const links = Array.isArray(readJson(path.join(DIR, "links.json"), []))
    ? readJson(path.join(DIR, "links.json"), [])
    : [];
  const sessions = Array.isArray(readJson(path.join(DIR, "sessions.json"), []))
    ? readJson(path.join(DIR, "sessions.json"), [])
    : [];
  const positions = Array.isArray(readJson(path.join(DIR, "positions.json"), []))
    ? readJson(path.join(DIR, "positions.json"), [])
    : [];
  const events = Array.isArray(readJson(path.join(DIR, "events.json"), []))
    ? readJson(path.join(DIR, "events.json"), [])
    : [];
  const tripStateRaw = readJson(path.join(DIR, "trip-state.json"), {});
  const tripStates =
    tripStateRaw && typeof tripStateRaw === "object" && !Array.isArray(tripStateRaw)
      ? Object.values(tripStateRaw)
      : [];

  const since24h = hoursAgoIso(24);
  const now = new Date();

  const activeSessions = sessions.filter(
    (s) => s.started_at && !["COMPLETED", "CANCELLED", "STOPPED_BY_DRIVER"].includes(s.status),
  );
  const activeLinks = links.filter(
    (l) => !l.revoked_at && new Date(l.expires_at).getTime() > Date.now(),
  );

  const positions24h = positions.filter((p) => p.received_at >= since24h);
  const events24h = events.filter((e) => e.occurred_at >= since24h);
  const waSent24h = events24h.filter((e) => e.type === "TRACKING_WA_SENT").length;
  const stale24h = events24h.filter((e) => e.type === "TRACKING_STALE").length;
  const pods24h = events24h.filter((e) => e.type === "POD_COMPLETED").length;
  const incidents24h = events24h.filter((e) => e.type === "INCIDENT_REPORTED").length;

  let staleNow = 0;
  let criticalNow = 0;
  let activeNow = 0;
  for (const st of tripStates) {
    const age = st.position_age_seconds ?? positionAgeSeconds(st.last_position_at, now);
    if (["ACTIVE", "LOW_ACCURACY"].includes(st.status)) activeNow += 1;
    if (age != null && age > 120) staleNow += 1;
    if (age != null && age > 300) criticalNow += 1;
  }

  return {
    collectedAt: now.toISOString(),
    gate: getTrackingPilotGateSnapshot(),
    totals: {
      links: links.length,
      linksActive: activeLinks.length,
      sessions: sessions.length,
      sessionsActive: activeSessions.length,
      positions: positions.length,
      events: events.length,
      tripStates: tripStates.length,
    },
    last24h: {
      positions: positions24h.length,
      events: events24h.length,
      waSent: waSent24h,
      staleEvents: stale24h,
      podsCompleted: pods24h,
      incidents: incidents24h,
      linksCreated: links.filter((l) => l.created_at >= since24h).length,
      sessionsStarted: sessions.filter((s) => s.started_at && s.started_at >= since24h).length,
    },
    live: {
      activeTracking: activeNow,
      stale: staleNow,
      critical: criticalNow,
    },
  };
}
