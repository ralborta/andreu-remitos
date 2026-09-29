/**
 * Agente WA — hoja de ruta (Andreu).
 */
import {
  hojaRutaHabilitada,
  interpretarHojaRuta,
  interpretarRespuestaNumeroHoja,
  mensajeConfirmacionHojaRuta,
  mensajeConfirmarNumeroHoja,
  mensajePedirFotoHojaRuta,
  mensajePedirNumeroHoja,
  pareceDocumentoHojaRuta,
  pareceHojaRuta,
} from "../../../lib/hoja-ruta.mjs";
import * as hojaStore from "../db/hoja-ruta-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";
import {
  mensajeRendicionSoloChoferes,
  telefonoEsChoferRegistrado,
} from "./rendicion-agent.mjs";

export { pareceHojaRuta, pareceDocumentoHojaRuta, hojaRutaHabilitada };

async function resolverChofer(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  return master.resolverChoferPorTelefono(phone);
}

async function enviar(phone, mensaje, meta = {}) {
  const p = sanitizePhone(phone);
  if (!p || !mensaje?.trim()) return;
  await sendWhatsAppMessage({ number: p, message: mensaje });
  await convStore.appendMensaje(
    p,
    { texto: mensaje, tipo: "text", hoja_ruta_id: meta.hoja_id ?? null },
    { dir: "out", from: "bot", agente: "rendicion", nombre: meta.nombre ?? null },
  );
}

/**
 * Procesa mensaje/foto de hoja de ruta → deja expediente para mesa.
 */
