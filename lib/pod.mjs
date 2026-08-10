/** Dominio POD — Proof of Delivery (constancia de entrega). */

export const POD_ESTADOS = [
  "esperando_receptor",
  "esperando_foto",
  "pendiente",
  "ok",
  "rechazado",
];

export const POD_ESTADOS_DIALOG = new Set(["esperando_receptor", "esperando_foto"]);

export const POD_ESTADO_LABEL = {
  esperando_receptor: "Esperando receptor",
  esperando_foto: "Esperando foto",
  pendiente: "Pendiente",
  ok: "OK",
  rechazado: "Rechazado",
};

export function labelEstadoPod(estado) {
  return POD_ESTADO_LABEL[estado] || estado || "—";
}

export function buildCodigoPod(rows) {
  const n = (Array.isArray(rows) ? rows : []).filter((r) => r.codigo).length + 1;
  return `POD-${String(n).padStart(4, "0")}`;
}
