/**
 * Dominio Rendición de gastos (SOL) — gastos menores del viaje.
 * Siempre sujetos a verificación humana.
 */

export const RENDICION_CATEGORIAS = [
  "combustible",
  "peaje",
  "arreglo_menor",
  "llantas",
  "aceite",
  "remolque",
  "auxilio_mecanico",
  "otro",
];

export const RENDICION_CATEGORIA_LABEL = {
  combustible: "Combustible / nafta",
  peaje: "Peaje",
  arreglo_menor: "Arreglo menor",
  llantas: "Llantas",
  aceite: "Aceite",
  remolque: "Remolque",
  auxilio_mecanico: "Auxilio mecánico",
  otro: "Otro",
};

/** Estados de un comprobante/gasto individual */
export const GASTO_ESTADOS = [
  "borrador",
  "pendiente_aprobacion",
  "aprobado",
  "rechazado",
];

export const GASTO_ESTADO_LABEL = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export function labelCategoria(cat) {
  return RENDICION_CATEGORIA_LABEL[cat] || cat || "Otro";
}

export function labelEstadoGasto(est) {
  return GASTO_ESTADO_LABEL[est] || est || "—";
}

export function moneyAR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(v);
}
