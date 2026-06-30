export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function esConfirmacionDestino(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  return /^(si|sí|ok|dale|confirmo|correcto|esta bien|está bien|yes|👍)$/i.test(t);
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
