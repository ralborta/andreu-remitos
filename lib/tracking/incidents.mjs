/**
 * Mapeo tipos Tracking Express → dominio incidencias SOL.
 */
const MAP = {
  demora: "demora",
  accidente: "accidente",
  problema_mecanico: "mecanico",
  direccion_incorrecta: "desvio_ruta",
  rechazo_entrega: "anomalia",
  mercaderia_danada: "anomalia",
  problema_carga_descarga: "otro",
  otro: "otro",
};

export function mapTrackingIncidentType(type) {
  const key = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return MAP[key] || "otro";
}

export const TRACKING_INCIDENT_OPTIONS = [
  { id: "demora", label: "Demora" },
  { id: "accidente", label: "Accidente" },
  { id: "problema_mecanico", label: "Problema mecánico" },
  { id: "direccion_incorrecta", label: "Dirección incorrecta" },
  { id: "rechazo_entrega", label: "Rechazo de entrega" },
  { id: "mercaderia_danada", label: "Mercadería dañada" },
  { id: "problema_carga_descarga", label: "Problema en carga o descarga" },
  { id: "otro", label: "Otro" },
];
