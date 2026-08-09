export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function esConfirmacionDestino(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  return /^(si|sí|ok|dale|confirmo|correcto|esta bien|está bien|yes|👍)$/i.test(t);
}

/** Extrae la dirección cuando el cliente escribe "no es correcto, mi dirección es..." */
export function extraerDireccionCorreccion(texto) {
  const raw = String(texto ?? "").trim();
  if (!raw) return raw;

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const last = lines.at(-1);
    if (last.length >= 4 && !/^(si|sí|ok|no)$/i.test(last)) return last;
  }

  const patterns = [
    /(?:direcci[oó]n|domicilio)\s*(?:correcta\s*)?es\s*:?\s*(.+)/is,
    /no\s+(?:est[aá]|es)\s+correcto[^:]*:\s*(.+)/is,
    /(?:la\s+correcta\s+es\s*:?\s*)(.+)/is,
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    const part = m?.[1]?.trim().replace(/^[,:\s-]+/, "");
    if (part && part.length >= 4) {
      return part
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
    }
  }

  return raw;
}

export function localidadDesdeDireccion(formattedAddress) {
  if (!formattedAddress) return null;
  const parts = formattedAddress.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[1];
  if (parts.length >= 2) return parts[parts.length - 2];
  return null;
}

export function mensajePropuestaCliente({ formattedAddress, lat, lng, cliente }) {
  const saludo = cliente ? `Hola ${cliente} 👋\n\n` : "Hola 👋\n\n";
  return (
    `${saludo}` +
    `Somos de *tráfico / entregas*. Antes de mandar el chofer necesitamos confirmar el destino.\n\n` +
    `📍 *Dirección propuesta:*\n` +
    `${formattedAddress}\n` +
    `${mapsUrl(lat, lng)}\n\n` +
    `¿Es correcta?\n` +
    `• Respondé *SÍ* para confirmar\n` +
    `• Si no, escribí la dirección correcta o enviá tu *ubicación* 📌`
  );
}

export function mensajeDestinoConfirmadoChofer({ formattedAddress, lat, lng, cliente }) {
  return (
    `✅ *Destino confirmado*` +
    (cliente ? ` — ${cliente}` : "") +
    `\n\n${formattedAddress}\n${mapsUrl(lat, lng)}\n\n` +
    `⏱️ ¿En cuánto estimás *llegar*?\n` +
    `Respondé con un tiempo (ej: *25 min*, *1 hora*).\n\n` +
    `Si tenés *algún retraso* más adelante, avisame por acá y se lo comunicamos al cliente.`
  );
}

export function mensajeClienteDestinoConfirmado({ cliente } = {}) {
  const nombre = cliente ? ` ${cliente}` : "";
  return (
    `Perfecto${nombre} ✅\n\n` +
    `Destino confirmado. Ya le avisamos al chofer.\n` +
    `En cuanto estime la llegada, te mando el *horario aproximado de entrega*.`
  );
}

export function mensajeClienteEstimadoEntrega({ etaTexto, demora = false, actualizacion = false }) {
  if (demora) {
    return (
      `⚠️ El chofer avisó un *retraso*.\n\n` +
      `Nuevo estimado de entrega: *${etaTexto}*.\n` +
      `Gracias por la paciencia.`
    );
  }
  if (actualizacion) {
    return (
      `🚚 *Estimado actualizado*\n\n` +
      `El chofer ahora estima llegar en *${etaTexto}*.`
    );
  }
  return (
    `🚚 *Estimado de entrega*\n\n` +
    `El chofer estima llegar en *${etaTexto}*.\n` +
    `Si hay algún retraso, te avisamos.`
  );
}

export function mensajeAckEtaChofer({ etaTexto, demora = false }) {
  if (demora) {
    return (
      `Listo, le avisamos al cliente el nuevo estimado (*${etaTexto}*).\n` +
      `Si se atrasa de nuevo, escribime.`
    );
  }
  return (
    `Gracias ✅ Le avisamos al cliente: llegada estimada en *${etaTexto}*.\n` +
    `Si tenés algún retraso, comunicamelo por acá.`
  );
}

export function mensajeDestinoActualizadoCliente({ formattedAddress, lat, lng }) {
  return (
    `📍 *Actualicé el destino propuesto:*\n\n` +
    `${formattedAddress}\n` +
    `${mapsUrl(lat, lng)}\n\n` +
    `¿Es correcto ahora? Respondé *SÍ* o corregí de nuevo.`
  );
}

/** Heurística: "30 min", "1 hora", "media hora", "en 45'" */
export function parseEtaHeuristica(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return null;

  if (/media\s*hora|1\/2\s*hora/.test(t)) {
    return { minutos: 30, texto: "30 minutos" };
  }
  const hMin = t.match(/(\d+)\s*h(?:oras?)?\s*(?:y\s*)?(\d+)\s*m/);
  if (hMin) {
    const minutos = Number(hMin[1]) * 60 + Number(hMin[2]);
    return { minutos, texto: formatearEtaMinutos(minutos) };
  }
  const horas = t.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b/);
  if (horas) {
    const minutos = Math.round(parseFloat(horas[1].replace(",", ".")) * 60);
    if (minutos > 0 && minutos <= 24 * 60) return { minutos, texto: formatearEtaMinutos(minutos) };
  }
  const mins = t.match(/(\d+)\s*(?:min(?:utos?)?|m\b|')/);
  if (mins) {
    const minutos = Number(mins[1]);
    if (minutos > 0 && minutos <= 24 * 60) return { minutos, texto: formatearEtaMinutos(minutos) };
  }
  const soloNum = t.match(/^(\d{1,3})$/);
  if (soloNum) {
    const minutos = Number(soloNum[1]);
    if (minutos > 0 && minutos <= 24 * 60) return { minutos, texto: formatearEtaMinutos(minutos) };
  }
  return null;
}

export function formatearEtaMinutos(minutos) {
  const m = Math.round(Number(minutos));
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h} h ${rest} min`;
}

export function pareceDemoraChofer(texto) {
  return /\b(demor|atras|tard|retras|tráfico|trafico|más tarde|mas tarde|se me complic)/i.test(
    String(texto ?? ""),
  );
}
