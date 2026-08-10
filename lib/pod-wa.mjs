/**
 * Mensajes y heurísticas WhatsApp — agente POD.
 */

export function parecePod(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return false;
  // Evitar confundir con remito / rendición
  if (/\b(remito|gu[ií]a|nafta|peaje|rendici[oó]n|gasto|ticket|factura)\b/i.test(t)) {
    return false;
  }
  return /\b(pod|constancia|entregu[eé]|entregue|entregado|entrega\s+ok|recib[ií]\s*conforme|firma\s+de\s+entrega|prueba\s+de\s+entrega|dej[eé]\s+la\s+carga|descargu[eé])\b/i.test(
    t,
  );
}

export function mensajePodSoloChoferes() {
  return (
    `La *constancia de entrega (POD)* es solo para *choferes registrados*.\n\n` +
    `Si necesitás un *viaje/flete* o un *reclamo*, contame y te ayudo.`
  );
}

export function mensajePedirNombreReceptor() {
  return (
    `Perfecto, vamos con la *constancia de entrega (POD)*.\n\n` +
    `¿*A quién* le entregaste? (nombre de la persona que recibió)`
  );
}

export function mensajePedirFotoPod(receptor) {
  const quien = receptor ? ` a *${receptor}*` : "";
  return (
    `Listo${quien ? `, entrega${quien}` : ""}.\n\n` +
    `Ahora mandame una *foto de la prueba* (mercadería entregada, sello, firma o remito firmado).`
  );
}

export function mensajeConfirmacionPod(caso) {
  return (
    `✅ *POD ${caso.codigo || caso.id}* registrado.\n\n` +
    `Receptor: *${caso.receptor_nombre || "—"}*\n` +
    `Queda *pendiente* de confirmación en mesa de control.\n` +
    `Si necesitás corregir algo, avisame.`
  );
}

export function mensajeDecisionPod(caso) {
  if (caso.estado === "ok") {
    return (
      `✅ Tu *POD ${caso.codigo || caso.id}* fue *confirmado*.\n` +
      (caso.nota_backoffice ? `Nota: ${caso.nota_backoffice}` : "")
    );
  }
  return (
    `❌ Tu *POD ${caso.codigo || caso.id}* fue *rechazado*.\n` +
    (caso.nota_backoffice
      ? `Motivo: ${caso.nota_backoffice}\n`
      : "") +
    `Si querés, enviá de nuevo receptor + foto.`
  );
}

/** Extrae un nombre razonable del texto del chofer. */
export function extraerNombreReceptor(texto) {
  let t = String(texto ?? "").trim();
  if (!t) return null;
  t = t
    .replace(
      /^(entregu[eé]|entregue|entregado|a|al|la|el|se\s+lo\s+di|recib[ií][oó]?|receptor|nombre)\s*[:\-]?\s*/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 2 || t.length > 80) return null;
  if (/^\d+$/.test(t)) return null;
  if (parecePod(t) && t.split(/\s+/).length <= 2) return null;
  return t;
}
