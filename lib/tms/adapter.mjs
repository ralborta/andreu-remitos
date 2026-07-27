/**
 * Adaptador TMS — hoy no-op.
 * Cuando haya conector (Delfos / QuadMy / otro), implementar push/pull acá
 * sin cambiar el CRUD de viajes en Andreu.
 */

function tmsEnabled() {
  return String(process.env.TMS_ENABLED || "").toLowerCase() === "true";
}

/**
 * @param {Record<string, unknown>} viaje
 * @returns {Promise<{ ok: boolean, skipped?: boolean, tms_id?: string|null, error?: string }>}
 */
export async function syncViajeConfirmado(viaje) {
  if (!tmsEnabled()) {
    return { ok: true, skipped: true, tms_id: viaje?.tms_id ?? null };
  }
  // Placeholder: conectar cliente HTTP / SOAP del TMS.
  return {
    ok: false,
    skipped: false,
    error: "TMS_ENABLED=true pero el conector aún no está implementado",
  };
}

/**
 * @param {Record<string, unknown>} viaje
 */
export async function syncViajeEstado(viaje) {
  if (!tmsEnabled()) {
    return { ok: true, skipped: true };
  }
  return {
    ok: false,
    skipped: false,
    error: "TMS_ENABLED=true pero el conector aún no está implementado",
  };
}
