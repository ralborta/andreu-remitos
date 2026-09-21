import {
  interpretarGastoWhatsApp,
  mensajeConfirmacionGasto,
  mensajePedirFotoComprobante,
  mensajePedirViajeOHoja,
  mensajeRechazoNoComprobante,
  mensajeDuplicadoGasto,
  mensajeViajeAsignado,
  pareceRendicionGasto,
  parseAsignacionViaje,
  aplicarReglaCombustibleCtaCte,
  esComprobanteGastoAceptable,
} from "../../../lib/rendicion-wa.mjs";
import * as rendicionStore from "../db/rendicion-store.mjs";
import * as hojaStore from "../db/hoja-ruta-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";

/** Choferes registrados en Parámetros / maestros. */
export async function telefonoEsChoferRegistrado(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return false;
  return Boolean(await master.resolverChoferPorTelefono(phone));
}

export function mensajeRendicionSoloChoferes() {
  return (
    `La *rendición de gastos* es solo para *choferes registrados*.\n\n` +
    `Si necesitás un *viaje/flete* o abrir un *reclamo*, contame y te ayudo.`
  );
}

async function resolverChoferRendicion(telefono) {
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
    { texto: mensaje, tipo: "text", gasto_id: meta.gasto_id ?? null },
    { dir: "out", from: "bot", agente: "rendicion", nombre: meta.nombre ?? null },
  );
}

/**
 * Activa viaje Delfos para rendición (comando "viaje NNNNN").
 */
