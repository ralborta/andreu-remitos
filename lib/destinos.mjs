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
  if (parts.length < 2) return null;
  return parts.slice(-2).join(", ");
}

export function mensajePropuestaCliente({ formattedAddress, lat, lng, cliente }) {
  const saludo = cliente ? `Hola ${cliente} 👋\n\n` : "";
  return (
    `${saludo}📍 *Destino propuesto para entrega:*\n\n` +
    `${formattedAddress}\n` +
    `${mapsUrl(lat, lng)}\n\n` +
    `¿Es correcto?\n` +
    `Respondé *SÍ* para confirmar.\n` +
    `Si no, escribí la dirección corregida o enviá tu *ubicación* por WhatsApp 📌`
  );
}

export function mensajeDestinoConfirmadoChofer({ formattedAddress, lat, lng, cliente }) {
  return (
    `✅ *Destino confirmado*` +
    (cliente ? ` — ${cliente}` : "") +
    `\n\n${formattedAddress}\n${mapsUrl(lat, lng)}`
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
