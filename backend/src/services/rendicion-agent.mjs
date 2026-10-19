import {
  interpretarGastoWhatsApp,
  mensajeConfirmacionGasto,
  mensajePedirFotoComprobante,
  mensajePedirViajeOHoja,
  mensajeRechazoNoComprobante,
  mensajeDuplicadoGasto,
  mensajeViajeAsignado,
  mensajeConfirmarAsociacionViaje,
  mensajeViajeAsociacionCancelada,
  pareceRendicionGasto,
  parseAsignacionViaje,
  parseForzarDuplicado,
  motivoForzarDuplicadoValido,
  pareceAfirmacionCorta,
  pareceNegacionCorta,
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

/** Choferes registrados en Parámetros / maestros (no Administración). */
export async function telefonoEsChoferRegistrado(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return false;
  const row = await master.resolverChoferPorTelefono(phone);
  if (row && esAdministracion(row)) return false;
  return Boolean(row);
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
  const row = await master.resolverChoferPorTelefono(phone);
  if (row && esAdministracion(row)) return null;
  return row;
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

async function crearGastoDesdeInterp({
  phone,
  nombre,
  chofer,
  interp,
  nroViaje,
  hojaId,
  t,
  ocrTexto,
  imagenPersistida,
  extraNota = null,
}) {
  const notaParts = [
    t || null,
    interp.combustible_cta_cte ? "cta_cte" : null,
    interp.pago_chofer ? "pago_chofer" : null,
    extraNota,
  ].filter(Boolean);

  return rendicionStore.crearGasto({
    telefono: phone,
    chofer_nombre: nombre || chofer?.nombre || null,
    categoria: interp.categoria,
    monto: interp.monto,
    moneda: interp.moneda || "ARS",
    moneda_origen: interp.moneda_origen || null,
    monto_origen: interp.monto_origen ?? null,
    tc_clp_ars: interp.tc_clp_ars ?? null,
    tc_fecha: interp.tc_fecha || null,
    tc_fuente: interp.tc_fuente || null,
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
}

/**
 * Respuestas cortas: confirmar viaje (sí/no) o forzar duplicado con motivo.
 */
export async function procesarPendientesRendicionWhatsApp({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone || !t) return null;

  const chofer = await resolverChoferRendicion(phone);
  if (!chofer) return null;

  const conv = await convStore.getConversacion(phone);

  // 1) Confirmar / cancelar asociación a viaje
  const pendViaje = convStore.getPendienteConfirmViajeRendicion(conv);
  if (pendViaje) {
    if (pareceAfirmacionCorta(t)) {
      await convStore.setEsperandoComprobantesRendicion(phone, true, {
        nroViajeDelfos: pendViaje.nroViajeDelfos,
        hojaRutaId: pendViaje.hojaRutaId || null,
      });
      await convStore.clearPendienteConfirmViajeRendicion(phone);
      const msg = mensajeViajeAsignado(pendViaje.nroViajeDelfos, {
        hojaCodigo: pendViaje.hojaCodigo,
      });
      await enviar(phone, msg, { nombre });
      log?.info?.(
        { nro: pendViaje.nroViajeDelfos, hojaId: pendViaje.hojaRutaId },
        "Rendición: viaje confirmado por chofer",
      );
      return {
        flow: "rendicion_viaje_confirmado",
        nro_viaje_delfos: pendViaje.nroViajeDelfos,
        mensaje: msg,
        message: msg,
      };
    }
    if (pareceNegacionCorta(t)) {
      await convStore.clearPendienteConfirmViajeRendicion(phone);
      const msg = mensajeViajeAsociacionCancelada();
      await enviar(phone, msg, { nombre });
      return {
        flow: "rendicion_viaje_cancelado",
        mensaje: msg,
        message: msg,
      };
    }
    // Si escribió otra cosa mientras espera sí/no, repreguntar
    if (!parseAsignacionViaje(t) && !parseForzarDuplicado(t)) {
      const msg = mensajeConfirmarAsociacionViaje({
        nroViaje: pendViaje.nroViajeDelfos,
        hojaCodigo: pendViaje.hojaCodigo,
      });
      await enviar(phone, msg, { nombre });
      return {
        flow: "rendicion_viaje_repreguntar",
        mensaje: msg,
        message: msg,
      };
    }
  }

  // 2) Forzar duplicado excepcional
  const forzar = parseForzarDuplicado(t);
  if (forzar) {
    const draft = convStore.getPendienteDuplicadoRendicion(conv);
    if (!draft?.payload) {
      const msg =
        `No hay un ticket duplicado pendiente de forzar.\n\n` +
        `Si mandás de nuevo un ticket repetido, te voy a indicar cómo forzar con motivo.`;
      await enviar(phone, msg, { nombre });
      return { flow: "rendicion_forzar_sin_pendiente", mensaje: msg, message: msg };
    }
    if (!motivoForzarDuplicadoValido(forzar.motivo)) {
      const msg =
        `Para forzar el duplicado necesitás un *motivo* (mín. autorización).\n\n` +
        `Ej: *forzar duplicado autorizado mesa*`;
      await enviar(phone, msg, { nombre });
      return { flow: "rendicion_forzar_sin_motivo", mensaje: msg, message: msg };
    }

    const payload = draft.payload;
    const gasto = await rendicionStore.crearGasto({
      ...payload,
      nota_chofer: [
        payload.nota_chofer,
        `forzar_duplicado · ${forzar.motivo}`,
        draft.dup_codigo ? `orig ${draft.dup_codigo}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      estado: "pendiente_aprobacion",
    });
    await convStore.clearPendienteDuplicadoRendicion(phone);
    await convStore.setEsperandoComprobantesRendicion(phone, true, {
      nroViajeDelfos: payload.nro_viaje_delfos || null,
      hojaRutaId: payload.remito_ref?.startsWith("hoja:")
        ? payload.remito_ref.slice(5)
        : undefined,
    });

    const mensaje =
      `⚠️ Duplicado *forzado* (excepción).\n` +
      `Motivo: ${forzar.motivo}\n\n` +
      `Código *${gasto.codigo}* · queda *pendiente de aprobación*.\n\n` +
      `Si tenés *otro ticket*, mandá la foto. Si no, escribí *listo*.`;
    await enviar(phone, mensaje, { nombre, gasto_id: gasto.id });
    log?.info?.(
      { id: gasto.id, codigo: gasto.codigo, motivo: forzar.motivo, orig: draft.dup_codigo },
      "Rendición: duplicado forzado con motivo",
    );
    return {
      flow: "rendicion_duplicado_forzado",
      gasto,
      mensaje,
      message: mensaje,
    };
  }

  return null;
}

/**
 * Propone asociar gastos a un viaje Delfos (pide sí/no antes de activar).
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
  await convStore.setPendienteConfirmViajeRendicion(phone, {
    nroViajeDelfos: nro,
    hojaRutaId: hoja?.id || null,
    hojaCodigo: hoja?.codigo || null,
  });

  const msg = mensajeConfirmarAsociacionViaje({
    nroViaje: nro,
    hojaCodigo: hoja?.codigo || null,
  });
  await enviar(phone, msg, { nombre });
  log?.info?.(
    { nro, hojaId: hoja?.id || null, foundHoja: Boolean(hoja) },
    "Rendición: pedida confirmación de viaje",
  );
  return {
    flow: "rendicion_viaje_pedir_confirmacion",
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
    const notaParts = [
      t || null,
      interp.combustible_cta_cte ? "cta_cte" : null,
      interp.pago_chofer ? "pago_chofer" : null,
    ].filter(Boolean);
    await convStore.setPendienteDuplicadoRendicion(phone, {
      dup_codigo: dup.codigo,
      dup_id: dup.id,
      payload: {
        telefono: phone,
        chofer_nombre: nombre || chofer?.nombre || null,
        categoria: interp.categoria,
        monto: interp.monto,
        moneda: interp.moneda || "ARS",
        moneda_origen: interp.moneda_origen || null,
        monto_origen: interp.monto_origen ?? null,
        tc_clp_ars: interp.tc_clp_ars ?? null,
        tc_fecha: interp.tc_fecha || null,
        tc_fuente: interp.tc_fuente || null,
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
      },
    });
    const msg = mensajeDuplicadoGasto(dup);
    await enviar(phone, msg, { nombre, gasto_id: dup.id });
    log?.info?.(
      { dup: dup.codigo, nro_t: interp.nro_t, monto: interp.monto },
      "Rendición: comprobante duplicado bloqueado (pendiente forzar)",
    );
    return {
      flow: "rendicion_duplicado",
      gasto: dup,
      mensaje: msg,
      message: msg,
    };
  }

  await convStore.setEsperandoComprobantesRendicion(phone, true, {
    nroViajeDelfos: nroViaje,
    hojaRutaId: hojaId,
  });
  await convStore.clearPendienteDuplicadoRendicion(phone);

  const gasto = await crearGastoDesdeInterp({
    phone,
    nombre,
    chofer,
    interp,
    nroViaje,
    hojaId,
    t,
    ocrTexto,
    imagenPersistida,
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