export async function asignarViajeRendicionWhatsApp({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  const nro = parseAsignacionViaje(texto);
  if (!phone || !nro) return null;

  const chofer = await resolverChoferRendicion(phone);
  if (!chofer) {
    const msg = mensajeRendicionSoloChoferes();
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_solo_choferes", mensaje: msg, message: msg, bloqueado: true };
  }

  const hoja = await hojaStore.findHojaPorNroViaje({
    telefono: phone,
    nroViajeDelfos: nro,
  });
  await convStore.setEsperandoComprobantesRendicion(phone, true, {
    nroViajeDelfos: nro,
    hojaRutaId: hoja?.id || null,
  });

  const msg = mensajeViajeAsignado(nro);
  await enviar(phone, msg, { nombre });
  log?.info?.(
    { nro, hojaId: hoja?.id || null, foundHoja: Boolean(hoja) },
    "Rendición: viaje Delfos asignado por comando",
  );
  return {
    flow: "rendicion_viaje_asignado",
    nro_viaje_delfos: nro,
    hoja_id: hoja?.id || null,
    mensaje: msg,
    message: msg,
  };
}

/**
 * Procesa mensaje/foto de gasto del chofer → deja pendiente de aprobación.
 */
export async function procesarGastoWhatsApp({
  telefono,
  texto,
  nombre,
  imageBuffer,
  mime,
  imagenUrl,
  log,
  forzar = false,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone) return null;
  if (!forzar && !imageBuffer && !pareceRendicionGasto(t)) return null;

  // Clientes / números no registrados: NUNCA crear gasto ni pedir comprobante de rendición.
  const chofer = await resolverChoferRendicion(phone);
  if (!chofer) {
    log?.info?.({ phone }, "Rendición bloqueada: teléfono no es chofer registrado");
    const msg = mensajeRendicionSoloChoferes();
    await enviar(phone, msg, { nombre });
    return {
      flow: "rendicion_solo_choferes",
      mensaje: msg,
      message: msg,
      bloqueado: true,
    };
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
        texto: t || "[Comprobante de gasto]",
        tipo: imageBuffer || imagenPersistida ? "image" : "text",
        imagen_url: imagenPersistida,
      },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  // Sin foto del comprobante NO se registra el gasto (aunque diga "peaje"/"nafta").
  // Bug real: "ahora tengo un peaje para rendir" → pendiente de aprobación sin pedir foto.
  const tieneFoto = !!(imageBuffer?.length || imagenPersistida);
  if (!tieneFoto) {
    await convStore.setEsperandoComprobantesRendicion(phone, true);
    const msg = mensajePedirFotoComprobante(t);
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_pedir_foto", mensaje: msg, message: msg };
  }

  let ocrTexto = null;
  if (imageBuffer?.length) {
    try {
      const { ocrDocumento } = await import("../../../lib/document-ai.mjs");
      const ocr = await ocrDocumento(imageBuffer, "gasto.jpg");
      ocrTexto = String(ocr?.texto || "").trim() || null;
      log?.info?.(
        { chars: ocrTexto?.length || 0, processor: ocr?.processor_id },
        "Rendición Document AI OCR",
      );
    } catch (err) {
      log?.warn?.({ err: err.message }, "Rendición Document AI falló");
    }
  }

  let interp = await interpretarGastoWhatsApp({
    texto: t,
    imageBuffer,
    mime,
    ocrTexto,
    log,
  });
  interp = aplicarReglaCombustibleCtaCte(interp, t);

  if (!esComprobanteGastoAceptable({ ocrTexto, interp })) {
    const msg = mensajeRechazoNoComprobante();
    await enviar(phone, msg, { nombre });
    log?.info?.(
      { categoria: interp.categoria, chars: ocrTexto?.length || 0 },
      "Rendición: foto rechazada (no parece comprobante)",
    );
    return { flow: "rendicion_rechazo_no_comprobante", mensaje: msg, message: msg };
  }

  // Nº viaje SOLO de la hoja/sesión activa (hasta "listo").
  // NO reenganchar la última hoja sola — eso rompía el cierre LISTO.
  const conv = await convStore.getConversacion(phone);
  const nroViaje = convStore.nroViajeDelfosActivo(conv);
  const hojaId = conv?.hoja_ruta_activa_id || null;
  if (!nroViaje) {
    const msg = mensajePedirViajeOHoja();
    await enviar(phone, msg, { nombre });
    log?.info?.({ phone }, "Rendición: sin viaje activo tras LISTO / sin hoja");
    return { flow: "rendicion_pedir_viaje", mensaje: msg, message: msg };
  }

  const dup = await rendicionStore.buscarDuplicadoGasto({
    telefono: phone,
    nro_viaje_delfos: nroViaje,
    nro_t: interp.nro_t,
    cuit_proveedor: interp.cuit_proveedor,
    monto: interp.monto,
    fecha_comprobante: interp.fecha_comprobante,
    proveedor: interp.proveedor,
  });
  if (dup) {
    const msg = mensajeDuplicadoGasto(dup);
    await enviar(phone, msg, { nombre, gasto_id: dup.id });
    log?.info?.(
      { dup: dup.codigo, nro_t: interp.nro_t, monto: interp.monto },
      "Rendición: comprobante duplicado bloqueado",
    );
    return {
      flow: "rendicion_duplicado",
      gasto: dup,
      mensaje: msg,
      message: msg,
    };
  }

  // Seguir aceptando más boletas de a una (solo con viaje activo)
  await convStore.setEsperandoComprobantesRendicion(phone, true, {
    nroViajeDelfos: nroViaje,
    hojaRutaId: hojaId,
  });

  const notaParts = [
    t || null,
    interp.combustible_cta_cte ? "cta_cte" : null,
    interp.pago_chofer ? "pago_chofer" : null,
  ].filter(Boolean);

  const gasto = await rendicionStore.crearGasto({
    telefono: phone,
    chofer_nombre: nombre || chofer?.nombre || null,
    categoria: interp.categoria,
    monto: interp.monto,
    proveedor: interp.proveedor,
    fecha_comprobante: interp.fecha_comprobante,
    descripcion: interp.descripcion,
    punto_venta: interp.punto_venta,
    nro_t: interp.nro_t,
    iva_pct: interp.iva_pct,
    rae: interp.rae,
    monto_rae: interp.monto_rae,
    cuit_proveedor: interp.cuit_proveedor,
    viaje_documento: interp.viaje_documento,
    nro_viaje_delfos: nroViaje,
    remito_ref: hojaId ? `hoja:${hojaId}` : null,
    nota_chofer: notaParts.length ? notaParts.join(" · ") : null,
    texto_ocr: ocrTexto || interp.texto_ocr || null,
    imagen_url: imagenPersistida || null,
    estado: "pendiente_aprobacion",
  });

  const mensaje = mensajeConfirmacionGasto(gasto, interp);
  await enviar(phone, mensaje, { nombre, gasto_id: gasto.id });

  log?.info?.(
    {
      id: gasto.id,
      codigo: gasto.codigo,
      categoria: gasto.categoria,
      monto: gasto.monto,
      nro_viaje_delfos: nroViaje,
      fuente: interp.fuente,
      combustible_cta_cte: Boolean(interp.combustible_cta_cte),
    },
    "Rendición: gasto pendiente aprobación",
  );

  return {
    flow: "rendicion_pendiente",
    gasto,
    mensaje,
    message: mensaje,
  };
}
