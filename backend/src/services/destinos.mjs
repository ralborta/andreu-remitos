import { sendWhatsAppMessage, setBuilderBotBlacklist } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  geocodeAddress,
  parseCoordInput,
  placeDetails,
  reverseGeocode,
} from "../../../lib/geocoding.mjs";
import {
  extraerDireccionCorreccion,
  localidadDesdeDireccion,
  mensajeAckEtaChofer,
  mensajeClienteDestinoConfirmado,
  mensajeClienteEstimadoEntrega,
  mensajeDestinoActualizadoCliente,
  mensajeDestinoConfirmadoChofer,
  mensajePropuestaCliente,
} from "../../../lib/destinos.mjs";
import {
  interpretarRespuestaChoferEta,
  interpretarRespuestaDestinoCliente,
} from "../../../lib/destinos-ia.mjs";
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

async function geocodeCorreccion(texto, pending) {
  const extraida = extraerDireccionCorreccion(texto);
  const intentos = [extraida];
  const loc = localidadDesdeDireccion(pending?.formatted_address);
  if (loc && extraida && !extraida.includes(",")) {
    intentos.push(`${extraida}, ${loc}`);
  }
  if (texto.trim() !== extraida) intentos.push(texto.trim());

  let lastErr = null;
  for (const q of [...new Set(intentos.filter(Boolean))]) {
    try {
      return { geo: await geocodeAddress(q), queryUsada: q };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`No encontré la dirección "${extraida}"`);
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
  if (!telefonoChofer) {
    throw new Error("Falta teléfono del chofer — al confirmar se le envía el destino");
  }

  const geo = await geocodeInput({ query, mode, placeId: body.placeId });
  const mensaje = mensajePropuestaCliente({
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    cliente,
  });

  // No blacklist: Destinos se atiende primero en el webhook. Blacklistear al cliente
  // hacía que WhatsApp llegara al bot pero nunca a la API (sin respuesta del "agente").

  const destino = await destinosStore.crearDestinoPendiente({
    cliente,
    telefono_cliente: telefonoCliente,
    telefono_chofer: telefonoChofer,
    input_raw: query,
    formatted_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    place_id: geo.placeId ?? null,
    partial: geo.partial ?? false,
    historial: [`Geocode: ${geo.formattedAddress}`, "WhatsApp enviado al cliente"],
  });

  await destinosStore.cancelarPendientesPorTelefono(telefonoCliente, destino.id);

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
      ultima_respuesta_cliente: "📌 Ubicación WhatsApp",
      historial: [...historial, "Re-enviado al cliente"],
    });
    await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
    return { flow: "destinos_correccion_ubicacion", destino: updated, mensaje };
  }

  const t = String(texto ?? "").trim();
  const parsed = await interpretarRespuestaDestinoCliente(t, { pending, log });

  if (parsed.intent === "pedir_direccion" || parsed.intent === "chat") {
    const mensaje =
      parsed.mensaje ||
      `Para confirmar el destino necesito la dirección correcta (calle, número y localidad) o tu ubicación 📌`;
    historial.push(
      parsed.intent === "chat"
        ? `Cliente preguntó/charló: "${t}"`
        : `Cliente rechazó sin dirección: "${t}"`,
      `Agente (${parsed.fuente}): pidió dirección / respondió`,
    );
    const updated = await destinosStore.actualizarDestino(pending.id, {
      ultima_respuesta_cliente: t || null,
      historial,
    });
    await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
    return {
      flow: parsed.intent === "chat" ? "destinos_chat" : "destinos_pedir_direccion",
      destino: updated,
      mensaje,
    };
  }

  if (parsed.intent === "confirm") {
    historial.push("Cliente: SÍ → confirmado");

    // Limpieza por si quedó blacklist vieja de versiones anteriores
    try {
      await setBuilderBotBlacklist(phone, "remove");
    } catch (err) {
      log?.warn?.({ err: err.message }, "Blacklist remove falló");
    }

    const mensajeCliente = mensajeClienteDestinoConfirmado({ cliente: pending.cliente });
    await enviarWhatsApp(phone, mensajeCliente, { destino_id: pending.id, from: "bot" });
    historial.push("WhatsApp confirmación al cliente");

    let mensajeChofer = null;
    if (pending.telefono_chofer) {
      mensajeChofer = mensajeDestinoConfirmadoChofer({
        formattedAddress: pending.formatted_address,
        lat: pending.lat,
        lng: pending.lng,
        cliente: pending.cliente,
      });
      await enviarWhatsApp(pending.telefono_chofer, mensajeChofer, {
        destino_id: pending.id,
        from: "bot",
      });
      historial.push("WhatsApp al chofer: destino + pedido de ETA");
    }

    const updated = await destinosStore.actualizarDestino(pending.id, {
      estado: pending.telefono_chofer ? "esperando_eta_chofer" : "confirmado",
      ultima_respuesta_cliente: t,
      historial,
    });

    return {
      flow: "destinos_confirmado",
      destino: updated,
      mensaje: mensajeCliente,
      mensaje_chofer: mensajeChofer,
    };
  }

  // correccion (con dirección usable)
  const textoGeo = parsed.direccion || t;
  const { geo, queryUsada } = await geocodeCorreccion(textoGeo, pending);
  historial.push(
    `Cliente corrige: "${t}"`,
    `Dirección usada: "${queryUsada}"`,
    `Re-geocode: ${geo.formattedAddress}`,
  );
  const mensaje = mensajeDestinoActualizadoCliente({
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
  });
  const updated = await destinosStore.actualizarDestino(pending.id, {
    input_raw: queryUsada,
    formatted_address: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
    place_id: geo.placeId,
    partial: geo.partial ?? false,
    correccion: t,
    ultima_respuesta_cliente: t,
    historial: [...historial, "Re-enviado al cliente"],
  });
  await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
  return { flow: "destinos_correccion_texto", destino: updated, mensaje };
}

