import {
  interpretarGastoWhatsApp,
  interpretarRespuestaViajeHoja,
  mensajeConfirmarViajeHoja,
  mensajeConfirmacionGasto,
  mensajePedirFotoComprobante,
  mensajePedirNumeroViajeHoja,
  mensajeViajeHojaConfirmado,
  pareceHojaRuta,
  pareceRendicionGasto,
} from "../../../lib/rendicion-wa.mjs";
import * as rendicionStore from "../db/rendicion-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { getChoferViajesPorTelefono } from "../db/viajes-flota-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";
import { findChoferPorNombre } from "../../../lib/maestros-match.mjs";

function esAdministracion(chofer) {
  return String(chofer?.observacion || "").toUpperCase() === "ADMINISTRACION";
}

/** Encargados / supervisores en Parámetros → Choferes → tipo Administración. */
export async function telefonoEsEncargadoRendicion(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return false;
  const row = await master.resolverChoferPorTelefono(phone);
  return Boolean(row && esAdministracion(row));
}

/** Choferes de Parámetros/Remitos o flota Gestión de Viajes (no Administración). */
export async function telefonoEsChoferRegistrado(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return false;
  const row = await master.resolverChoferPorTelefono(phone);
  if (row && esAdministracion(row)) return false;
  if (row) return true;
  return Boolean(getChoferViajesPorTelefono(phone));
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
  const remitos = await master.resolverChoferPorTelefono(phone);
  if (remitos && esAdministracion(remitos)) return null;
  if (remitos) return remitos;
  const flota = getChoferViajesPorTelefono(phone);
  if (flota) {
    return { nombre: flota.nombre || null, telefono: flota.telefono || phone };
  }
  return null;
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
  if (!forzar && !imageBuffer && !pareceRendicionGasto(t) && !pareceHojaRuta(t)) return null;

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

  const interp = await interpretarGastoWhatsApp({
    texto: t,
    imageBuffer,
    mime,
    ocrTexto,
    log,
  });

  const esHoja = pareceHojaRuta(t) || Boolean(interp.es_hoja_ruta);
  if (esHoja) {
    const detectado = interp.viaje_documento || null;
    const gasto = await rendicionStore.crearGasto({
      telefono: phone,
      chofer_nombre: nombre || chofer.nombre || null,
      categoria: "otro",
      monto: null,
      descripcion: interp.descripcion || "Hoja de ruta",
      viaje_documento: detectado,
      viaje_documento_confirmado_chofer: false,
      nota_chofer: t || null,
      texto_ocr: ocrTexto || interp.texto_ocr || null,
      imagen_url: imagenPersistida || null,
      estado: "borrador",
    });
    await convStore.setRendicionViajePendiente(phone, {
      gasto_id: gasto.id,
      fase: detectado ? "confirmar" : "escribir",
      detectado,
    });
    const mensaje = mensajeConfirmarViajeHoja(detectado);
    await enviar(phone, mensaje, { nombre, gasto_id: gasto.id });
    log?.info?.(
      { id: gasto.id, codigo: gasto.codigo, detectado },
      "Rendición: hoja de ruta espera confirmación de viaje",
    );
    return {
      flow: detectado ? "rendicion_confirmar_viaje" : "rendicion_pedir_viaje",
      gasto,
      mensaje,
      message: mensaje,
    };
  }

  const gasto = await rendicionStore.crearGasto({
    telefono: phone,
    chofer_nombre: nombre || null,
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
    nota_chofer: t || null,
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
      fuente: interp.fuente,
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

/**
 * Siguiente mensaje del chofer: confirma, corrige o dicta el nº de la hoja de ruta.
 * No toca el nº Delfos: eso lo confirma la mesa al aprobar.
 */
export async function continuarConfirmacionViajeHoja({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  const pendiente = phone ? await convStore.getRendicionViajePendiente(phone) : null;
  if (!phone || !pendiente?.gasto_id) return null;

  const t = String(texto ?? "").trim();
  if (t) {
    await convStore.appendMensaje(
      phone,
      { texto: t, tipo: "text", gasto_id: pendiente.gasto_id },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  const resp = interpretarRespuestaViajeHoja(t, pendiente.fase || "confirmar");
  if (resp.accion === "pedir") {
    await convStore.setRendicionViajePendiente(phone, {
      ...pendiente,
      fase: "escribir",
    });
    const mensaje = mensajePedirNumeroViajeHoja();
    await enviar(phone, mensaje, { nombre, gasto_id: pendiente.gasto_id });
    return { flow: "rendicion_corregir_viaje", mensaje, message: mensaje };
  }

  if (resp.accion === "repedir" || resp.accion === "repreguntar") {
    const mensaje =
      pendiente.fase === "escribir" || !pendiente.detectado
        ? mensajeConfirmarViajeHoja(null)
        : mensajeConfirmarViajeHoja(pendiente.detectado);
    await enviar(phone, mensaje, { nombre, gasto_id: pendiente.gasto_id });
    return { flow: "rendicion_repreguntar_viaje", mensaje, message: mensaje };
  }

  const numero = resp.accion === "guardar" ? resp.numero : pendiente.detectado;
  if (!numero) {
    const mensaje = mensajeConfirmarViajeHoja(null);
    await convStore.setRendicionViajePendiente(phone, { ...pendiente, fase: "escribir" });
    await enviar(phone, mensaje, { nombre, gasto_id: pendiente.gasto_id });
    return { flow: "rendicion_pedir_viaje", mensaje, message: mensaje };
  }

  const gasto = await rendicionStore.actualizarGasto(pendiente.gasto_id, {
    viaje_documento: numero,
    viaje_documento_confirmado_chofer: true,
    estado: "pendiente_aprobacion",
    descripcion: "Hoja de ruta",
    historial_push: `${new Date().toISOString()} · Chofer confirmó nº de viaje de la hoja de ruta: ${numero}`,
  });
  await convStore.setRendicionViajePendiente(phone, null);
  const mensaje = mensajeViajeHojaConfirmado(numero);
  await enviar(phone, mensaje, { nombre, gasto_id: pendiente.gasto_id });
  log?.info?.({ id: pendiente.gasto_id, numero }, "Rendición: viaje de hoja confirmado por chofer");
  return {
    flow: "rendicion_viaje_confirmado",
    gasto,
    mensaje,
    message: mensaje,
  };
}

function mensajeEncargadoInicio() {
  return (
    `Esta línea es de *administración*: el gasto no queda a tu nombre.\n\n` +
    `Mandame la *foto del ticket* (si no la mandaste) y el *nº de viaje* y el *nombre del chofer*.\n` +
    `No le avisamos al chofer.`
  );
}

function mensajeEncargadoPedirViaje() {
  return `¿Cuál es el *nº de viaje* de este gasto?`;
}

function mensajeEncargadoPedirChofer() {
  return `¿A *qué chofer* lo imputamos? (nombre, como en Parámetros)`;
}

function mensajeEncargadoListo(gasto) {
  const viaje = gasto.nro_viaje_delfos || gasto.viaje_ref || "—";
  return (
    `Listo. Dejé el gasto *${gasto.codigo}* pendiente de aprobación:\n` +
    `• Chofer: *${gasto.chofer_nombre || "—"}*\n` +
    `• Viaje: *${viaje}*\n` +
    `• Importe: ${gasto.monto != null ? `$${gasto.monto}` : "a revisar"}\n\n` +
    `El chofer *no* recibe aviso.`
  );
}

async function choferesParaImputar() {
  const rows = await master.listCollection("choferes", { activo: true });
  return rows.filter((c) => !esAdministracion(c));
}

async function persistirFotoEncargado({ imageBuffer, mime, imagenUrl }) {
  let url = imagenUrl || null;
  if (imageBuffer?.length) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    if (saved?.publicUrl) url = saved.publicUrl;
  }
  return url;
}

/**
 * Carga de gasto por encargado (teléfono Administración).
 * Imputa a un chofer + nº de viaje. No notifica al chofer.
 */
export async function procesarCargaEncargadoRendicion({
  telefono,
  texto,
  nombre,
  imageBuffer,
  mime,
  imagenUrl,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  const t = String(texto ?? "").trim();
  const pending = (await convStore.getRendicionEncargadoPendiente(phone)) || {
    fase: "recolectar",
    nro_viaje: null,
    chofer_nombre: null,
    chofer_telefono: null,
    imagen_url: null,
  };

  if (t || imageBuffer || imagenUrl) {
    await convStore.appendMensaje(
      phone,
      {
        texto: t || "[Comprobante de gasto · administración]",
        tipo: imageBuffer || imagenUrl ? "image" : "text",
        imagen_url: imagenUrl || null,
      },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  if (imageBuffer?.length || imagenUrl) {
    pending.imagen_url = await persistirFotoEncargado({ imageBuffer, mime, imagenUrl });
  }

  const pareceCancelar = /^(cancel|cancelá|cancelar|olvidate|no)$/i.test(t);
  if (pareceCancelar) {
    await convStore.setRendicionEncargadoPendiente(phone, null);
    const msg = `Ok, cancelé la carga por administración.`;
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_encargado_cancelado", mensaje: msg, message: msg };
  }

  if (!pending.nro_viaje) {
    const nro = t.replace(/[^\d]/g, "");
    if (nro.length >= 3 && !imageBuffer) {
      pending.nro_viaje = nro;
    } else if (!pending.imagen_url) {
      const msg = mensajeEncargadoInicio();
      await convStore.setRendicionEncargadoPendiente(phone, pending);
      await enviar(phone, msg, { nombre });
      return { flow: "rendicion_encargado_inicio", mensaje: msg, message: msg };
    } else if (!nro || nro.length < 3) {
      pending.fase = "viaje";
      await convStore.setRendicionEncargadoPendiente(phone, pending);
      const msg = mensajeEncargadoPedirViaje();
      await enviar(phone, msg, { nombre });
      return { flow: "rendicion_encargado_viaje", mensaje: msg, message: msg };
    } else {
      pending.nro_viaje = nro;
    }
  }

  if (!pending.chofer_nombre) {
    const candidatos = await choferesParaImputar();
    const match = t && !/^\d+$/.test(t) ? findChoferPorNombre(candidatos, t) : null;
    if (match) {
      pending.chofer_nombre = match.nombre;
      pending.chofer_telefono = match.telefono || match.documento || null;
    } else if (t && t.length >= 3 && !/^\d+$/.test(t) && pending.nro_viaje && t.replace(/[^\d]/g, "") !== pending.nro_viaje) {
      pending.chofer_nombre = t;
    } else {
      pending.fase = "chofer";
      await convStore.setRendicionEncargadoPendiente(phone, pending);
      const msg = mensajeEncargadoPedirChofer();
      await enviar(phone, msg, { nombre });
      return { flow: "rendicion_encargado_chofer", mensaje: msg, message: msg };
    }
  }

  if (!pending.imagen_url) {
    pending.fase = "foto";
    await convStore.setRendicionEncargadoPendiente(phone, pending);
    const msg = `Dale, ahora mandame la *foto del ticket* para imputarlo a *${pending.chofer_nombre}* · viaje *${pending.nro_viaje}*.`;
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_encargado_foto", mensaje: msg, message: msg };
  }

  let ocrTexto = null;
  let interp = {};
  if (imageBuffer?.length) {
    try {
      const { ocrDocumento } = await import("../../../lib/document-ai.mjs");
      const ocr = await ocrDocumento(imageBuffer, "gasto.jpg");
      ocrTexto = String(ocr?.texto || "").trim() || null;
    } catch (err) {
      log?.warn?.({ err: err.message }, "Rendición encargado OCR falló");
    }
    interp =
      (await interpretarGastoWhatsApp({
        texto: t,
        imageBuffer,
        mime,
        ocrTexto,
        log,
      })) || {};
  }

  const gasto = await rendicionStore.crearGasto({
    telefono: sanitizePhone(pending.chofer_telefono) || null,
    chofer_nombre: pending.chofer_nombre,
    nro_viaje_delfos: pending.nro_viaje,
    viaje_ref: pending.nro_viaje,
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
    nota_chofer: t || null,
    texto_ocr: ocrTexto || interp.texto_ocr || null,
    imagen_url: pending.imagen_url,
    estado: "pendiente_aprobacion",
    origen_carga: "administracion",
    cargado_por_telefono: phone,
    cargado_por_nombre: nombre || null,
  });

  await convStore.setRendicionEncargadoPendiente(phone, null);
  const mensaje = mensajeEncargadoListo(gasto);
  await enviar(phone, mensaje, { nombre, gasto_id: gasto.id });
  log?.info?.(
    {
      id: gasto.id,
      codigo: gasto.codigo,
      chofer: gasto.chofer_nombre,
      viaje: gasto.nro_viaje_delfos,
      por: phone,
    },
    "Rendición: gasto cargado por administración",
  );
  return {
    flow: "rendicion_encargado_pendiente_aprobacion",
    gasto,
    mensaje,
    message: mensaje,
  };
}
