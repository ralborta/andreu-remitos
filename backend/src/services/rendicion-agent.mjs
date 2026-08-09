import {
  interpretarGastoWhatsApp,
  mensajeConfirmacionGasto,
  mensajePedirFotoComprobante,
  pareceRendicionGasto,
} from "../../../lib/rendicion-wa.mjs";
import * as rendicionStore from "../db/rendicion-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { getChoferViajesPorTelefono } from "../db/viajes-flota-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";

/** Choferes de Parámetros/Remitos o flota Gestión de Viajes. */
export async function telefonoEsChoferRegistrado(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return false;
  if (await master.resolverChoferPorTelefono(phone)) return true;
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
    const msg = mensajePedirFotoComprobante(t);
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_pedir_foto", mensaje: msg, message: msg };
  }

  const interp = await interpretarGastoWhatsApp({
    texto: t,
    imageBuffer,
    mime,
    log,
  });

  const gasto = await rendicionStore.crearGasto({
    telefono: phone,
    chofer_nombre: nombre || null,
    categoria: interp.categoria,
    monto: interp.monto,
    proveedor: interp.proveedor,
    fecha_comprobante: interp.fecha_comprobante,
    descripcion: interp.descripcion,
    nota_chofer: t || null,
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