/**
 * Respuesta del chofer: ETA de llegada o demora → avisa al cliente.
 */
export async function procesarRespuestaDestinoChofer(telefono, { texto, nombre, log } = {}) {
  const pending = await destinosStore.getDestinoActivoPorChofer(telefono);
  if (!pending) return null;

  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  const historial = [...(pending.historial ?? [])];

  if (phone && t) {
    await convStore.appendMensaje(
      phone,
      { texto: t, tipo: "text", destino_id: pending.id },
      { dir: "in", from: "chofer", nombre },
    );
  }

  const parsed = await interpretarRespuestaChoferEta(t, { pending, log });

  if (parsed.intent === "pedir_eta" || parsed.intent === "chat") {
    const mensaje =
      parsed.mensaje ||
      `¿En cuánto estimás llegar? (ej: *25 min*). Si hay retraso, avisame.`;
    historial.push(`Chofer: "${t}"`, `Agente (${parsed.fuente}): pidió ETA`);
    const updated = await destinosStore.actualizarDestino(pending.id, {
      ultima_respuesta_chofer: t || null,
      historial,
    });
    await enviarWhatsApp(phone, mensaje, { destino_id: pending.id, from: "bot" });
    return { flow: "destinos_pedir_eta_chofer", destino: updated, mensaje };
  }

  const demora = parsed.intent === "demora";
  const actualizacion = !demora && pending.estado === "en_ruta";
  const etaTexto = parsed.etaTexto;
  historial.push(
    demora
      ? `Chofer demora: ${etaTexto} ("${t}")`
      : actualizacion
        ? `Chofer actualiza ETA: ${etaTexto} ("${t}")`
        : `Chofer ETA: ${etaTexto} ("${t}")`,
  );

  const mensajeCliente = mensajeClienteEstimadoEntrega({ etaTexto, demora, actualizacion });
  if (pending.telefono_cliente) {
    await enviarWhatsApp(pending.telefono_cliente, mensajeCliente, {
      destino_id: pending.id,
      from: "bot",
      nombre: pending.cliente,
    });
    historial.push(demora ? "Estimado actualizado → cliente" : "Estimado de entrega → cliente");
  }

  const mensajeChofer = mensajeAckEtaChofer({ etaTexto, demora });
  await enviarWhatsApp(phone, mensajeChofer, { destino_id: pending.id, from: "bot" });
  historial.push("Ack ETA al chofer");

  const updated = await destinosStore.actualizarDestino(pending.id, {
    estado: "en_ruta",
    eta_minutos: parsed.minutos,
    eta_texto: etaTexto,
    eta_at: new Date().toISOString(),
    ultima_respuesta_chofer: t,
    historial,
  });

  // Demora en ruta → también queda como incidencia (trazabilidad operaciones)
  if (demora) {
    try {
      const { registrarDemoraDesdeDestinos } = await import("./incidencias-agent.mjs");
      await registrarDemoraDesdeDestinos({
        telefono: phone,
        nombre: nombre || pending.chofer_nombre || null,
        causa: t,
        viaje_ref: pending.viaje_ref || pending.remito_ref || null,
        destino_id: pending.id,
        eta_texto: etaTexto,
        log,
      });
    } catch (err) {
      log?.warn?.({ err: err.message }, "No pude crear incidencia desde demora Destinos");
    }
  }

  return {
    flow: demora ? "destinos_demora_chofer" : "destinos_eta_chofer",
    destino: updated,
    mensaje: mensajeChofer,
    mensaje_cliente: mensajeCliente,
  };
}

export { geocodeInput };
