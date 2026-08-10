/**
 * Contactos que no deben aparecer en la UI de Contactos ni persistirse.
 * También se pueden sumar por env: CONTACTOS_OCULTOS=59171313075,54911...
 */
import { sanitizePhone } from "./builderbot-webhook.mjs";

const FIJOS = [
  "59171313075", // Turko — fuera de operación / no mostrar en UI
];

function listaEnv() {
  const raw = process.env.CONTACTOS_OCULTOS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => sanitizePhone(s))
    .filter(Boolean);
}

export function telefonosOcultos() {
  return new Set([...FIJOS, ...listaEnv()].map((p) => sanitizePhone(p)).filter(Boolean));
}

export function esContactoOculto(telefono, nombre = null) {
  const phone = sanitizePhone(telefono);
  if (phone && telefonosOcultos().has(phone)) return true;
  if (nombre && /\bturko\b/i.test(String(nombre))) return true;
  return false;
}
