/**
 * @param {unknown} body
 * @returns {{ ok: true, value: import("./types.mjs").TrackingPositionInput } | { ok: false, error: string }}
 */
export function validatePositionInput(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Posición inválida" };
  }
  const sessionId = String(body.sessionId || "").trim();
  const sequence = Number(body.sequence);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const recordedAt = String(body.recordedAt || "").trim();

  if (!sessionId) return { ok: false, error: "sessionId requerido" };
  if (!Number.isInteger(sequence) || sequence < 0) {
    return { ok: false, error: "sequence inválido" };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: "latitude inválida" };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "longitude inválida" };
  }
  if (!recordedAt || Number.isNaN(new Date(recordedAt).getTime())) {
    return { ok: false, error: "recordedAt inválido" };
  }

  const accuracyMeters =
    body.accuracyMeters == null ? null : Number(body.accuracyMeters);
  const altitudeMeters =
    body.altitudeMeters == null ? null : Number(body.altitudeMeters);
  const speedMps = body.speedMps == null ? null : Number(body.speedMps);
  const headingDegrees =
    body.headingDegrees == null ? null : Number(body.headingDegrees);

  return {
    ok: true,
    value: {
      sessionId,
      sequence,
      latitude,
      longitude,
      accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : null,
      altitudeMeters: Number.isFinite(altitudeMeters) ? altitudeMeters : null,
      speedMps: Number.isFinite(speedMps) ? speedMps : null,
      headingDegrees: Number.isFinite(headingDegrees) ? headingDegrees : null,
      recordedAt,
    },
  };
}

/**
 * @param {unknown[]} items
 */
export function validatePositionsBatch(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Lote vacío" };
  }
  if (items.length > 200) {
    return { ok: false, error: "Máximo 200 posiciones por lote" };
  }
  const parsed = [];
  for (const item of items) {
    const r = validatePositionInput(item);
    if (!r.ok) return r;
    parsed.push(r.value);
  }
  return { ok: true, value: parsed };
}
