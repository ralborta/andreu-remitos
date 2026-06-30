import { sendWhatsAppMessage, setBuilderBotBlacklist } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  geocodeAddress,
  parseCoordInput,
  placeDetails,
  reverseGeocode,
} from "../../../lib/geocoding.mjs";
import {
  esConfirmacionDestino,
  mensajeDestinoActualizadoCliente,
  mensajeDestinoConfirmadoChofer,
  mensajePropuestaCliente,
} from "../../../lib/destinos.mjs";
import * as destinosStore from "../db/destinos-store.mjs";
import * as convStore from "../db/conversations-store.mjs";

async function geocodeInput({ query, mode, placeId }) {
  if (mode === "coordenadas") {
    const coords = parseCoordInput(query);
    if (!coords) throw new Error("Coordenadas inválidas (usá lat, lng)");
    return reverseGeocode(coords.lat, coords.lng);
  }
  if (placeId) return placeDetails(placeId);
  return geocodeAddress(query);
}

async function enviarWhatsApp(numero, mensaje, meta = {}) {
  const phone = sanitizePhone(numero);
  if (!phone) throw new Error("Teléfono inválido");
  await sendWhatsAppMessage({ number: phone, message: mensaje });
  await convStore.appendMensaje(
    phone,
    { texto: mensaje, tipo: "text", destino_id: meta.destino_id ?? null },
    {
      tenant: meta.tenant ?? null,
      dir: "out",
      from: meta.from ?? "bot",
      nombre: meta.nombre ?? null,
    },
  );
  return phone;
}

export async function iniciarValidacionDestino(body, { log } = {}) {
  const query = String(body.query ?? "").trim();
  const mode = body.mode === "coordenadas" ? "coordenadas" : "direccion";
  const telefonoCliente = sanitizePhone(body.telefonoCliente ?? body.telefono_cliente);
  const telefonoChofer = sanitizePhone(body.telefonoChofer ?? body.telefono_chofer);
  const cliente = String(body.cliente ?? "").trim() || null;

  if (!query) throw new Error("Falta query");
  if (!telefonoCliente) throw new Error("Falta teléfono del cliente");

  const geo = await geocodeInput({ query, mode, placeId: body.placeId });
  const mensaje = mensajePropuestaCliente({
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    cliente,
  });

  try {
    await setBuilderBotBlacklist(telefonoCliente, "add");
  } catch (err) {
    log?.warn?.({ err: err.message }, "Blacklist cliente opcional falló");
  }

  const destino = await destinosStore.crearDestinoPendiente({
    cliente,
    telefono_cliente: telefonoCliente,
    telefono_chofer: telefonoChofer || null,
    input_raw: query,
    formatted_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    place_id: geo.placeId ?? null,
    partial: geo.partial ?? false,
    historial: [`Geocode: ${geo.formattedAddress}`, "WhatsApp enviado al cliente"],
  });

  await enviarWhatsApp(telefonoCliente, mensaje, {
    destino_id: destino.id,
    from: "bot",
    nombre: cliente,
  });

  return { ...destino, whatsapp_sent: true, mensaje_cliente: mensaje };
}

export async function procesarRespuestaDestinoCliente(telefono, { texto, lat, lng, nombre, log } = {}) {
  const pending = await destinosStore.getDestinoPendientePorTelefono(telefono);
  if (!pending) return null;

  const phone = sanitizePhone(telefono);
  const historial = [...(pending.historial ?? [])];

  if (phone && (texto || lat != null)) {
    await convStore.appendMensaje(
      phone,
      {
        texto: lat != null ? `[Ubicación ${lat}, ${lng}]` : texto,
        tipo: lat != null ? "location" : "text",
        destino_id: pending.id,
      },
      { dir: "in", from: "client", nombre },
    );
  }

  if (lat != null && lng != null) {
    const geo = await reverseGeocode(lat, lng);
    historial.push(`Cliente envió ubicación → ${geo.formattedAddress}`);
    const mensaje = mensajeDestinoActualizadoCliente({
      formattedAddress: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
    });
    const updated = await destinosStore.actualizarDestino(pending.id, {
      formatted_address: geo.formattedAddress,
      lat: geo.lat,
      lng: geo.lng,
      place_id: geo.placeId,
      partial: geo.partial ?? false,
      correccion: "ubicación WhatsApp",
      historial: [...historial, "Re-enviado al cliente"],
    });
    await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
    return { flow: "destinos_correccion_ubicacion", destino: updated, mensaje };
  }

  const t = String(texto ?? "").trim();
  if (!t) return { flow: "destinos_sin_contenido", destino: pending };

  if (esConfirmacionDestino(t)) {
    historial.push("Cliente: SÍ → confirmado");
    const updated = await destinosStore.actualizarDestino(pending.id, {
      estado: "confirmado",
      historial,
    });

    try {
      await setBuilderBotBlacklist(phone, "remove");
    } catch (err) {
      log?.warn?.({ err: err.message }, "Blacklist remove falló");
    }

    let mensajeChofer = null;
    if (updated.telefono_chofer) {
      mensajeChofer = mensajeDestinoConfirmadoChofer({
        formattedAddress: updated.formatted_address,
        lat: updated.lat,
        lng: updated.lng,
        cliente: updated.cliente,
      });
      await enviarWhatsApp(updated.telefono_chofer, mensajeChofer, {
        destino_id: updated.id,
        from: "bot",
      });
      historial.push("WhatsApp enviado al chofer");
      await destinosStore.actualizarDestino(updated.id, { historial });
    }

    return { flow: "destinos_confirmado", destino: updated, mensaje_chofer: mensajeChofer };
  }

  const geo = await geocodeAddress(t);
  historial.push(`Cliente corrige: "${t}"`, `Re-geocode: ${geo.formattedAddress}`);
  const mensaje = mensajeDestinoActualizadoCliente({
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
  });
  const updated = await destinosStore.actualizarDestino(pending.id, {
    input_raw: t,
    formatted_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    place_id: geo.placeId,
    partial: geo.partial ?? false,
    correccion: t,
    historial: [...historial, "Re-enviado al cliente"],
  });
  await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
  return { flow: "destinos_correccion_texto", destino: updated, mensaje };
}

export { geocodeInput };
