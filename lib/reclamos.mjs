/**
 * Dominio Reclamos logísticos (clientes) — alineado a la demo UI.
 */

export const RECLAMO_MOTIVOS = [
  "demora_entrega",
  "faltante",
  "averia",
  "producto_equivocado",
  "documentacion",
  "trato",
  "otro",
];

export const RECLAMO_MOTIVO_LABEL = {
  demora_entrega: "Demora en entrega",
  faltante: "Faltante",
  averia: "Producto dañado / avería",
  producto_equivocado: "Producto equivocado",
  documentacion: "Documentación",
  trato: "Trato",
  otro: "Otro",
};

/** Solo estos motivos piden foto del producto (daño o error de ítem). */
export const RECLAMO_MOTIVOS_REQUIEREN_FOTO = ["averia", "producto_equivocado"];

export function motivoRequiereFoto(motivo) {
  return RECLAMO_MOTIVOS_REQUIEREN_FOTO.includes(String(motivo || "").toLowerCase());
}

export const RECLAMO_CRITICIDADES = ["alta", "media", "baja"];

export const RECLAMO_CRITICIDAD_LABEL = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

/** Estados visibles en panel (demo). */
export const RECLAMO_ESTADOS = ["nuevo", "en_proceso", "escalado", "resuelto", "recolectando"];

export const RECLAMO_ESTADO_LABEL = {
  recolectando: "Recolectando",
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  escalado: "Escalado",
  resuelto: "Resuelto",
};

export function labelMotivo(m) {
  return RECLAMO_MOTIVO_LABEL[m] || RECLAMO_MOTIVO_LABEL.otro;
}

export function labelCriticidad(c) {
  return RECLAMO_CRITICIDAD_LABEL[c] || RECLAMO_CRITICIDAD_LABEL.media;
}

export function labelEstadoReclamo(e) {
  return RECLAMO_ESTADO_LABEL[e] || e;
}

/** SLA demo-simple a partir de criticidad + created_at. */
export function calcularSlaLabel(row) {
  if (!row) return "En SLA";
  if (row.estado === "resuelto") return "Cumplido";
  const created = Date.parse(row.created_at || "");
  if (!Number.isFinite(created)) return "En SLA";
  const hours = (Date.now() - created) / 3600000;
  const limit =
    row.criticidad === "alta" ? 4 : row.criticidad === "baja" ? 48 : 12;
  if (hours >= limit) return "Por vencer";
  if (hours >= limit * 0.7) return "Por vencer";
  return "En SLA";
}
