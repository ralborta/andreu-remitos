/** @typedef {"BROWSER_GEOLOCATION" | "NAVIGATION_CONNECT" | "WHATSAPP_LOCATION" | "GPS_DEVICE"} TrackingSource */

/** @typedef {"NOT_STARTED" | "AWAITING_PERMISSION" | "ACTIVE" | "LOW_ACCURACY" | "STALE" | "BACKGROUND_SUSPECTED" | "OFFLINE" | "PERMISSION_DENIED" | "STOPPED_BY_DRIVER" | "ARRIVED" | "COMPLETED" | "CANCELLED"} TrackingStatus */

export const TRACKING_SOURCES = /** @type {const} */ ([
  "BROWSER_GEOLOCATION",
  "NAVIGATION_CONNECT",
  "WHATSAPP_LOCATION",
  "GPS_DEVICE",
]);

export const TRACKING_STATUSES = /** @type {const} */ ([
  "NOT_STARTED",
  "AWAITING_PERMISSION",
  "ACTIVE",
  "LOW_ACCURACY",
  "STALE",
  "BACKGROUND_SUSPECTED",
  "OFFLINE",
  "PERMISSION_DENIED",
  "STOPPED_BY_DRIVER",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
]);

export const TRACKING_EVENT_TYPES = /** @type {const} */ ([
  "TRACKING_LINK_CREATED",
  "TRACKING_LINK_OPENED",
  "CONSENT_ACCEPTED",
  "TRACKING_STARTED",
  "POSITION_RECEIVED",
  "TRACKING_STALE",
  "TRACKING_RECOVERED",
  "LOW_ACCURACY_DETECTED",
  "DRIVER_PAGE_HIDDEN",
  "DRIVER_PAGE_VISIBLE",
  "LONG_STOP_SUSPECTED",
  "DESTINATION_GEOFENCE_ENTERED",
  "DRIVER_ARRIVAL_CONFIRMED",
  "INCIDENT_REPORTED",
  "POD_REQUESTED",
  "POD_COMPLETED",
  "TRACKING_STOPPED",
  "TRIP_TRACKING_COMPLETED",
  "TRACKING_WA_SENT",
]);

/** Estados de viaje que bloquean tracking nuevo. */
export const VIAJE_ESTADOS_FINALES = new Set(["entregado", "cerrado", "cancelado"]);

export const LINK_VALIDATION = /** @type {const} */ ({
  VALID: "valid",
  EXPIRED: "expired",
  REVOKED: "revoked",
  TRIP_FINALIZED: "trip_finalized",
  TRIP_CANCELLED: "trip_cancelled",
  INVALID: "invalid",
});

export const DEFAULT_STATUS_THRESHOLDS = {
  activeSeconds: 90,
  staleSeconds: 120,
  criticalSeconds: 300,
  lowAccuracyMeters: 100,
};
