/** Plantillas de reanudación por ProcessType (declarativas, no heurística). */

const HINTS = {
  remito_revision:
    "Retomamos tu *remito*. ¿Confirmás con *OK* o me decís qué corregimos?",
  viaje_solicitud:
    "Seguimos con tu *viaje*. ¿Me pasás el dato que faltaba (origen, destino, toneladas…)?",
  destino_confirmacion:
    "Volvemos al *destino*. ¿La dirección es correcta? Respondé *SÍ* o la corrección.",
  destino_eta_chofer:
    "Retomamos el *ETA*. Mandame algo como *30 min* o *1 hora*.",
  pod_caso: "Seguimos con el *POD*. Mandame la foto del formulario o del producto entregado.",
  rendicion_gasto: "Retomamos la *rendición*. Mandame la foto del ticket o el detalle del gasto.",
  incidencia: "Seguimos con la *incidencia*. Contame cómo sigue o si ya se resolvió.",
  reclamo: "Retomamos tu *reclamo*. ¿En qué te ayudo con el caso?",
  ephemeral_qa: null,
  human_takeover: null,
};

export function resumeHintForProcessType(processType) {
  return HINTS[processType] ?? "Retomamos lo que estábamos haciendo. ¿Seguimos?";
}

export function buildResumeSnapshot(processType, extra = {}) {
  return {
    version: 1,
    promptHint: resumeHintForProcessType(processType),
    stepKey: extra.stepKey ?? null,
    collectedKeys: extra.collectedKeys ?? [],
  };
}
