/**
 * Dominio de viajes Andreu — independiente del TMS.
 * El adaptador en lib/tms/ puede sincronizar después sin cambiar este modelo.
 */

export const VIAJE_ESTADOS = [
  "solicitado",
  "confirmado",
  "asignado",
  "en_curso",
  "entregado",
  "cerrado",
  "cancelado",
];

export const VIAJE_ESTADO_LABEL = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  asignado: "Asignado",
  en_curso: "En curso",
  entregado: "Entregado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

/** Transiciones permitidas (MVP). */
export const VIAJE_TRANSICIONES = {
  solicitado: ["confirmado", "cancelado"],
  confirmado: ["asignado", "cancelado"],
  asignado: ["en_curso", "cancelado"],
  en_curso: ["entregado", "cancelado"],
  entregado: ["cerrado"],
  cerrado: [],
  cancelado: [],
};

export function puedeTransicionar(desde, hacia) {
  const allowed = VIAJE_TRANSICIONES[desde] ?? [];
  return allowed.includes(hacia);
}

/**
 * Código de negocio visible: VJ-YYYYMMDD-NNN
 * @param {Date} [fecha]
 * @param {number} seq
 */
export function formatearCodigoViaje(fecha = new Date(), seq = 1) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  const n = String(Math.max(1, seq)).padStart(3, "0");
  return `VJ-${y}${m}${d}-${n}`;
}

/**
 * @param {Record<string, unknown>} body
 */
export function normalizarAltaViaje(body = {}) {
  const cliente = String(body.cliente ?? "").trim();
  const origen = String(body.origen ?? "").trim();
  const destino = String(body.destino ?? "").trim();
  if (!cliente) throw Object.assign(new Error("Falta cliente"), { statusCode: 400 });
  if (!origen) throw Object.assign(new Error("Falta origen"), { statusCode: 400 });
  if (!destino) throw Object.assign(new Error("Falta destino"), { statusCode: 400 });

  const tenantRaw = String(body.tenant ?? "").trim().toLowerCase();
  const tenant = ["tsb", "beraldi", "corina"].includes(tenantRaw) ? tenantRaw : null;

  return {
    cliente,
    origen,
    destino,
    carga: String(body.carga ?? "").trim() || null,
    fecha: String(body.fecha ?? "").trim() || null,
    tenant,
    chofer: String(body.chofer ?? "").trim() || null,
    telefono_chofer: String(body.telefono_chofer ?? body.telefonoChofer ?? "").trim() || null,
    tractor: String(body.tractor ?? "").trim() || null,
    semi: String(body.semi ?? "").trim() || null,
    notas: String(body.notas ?? "").trim() || null,
    remito_ids: Array.isArray(body.remito_ids) ? body.remito_ids.map(String) : [],
    destino_validacion_id: body.destino_validacion_id ?? body.destinoValidacionId ?? null,
    /** Gancho TMS — vacío hasta conectar. */
    tms_id: body.tms_id ?? body.tmsId ?? null,
    tms_sync_status: "none",
    tms_synced_at: null,
  };
}
