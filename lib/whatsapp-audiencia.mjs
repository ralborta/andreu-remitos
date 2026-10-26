/** El agente solo escribe a un +54 que está registrado como chofer o encargado. */

export function esTelefonoArgentina(telefono) {
  const digits = String(telefono ?? "").replace(/\D/g, "");
  return digits.startsWith("54") && digits.length >= 12 && digits.length <= 15;
}

export async function agentePuedeEscribir(telefono) {
  const digits = String(telefono ?? "").replace(/\D/g, "");
  if (!esTelefonoArgentina(digits)) return false;
  try {
    const { resolverChoferPorTelefono } = await import("../backend/src/db/master-data-store.mjs");
    if (await resolverChoferPorTelefono(digits)) return true;
    const { getChoferViajesPorTelefono } = await import("../backend/src/db/viajes-flota-store.mjs");
    return Boolean(getChoferViajesPorTelefono(digits));
  } catch (err) {
    console.error("[whatsapp] no se pudo verificar el contacto:", err?.message || err);
    return false;
  }
}
