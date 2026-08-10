import {
  extraerNombreReceptor,
  esIntencionOSaludoPod,
  leerPodDesdeImagen,
  mensajeConfirmacionPod,
  mensajeDecisionPod,
  mensajePedirFotoPod,
  mensajePedirNombreReceptor,
  mensajePodSoloChoferes,
  mensajeProcesandoPod,
  parecePod,
} from "../../../lib/pod-wa.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { getChoferViajesPorTelefono } from "../db/viajes-flota-store.mjs";
import * as destinosStore from "../db/destinos-store.mjs";
import * as podStore from "../db/pod-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";

export { parecePod, mensajePodSoloChoferes };

async function resolverChofer(telefono) {
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

export async function telefonoEsChoferPod(telefono) {
  return Boolean(await resolverChofer(telefono));
}

async function enviar(phone, mensaje, meta = {}) {
  const p = sanitizePhone(phone);
  if (!p || !mensaje?.trim()) return;
  await sendWhatsAppMessage({ number: p, message: mensaje });
  await convStore.appendMensaje(
    p,
    { texto: mensaje, tipo: "text", pod_id: meta.pod_id ?? null },
    { dir: "out", from: "bot", agente: "pod", nombre: meta.nombre ?? null },
  );
}

async function enriquecerConDestino(phone) {
  try {
    const list = await destinosStore.listDestinos({ limit: 30 });
    const d =
      list.find(
        (x) =>
          sanitizePhone(x.telefono_chofer) === phone &&
          ["en_ruta", "esperando_eta_chofer", "confirmado"].includes(x.estado),
      ) || null;
    if (!d) return {};
    return {
      destino_id: d.id,
      destino: d.formatted_address || null,
      viaje_ref: d.viaje_ref || d.remito_ref || null,
    };
  } catch {
    return {};
  }
}

function notaDesdeLectura(lectura, textoChofer) {
  const parts = [];
  if (lectura?.resumen) parts.push(lectura.resumen);
  if (lectura?.pedido_ref) parts.push(`Ref: ${lectura.pedido_ref}`);
  if (textoChofer && !esIntencionOSaludoPod(textoChofer) && !parecePod(textoChofer)) {
    parts.push(textoChofer);
  }
  return parts.length ? parts.join(" · ").slice(0, 400) : null;
}

/**
 * Diálogo POD: foto del formulario → visión OCR → pendiente backoffice.
 * Si falta el receptor en el papel, se pide por texto.
 */
export async function procesarPodWhatsApp({
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

  const pending = await podStore.getPodPendientePorTelefono(phone);
  if (!forzar && !pending && !imageBuffer && !parecePod(t)) return null;

  const chofer = await resolverChofer(phone);
  if (!chofer) {
    const msg = mensajePodSoloChoferes();
    await enviar(phone, msg, { nombre });
    return { flow: "pod_solo_choferes", mensaje: msg, message: msg };
  }

  let fotoUrl = imagenUrl || null;
  if (imageBuffer?.length && !fotoUrl) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    fotoUrl = saved?.publicUrl || saved?.url || null;
  }

  await convStore.appendMensaje(
    phone,
    {
      texto: t || (fotoUrl ? "(foto POD)" : null),
      tipo: fotoUrl ? "image" : "text",
      imagen_url: fotoUrl,
    },
    { dir: "in", from: "chofer", nombre: nombre || chofer.nombre, agente: "pod" },
  );

  // ——— Diálogo pendiente ———
  if (pending) {
    // Esperando nombre (OCR no lo sacó)
    if (pending.estado === "esperando_receptor") {
      const receptor = extraerNombreReceptor(t);
      if (!receptor && !fotoUrl) {
        const msg = mensajePedirNombreReceptor();
        await enviar(phone, msg, { pod_id: pending.id, nombre });
        return { flow: "pod_pedir_receptor", mensaje: msg, message: msg, pod: pending };
      }

      // Nueva foto: reintentar OCR
      if (fotoUrl && imageBuffer?.length) {
        await enviar(phone, mensajeProcesandoPod(), { pod_id: pending.id, nombre });
        const lectura = await leerPodDesdeImagen({
          imageBuffer,
          mime,
          texto: t,
          log,
        });
        const receptorFinal =
          receptor ||
          lectura?.receptor_nombre ||
          pending.receptor_nombre ||
          null;
        if (!receptorFinal) {
          const updated = await podStore.actualizarPod(pending.id, {
            imagen_url: fotoUrl,
            viaje_ref: lectura?.pedido_ref || pending.viaje_ref,
            destino: lectura?.destino || pending.destino,
            nota_chofer: notaDesdeLectura(lectura, t) || pending.nota_chofer,
            historial_push: "Foto recibida; falta receptor",
          });
          const msg = mensajePedirNombreReceptor();
          await enviar(phone, msg, { pod_id: updated.id, nombre });
          return { flow: "pod_pedir_receptor", mensaje: msg, message: msg, pod: updated };
        }
        const closed = await podStore.actualizarPod(pending.id, {
          estado: "pendiente",
          receptor_nombre: receptorFinal,
          imagen_url: fotoUrl,
          viaje_ref: lectura?.pedido_ref || pending.viaje_ref,
          destino: lectura?.destino || pending.destino,
          chofer_nombre: chofer.nombre || pending.chofer_nombre,
          nota_chofer: notaDesdeLectura(lectura, t) || pending.nota_chofer,
          historial_push: `Completado · OCR + receptor ${receptorFinal}`,
        });
        const msg = mensajeConfirmacionPod(closed, lectura);
        await enviar(phone, msg, { pod_id: closed.id, nombre });
        return { flow: "pod_pendiente", mensaje: msg, message: msg, pod: closed };
      }

      const receptorFinal = receptor || pending.receptor_nombre;
      if (!receptorFinal) {
        const msg = mensajePedirNombreReceptor();
        await enviar(phone, msg, { pod_id: pending.id, nombre });
        return { flow: "pod_pedir_receptor", mensaje: msg, message: msg, pod: pending };
      }

      if (pending.imagen_url) {
        const closed = await podStore.actualizarPod(pending.id, {
          estado: "pendiente",
          receptor_nombre: receptorFinal,
          historial_push: `Receptor: ${receptorFinal}`,
        });
        const msg = mensajeConfirmacionPod(closed);
        await enviar(phone, msg, { pod_id: closed.id, nombre });
        return { flow: "pod_pendiente", mensaje: msg, message: msg, pod: closed };
      }

      const updated = await podStore.actualizarPod(pending.id, {
        estado: "esperando_foto",
        receptor_nombre: receptorFinal,
        historial_push: `Receptor: ${receptorFinal}`,
      });
      const msg = mensajePedirFotoPod(receptorFinal);
      await enviar(phone, msg, { pod_id: updated.id, nombre });
      return { flow: "pod_pedir_foto", mensaje: msg, message: msg, pod: updated };
    }

    if (pending.estado === "esperando_foto") {
      if (!fotoUrl || !imageBuffer?.length) {
        // Si mandó un nombre válido sin foto, lo guardamos y seguimos pidiendo foto
        const receptor = extraerNombreReceptor(t);
        if (receptor) {
          await podStore.actualizarPod(pending.id, {
            receptor_nombre: receptor,
            historial_push: `Receptor: ${receptor}`,
          });
        }
        const msg = mensajePedirFotoPod(receptor || pending.receptor_nombre);
        await enviar(phone, msg, { pod_id: pending.id, nombre });
        return { flow: "pod_pedir_foto", mensaje: msg, message: msg, pod: pending };
      }

      await enviar(phone, mensajeProcesandoPod(), { pod_id: pending.id, nombre });
      const lectura = await leerPodDesdeImagen({
        imageBuffer,
        mime,
        texto: t,
        log,
      });
      const receptorFinal =
        pending.receptor_nombre ||
        lectura?.receptor_nombre ||
        extraerNombreReceptor(t) ||
        null;

      if (!receptorFinal) {
        const updated = await podStore.actualizarPod(pending.id, {
          estado: "esperando_receptor",
          imagen_url: fotoUrl,
          viaje_ref: lectura?.pedido_ref || pending.viaje_ref,
          destino: lectura?.destino || pending.destino,
          nota_chofer: notaDesdeLectura(lectura, t) || pending.nota_chofer,
          historial_push: "Foto leída; falta nombre receptor",
        });
        const msg = mensajePedirNombreReceptor();
        await enviar(phone, msg, { pod_id: updated.id, nombre });
        return { flow: "pod_pedir_receptor", mensaje: msg, message: msg, pod: updated };
      }

      const closed = await podStore.actualizarPod(pending.id, {
        estado: "pendiente",
        receptor_nombre: receptorFinal,
        imagen_url: fotoUrl,
        viaje_ref: lectura?.pedido_ref || pending.viaje_ref,
        destino: lectura?.destino || pending.destino,
        nota_chofer: notaDesdeLectura(lectura, t) || pending.nota_chofer,
        historial_push: `Foto OCR · receptor ${receptorFinal}`,
      });
      const msg = mensajeConfirmacionPod(closed, lectura);
      await enviar(phone, msg, { pod_id: closed.id, nombre });
      return { flow: "pod_pendiente", mensaje: msg, message: msg, pod: closed };
    }
  }

  // ——— Inicio nuevo ———
  const extra = await enriquecerConDestino(phone);
  const receptorFromText = extraerNombreReceptor(t);

  // Foto de entrada → OCR
  if (fotoUrl && imageBuffer?.length) {
    await enviar(phone, mensajeProcesandoPod(), { nombre });
    const lectura = await leerPodDesdeImagen({
      imageBuffer,
      mime,
      texto: t,
      log,
    });
    const receptorFinal =
      receptorFromText || lectura?.receptor_nombre || null;

    if (receptorFinal) {
      const row = await podStore.crearPod({
        telefono: phone,
        chofer_nombre: chofer.nombre || nombre,
        receptor_nombre: receptorFinal,
        imagen_url: fotoUrl,
        estado: "pendiente",
        nota_chofer: notaDesdeLectura(lectura, t),
        viaje_ref: lectura?.pedido_ref || extra.viaje_ref || null,
        destino: lectura?.destino || extra.destino || null,
        destino_id: extra.destino_id || null,
      });
      const msg = mensajeConfirmacionPod(row, lectura);
      await enviar(phone, msg, { pod_id: row.id, nombre });
      return { flow: "pod_pendiente", mensaje: msg, message: msg, pod: row };
    }

    const row = await podStore.crearPod({
      telefono: phone,
      chofer_nombre: chofer.nombre || nombre,
      imagen_url: fotoUrl,
      estado: "esperando_receptor",
      nota_chofer: notaDesdeLectura(lectura, t),
      viaje_ref: lectura?.pedido_ref || extra.viaje_ref || null,
      destino: lectura?.destino || extra.destino || null,
      destino_id: extra.destino_id || null,
    });
    const msg = mensajePedirNombreReceptor();
    await enviar(phone, msg, { pod_id: row.id, nombre });
    return { flow: "pod_pedir_receptor", mensaje: msg, message: msg, pod: row };
  }

  // Solo texto: pedir foto (no tomar la intención como receptor)
  const row = await podStore.crearPod({
    telefono: phone,
    chofer_nombre: chofer.nombre || nombre,
    receptor_nombre: receptorFromText,
    estado: "esperando_foto",
    nota_chofer: receptorFromText ? null : t || null,
    ...extra,
  });

  const msg = mensajePedirFotoPod(receptorFromText);
  await enviar(phone, msg, { pod_id: row.id, nombre });
  return { flow: "pod_pedir_foto", mensaje: msg, message: msg, pod: row };
}

export async function notificarDecisionPod(caso, { log } = {}) {
  if (!caso?.telefono) return;
  const msg = mensajeDecisionPod(caso);
  try {
    await enviar(caso.telefono, msg, {
      pod_id: caso.id,
      nombre: caso.chofer_nombre,
    });
  } catch (err) {
    log?.warn?.({ err: err.message, id: caso.id }, "POD: no pude notificar decisión");
  }
}
