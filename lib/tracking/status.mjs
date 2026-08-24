import { DEFAULT_STATUS_THRESHOLDS } from "./constants.mjs";

/**
 * Deriva estado operativo de tracking a partir de hechos objetivos.
 * No inventa coordenadas ni ETA.
 *
 * @param {{
 *   sessionStatus?: string,
 *   lastPositionAt?: string | null,
 *   lastHeartbeatAt?: string | null,
 *   permissionDenied?: boolean,
 *   offline?: boolean,
 *   pageHidden?: boolean,
 *   accuracyMeters?: number | null,
 *   now?: Date,
 *   thresholds?: Partial<typeof DEFAULT_STATUS_THRESHOLDS>,
 * }} input
 * @returns {import("./constants.mjs").TrackingStatus}
 */
export function computeTrackingStatus(input = {}) {
  const thresholds = { ...DEFAULT_STATUS_THRESHOLDS, ...input.thresholds };
  const now = input.now ?? new Date();

  const terminal = new Set([
    "COMPLETED",
    "CANCELLED",
    "STOPPED_BY_DRIVER",
    "ARRIVED",
  ]);
  const sessionStatus = String(input.sessionStatus || "NOT_STARTED");
  if (terminal.has(sessionStatus)) return /** @type {import("./constants.mjs").TrackingStatus} */ (sessionStatus);

  if (input.permissionDenied) return "PERMISSION_DENIED";
  if (input.offline) return "OFFLINE";
  if (sessionStatus === "AWAITING_PERMISSION") return "AWAITING_PERMISSION";
  if (sessionStatus === "NOT_STARTED") return "NOT_STARTED";

  const lastAt = input.lastPositionAt || input.lastHeartbeatAt;
  if (!lastAt) return sessionStatus === "ACTIVE" ? "STALE" : "NOT_STARTED";

  const ageSec = Math.max(0, (now.getTime() - new Date(lastAt).getTime()) / 1000);

  if (input.pageHidden && ageSec > thresholds.staleSeconds) {
    return "BACKGROUND_SUSPECTED";
  }
  if (ageSec > thresholds.staleSeconds) return "STALE";
  if (
    input.accuracyMeters != null &&
    Number.isFinite(input.accuracyMeters) &&
    input.accuracyMeters > thresholds.lowAccuracyMeters
  ) {
    return "LOW_ACCURACY";
  }
  if (ageSec <= thresholds.activeSeconds) return "ACTIVE";
  return "STALE";
}

/**
 * @param {string | null | undefined} iso
 * @param {Date} [now]
 */
export function positionAgeSeconds(iso, now = new Date()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now.getTime() - t) / 1000));
}
