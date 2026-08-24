/**
 * Plantillas WhatsApp — SOL Tracking Express.
 * Solo texto determinístico; sin IA inventando estados o coords.
 */

function unidadLabel(viaje) {
  return [viaje?.tractor, viaje?.semi].filter(Boolean).join(" / ") || "—";
}

export function mensajeTrackingAsignado({ chofer, viaje, trackingUrl }) {
  const nombre = chofer || "chofer";
  return (
    `Hola, ${nombre}. Tenés asignado el viaje *${viaje?.codigo || "—"}*.\n\n` +
    `Origen: ${viaje?.origen || "—"}\n` +
    `Destino: ${viaje?.destino || "—"}\n` +
    `Unidad: ${unidadLabel(viaje)}\n\n` +
    `Abrí el siguiente enlace para iniciar el seguimiento:\n${trackingUrl}\n\n` +
    `_El seguimiento funciona mientras la pantalla permanece activa._`
  );
}

export function mensajeTrackingRecordatorioInicio({ chofer, viaje, trackingUrl }) {
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. Recordatorio: el viaje *${viaje?.codigo || "—"}* ` +
    `todavía no tiene seguimiento activo.\n\n` +
    `Abrí el enlace para confirmar y empezar:\n${trackingUrl}`
  );
}

export function mensajeTrackingInterrumpido({ chofer, viaje, ageMinutes, trackingUrl }) {
  const age =
    ageMinutes != null && Number.isFinite(ageMinutes)
      ? ` (última señal hace ~${Math.max(1, Math.round(ageMinutes))} min)`
      : "";
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. El seguimiento del viaje *${viaje?.codigo || "—"}* ` +
    `se interrumpió${age}.\n\n` +
    `Volvé a la webapp y dejá la pantalla activa:\n${trackingUrl}`
  );
}

export function mensajeTrackingReabrir({ chofer, viaje, trackingUrl }) {
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. Necesitamos que reabras el seguimiento del viaje ` +
    `*${viaje?.codigo || "—"}*.\n\n` +
    `${trackingUrl}`
  );
}

export function mensajeTrackingUbicacionPuntual({ chofer, viaje, trackingUrl }) {
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. ¿Podés compartir una ubicación actualizada del viaje ` +
    `*${viaje?.codigo || "—"}*?\n\n` +
    `Abrí la webapp un momento (con GPS activo):\n${trackingUrl}`
  );
}

export function mensajeTrackingLlegadaProxima({ chofer, viaje }) {
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. Estás cerca del destino del viaje ` +
    `*${viaje?.codigo || "—"}* (${viaje?.destino || "—"}).\n\n` +
    `Cuando llegues, confirmá la llegada en la webapp y completá el POD.`
  );
}

export function mensajeTrackingPodPendiente({ chofer, viaje, trackingUrl }) {
  return (
    `Hola${chofer ? `, ${chofer}` : ""}. El viaje *${viaje?.codigo || "—"}* figura como llegada ` +
    `confirmada, pero falta la *constancia de entrega (POD)*.\n\n` +
    `Completalo acá:\n${trackingUrl}`
  );
}

export function mensajeTrackingCompletado({ chofer, viaje }) {
  return (
    `Listo${chofer ? `, ${chofer}` : ""}. El viaje *${viaje?.codigo || "—"}* quedó ` +
    `*completado* con seguimiento y POD. Gracias.`
  );
}

export function mensajeTrackingIncidenciaEscalada({ chofer, viaje, tipo, codigo }) {
  return (
    `Registramos la incidencia${codigo ? ` *${codigo}*` : ""}${tipo ? ` (${tipo})` : ""} ` +
    `del viaje *${viaje?.codigo || "—"}*.\n` +
    `Operaciones ya fue notificada.` +
    (chofer ? `\n\nChofer: ${chofer}` : "")
  );
}
