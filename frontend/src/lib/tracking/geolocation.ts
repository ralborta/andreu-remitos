import type { PositionInput } from "./types";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 20_000,
};

export type GeoReading = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  recordedAt: string;
};

type SendCallback = (position: PositionInput) => void;

/** Política de envío: movimiento 25s, detenido 60s, cambio >40m inmediato. */
export class TrackingGeolocationEngine {
  private watchId: number | null = null;
  private lastSent: GeoReading | null = null;
  private lastSentAt = 0;
  private sequence = 0;
  private sessionId = "";
  private onSend: SendCallback;
  private stopped = false;

  constructor(onSend: SendCallback) {
    this.onSend = onSend;
  }

  start(sessionId: string, initialSequence = 0) {
    this.sessionId = sessionId;
    this.sequence = initialSequence;
    this.stopped = false;
    if (!navigator.geolocation) throw new Error("Geolocalización no disponible");
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      () => {},
      GEO_OPTIONS,
    );
  }

  stop() {
    this.stopped = true;
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private handlePosition(pos: GeolocationPosition) {
    if (this.stopped) return;
    const reading: GeoReading = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy ?? null,
      altitudeMeters: pos.coords.altitude ?? null,
      speedMps: pos.coords.speed ?? null,
      headingDegrees: pos.coords.heading ?? null,
      recordedAt: new Date(pos.timestamp).toISOString(),
    };
    if (!this.shouldSend(reading)) return;
    this.sequence += 1;
    this.lastSent = reading;
    this.lastSentAt = Date.now();
    this.onSend({
      sessionId: this.sessionId,
      sequence: this.sequence,
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracyMeters: reading.accuracyMeters,
      altitudeMeters: reading.altitudeMeters,
      speedMps: reading.speedMps,
      headingDegrees: reading.headingDegrees,
      recordedAt: reading.recordedAt,
    });
  }

  private shouldSend(reading: GeoReading) {
    if (!this.lastSent) return true;
    const moved = haversineM(
      this.lastSent.latitude,
      this.lastSent.longitude,
      reading.latitude,
      reading.longitude,
    );
    if (moved >= 40) return true;
    const speed = reading.speedMps ?? 0;
    const interval = speed > 1.5 ? 25_000 : 60_000;
    return Date.now() - this.lastSentAt >= interval;
  }

  getLastReading() {
    return this.lastSent;
  }

  getSequence() {
    return this.sequence;
  }
}

export function requestSinglePosition(): Promise<GeoReading> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? null,
          altitudeMeters: pos.coords.altitude ?? null,
          speedMps: pos.coords.speed ?? null,
          headingDegrees: pos.coords.heading ?? null,
          recordedAt: new Date(pos.timestamp).toISOString(),
        }),
      (err) => reject(new Error(err.message || "Permiso de ubicación denegado")),
      GEO_OPTIONS,
    );
  });
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function googleMapsNavigateUrl(destination: string, lat?: number, lng?: number) {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&dir_action=navigate`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&dir_action=navigate`;
}

export function wazeNavigateUrl(destination: string, lat?: number, lng?: number) {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`;
}

/** Wake Lock API — best effort, no bloquea si no está disponible. */
export async function requestWakeLock(): Promise<{ release: () => Promise<void> } | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return null;
    const lock = await nav.wakeLock.request("screen");
    return lock;
  } catch {
    return null;
  }
}
