import {
  interpretarGastoWhatsApp,
  mensajeConfirmacionGasto,
  pareceRendicionGasto,
} from "../../../lib/rendicion-wa.mjs";
import * as rendicionStore from "../db/rendicion-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";

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

  if (t || imagenUrl) {
    await convStore.appendMensaje(
      phone,
      {
        texto: t || "[Comprobante de gasto]",
        tipo: imageBuffer ? "image" : "text",
        imagen_url: imagenUrl || null,
      },
      { dir: "in", from: "client", nombre, agente: "rendicion" },
    );
  }

  const interp = await interpretarGastoWhatsApp({
    texto: t,
    imageBuffer,
    mime,
    log,
  });

  // Pedido genérico sin datos ni foto → pedir comprobante (no crear gasto vacío)
  const soloPedido =
    !imageBuffer &&
    interp.monto == null &&
    (!t || t.length < 48) &&
    /\b(rendici[oó]n|gasto|comprobante|ticket|factura)\b/i.test(t || "rendicion");
  if (soloPedido && !/\d{3,}/.test(t || "")) {
    const msg =
      `Dale ✅ Mandame la *foto del ticket/factura* (nafta, peaje, llantas, aceite, remolque, auxilio o arreglo menor).\n\n` +
      `También podés escribir el monto y qué es. Queda sujeto a *aprobación humana*.`;
    await enviar(phone, msg, { nombre });
    return { flow: "rendicion_pedir_foto", mensaje: msg, message: msg };
  }

  const gasto = await rendicionStore.crearGasto({
    telefono: phone,
    chofer_nombre: nombre || null,
    categoria: interp.categoria,
    monto: interp.monto,
    proveedor: interp.proveedor,
    fecha_comprobante: interp.fecha_comprobante,
    descripcion: interp.descripcion,
    nota_chofer: t || null,
    imagen_url: imagenUrl || null,
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