export async function procesarHojaRutaWhatsApp({
  telefono,
  texto,
  nombre,
  imageBuffer,
  mime,
  imagenUrl,
  log,
  forzar = false,
} = {}) {
  if (!hojaRutaHabilitada()) return null;

  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone) return null;
  if (!forzar && !imageBuffer && !pareceHojaRuta(t)) return null;

  if (!(await telefonoEsChoferRegistrado(phone))) {
    const msg = mensajeRendicionSoloChoferes();
    await enviar(phone, msg, { nombre });
    return { flow: "hoja_ruta_solo_choferes", mensaje: msg, message: msg, bloqueado: true };
  }

  let imagenPersistida = imagenUrl || null;
  if (imageBuffer?.length) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    if (saved?.publicUrl) imagenPersistida = saved.publicUrl;
  }

  if (t || imagenPersistida || imageBuffer) {
    await convStore.appendMensaje(
      phone,
      {
        texto: t || "[Hoja de ruta]",
        tipo: imageBuffer || imagenPersistida ? "image" : "text",
        imagen_url: imagenPersistida,
      },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  const tieneFoto = !!(imageBuffer?.length || imagenPersistida);
  if (!tieneFoto) {
    await convStore.setEsperandoHojaRuta(phone, true);
    const msg = mensajePedirFotoHojaRuta();
    await enviar(phone, msg, { nombre });
    return { flow: "hoja_ruta_pedir_foto", mensaje: msg, message: msg };
  }

  await convStore.clearEsperandoHojaRuta(phone);

  let ocrTexto = null;
  if (imageBuffer?.length) {
    try {
      const { ocrDocumento } = await import("../../../lib/document-ai.mjs");
      const ocr = await ocrDocumento(imageBuffer, "hoja-ruta.jpg");
      ocrTexto = String(ocr?.texto || "").trim() || null;
      log?.info?.({ chars: ocrTexto?.length || 0 }, "Hoja de ruta Document AI OCR");
    } catch (err) {
      log?.warn?.({ err: err.message }, "Hoja de ruta Document AI falló");
    }
  }

  const chofer = await resolverChofer(phone);
  const interp = await interpretarHojaRuta({
    texto: t,
    imageBuffer,
    mime,
    ocrTexto,
    log,
  });

  const detectado = interp.nro_viaje_delfos || null;
  const row = await hojaStore.crearHojaRuta({
    telefono: phone,
    chofer_nombre: interp.chofer_nombre || chofer?.nombre || nombre || null,
    nro_viaje_delfos: null,
    patente: interp.patente,
    patente_semi: interp.patente_semi,
    fecha_salida: interp.fecha_salida,
    fecha_llegada: interp.fecha_llegada,
    anticipo_monto: interp.anticipo_monto,
    peajes: interp.peajes,
    imagen_url: imagenPersistida,
    texto_ocr: ocrTexto || interp.texto_ocr || null,
    nota_chofer: t || null,
    confianza: interp.confianza,
    fuente: interp.fuente,
    estado: "esperando_confirmacion",
    nro_viaje_confirmado_chofer: false,
  });

  await convStore.setHojaNumeroPendiente(phone, {
    hoja_id: row.id,
    fase: detectado ? "confirmar" : "escribir",
    detectado,
  });

  const mensaje = mensajeConfirmarNumeroHoja(detectado);
  await enviar(phone, mensaje, { nombre, hoja_id: row.id });

  log?.info?.(
    { id: row.id, codigo: row.codigo, detectado, anticipo: row.anticipo_monto },
    "Hoja de ruta espera confirmación del número de viaje",
  );

  return {
    flow: detectado ? "hoja_ruta_confirmar_viaje" : "hoja_ruta_pedir_viaje",
    hoja: row,
    mensaje,
    message: mensaje,
  };
}

/**
 * El chofer confirma, corrige o dicta el número impreso en la hoja.
 * Recién ahí los tickets heredan ese número. La mesa sigue confirmando el Delfos.
 */
export async function continuarConfirmacionNumeroHoja({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  const pendiente = phone ? await convStore.getHojaNumeroPendiente(phone) : null;
  if (!phone || !pendiente?.hoja_id) return null;

  const t = String(texto ?? "").trim();
  if (t) {
    await convStore.appendMensaje(
      phone,
      { texto: t, tipo: "text", hoja_ruta_id: pendiente.hoja_id },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  const resp = interpretarRespuestaNumeroHoja(t, pendiente.fase || "confirmar");
  if (resp.accion === "pedir") {
    await convStore.setHojaNumeroPendiente(phone, { ...pendiente, fase: "escribir" });
    const mensaje = mensajePedirNumeroHoja();
    await enviar(phone, mensaje, { nombre, hoja_id: pendiente.hoja_id });
    return { flow: "hoja_ruta_corregir_viaje", mensaje, message: mensaje };
  }

  if (resp.accion === "repedir" || resp.accion === "repreguntar") {
    const mensaje =
      pendiente.fase === "escribir" || !pendiente.detectado
        ? mensajeConfirmarNumeroHoja(null)
        : mensajeConfirmarNumeroHoja(pendiente.detectado);
    await enviar(phone, mensaje, { nombre, hoja_id: pendiente.hoja_id });
    return { flow: "hoja_ruta_repreguntar_viaje", mensaje, message: mensaje };
  }

  const numero = resp.accion === "guardar" ? resp.numero : pendiente.detectado;
  if (!numero) {
    const mensaje = mensajeConfirmarNumeroHoja(null);
    await convStore.setHojaNumeroPendiente(phone, { ...pendiente, fase: "escribir" });
    await enviar(phone, mensaje, { nombre, hoja_id: pendiente.hoja_id });
    return { flow: "hoja_ruta_pedir_viaje", mensaje, message: mensaje };
  }

  const hoja = await hojaStore.actualizarHojaRuta(pendiente.hoja_id, {
    nro_viaje_delfos: numero,
    nro_viaje_confirmado_chofer: true,
    estado: "pendiente_revision",
    historial_push: `${new Date().toISOString()} · Chofer confirmó nº de viaje de la hoja: ${numero}`,
  });
  await convStore.setHojaNumeroPendiente(phone, null);
  await convStore.setEsperandoComprobantesRendicion(phone, true, {
    nroViajeDelfos: numero,
    hojaRutaId: pendiente.hoja_id,
  });
  const mensaje = mensajeConfirmacionHojaRuta(hoja || { codigo: pendiente.hoja_id, nro_viaje_delfos: numero });
  await enviar(phone, mensaje, { nombre, hoja_id: pendiente.hoja_id });
  log?.info?.({ id: pendiente.hoja_id, numero }, "Hoja de ruta: número confirmado por el chofer");
  return {
    flow: "hoja_ruta_viaje_confirmado",
    hoja,
    mensaje,
    message: mensaje,
  };
}
