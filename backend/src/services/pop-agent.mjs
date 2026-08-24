import {
  interpretarTextoPop,
  leerPopDesdeImagen,
  mensajeConfirmacionPop,
  mensajeDecisionPop,
  mensajePedirCantidadesPop,
  mensajePedirFotoPop,
  mensajePopSoloChoferes,
  mensajeProcesandoPop,
  parecePop,
} from "../../../lib/pop-wa.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as evidenceStore from "../db/evidence-store.mjs";
import {
  markObservedIfDifference,
  resolveActiveViajeForChofer,
  syncMilestonesForTrip,
} from "./evidence-service.mjs";
import { resolverChoferFromPhone } from "./pod-agent.mjs";
import { persistChatMedia } from "./chat-media.mjs";

export { parecePop, mensajePopSoloChoferes };

async function enviar(phone, mensaje, meta = {}) {
  const p = sanitizePhone(phone);
  if (!p || !mensaje?.trim()) return;
  await sendWhatsAppMessage({ number: p, message: mensaje });
  await convStore.appendMensaje(
    p,
    { texto: mensaje, tipo: "text", evidence_id: meta.evidence_id ?? null },
    { dir: "out", from: "bot", agente: "evidence", nombre: meta.nombre ?? null },
  );
}

function plannedFromViaje(viaje) {
  if (!viaje?.carga) return null;
  const raw = String(viaje.carga);
  const q = {};
  const pal = raw.match(/(\d+)\s*pallet/i);
  const caj = raw.match(/(\d+)\s*caja/i);
  const bul = raw.match(/(\d+)\s*bulto/i);
  if (pal) q.pallets = Number(pal[1]);
  if (caj) q.cajas = Number(caj[1]);
  if (bul) q.bultos = Number(bul[1]);
  return Object.keys(q).length ? q : null;
}

/**
 * Flujo POP por WhatsApp — retiro en origen.
 */
export async function procesarPopWhatsApp({
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

  const pending = evidenceStore.getEvidenceDialogByTelefono(phone, { type: "POP" });
  if (!forzar && !pending && !imageBuffer) {
    const quiere = await parecePop(t, { log });
    if (!quiere) return null;
  }

  const chofer = await resolverChoferFromPhone(phone);
  if (!chofer) {
    const msg = mensajePopSoloChoferes();
    await enviar(phone, msg, { nombre });
    return { flow: "pop_solo_choferes", mensaje: msg, message: msg };
  }

  const viaje = await resolveActiveViajeForChofer(phone);
  const viajeRef = viaje?.codigo || viaje?.id || null;

  let fotoUrl = imagenUrl || null;
  if (imageBuffer?.length && !fotoUrl) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    fotoUrl = saved?.publicUrl || saved?.url || null;
  }

  await convStore.appendMensaje(
    phone,
    { texto: t || (fotoUrl ? "(foto POP)" : null), tipo: fotoUrl ? "image" : "text", imagen_url: fotoUrl },
    { dir: "in", from: "chofer", nombre: nombre || chofer.nombre, agente: "evidence" },
  );

  const expected = plannedFromViaje(viaje);

  async function closePop(row, lectura, quantities, condition) {
    let updated = evidenceStore.updateEvidence(row.id, {
      estado: "pendiente",
      reported_quantities: quantities || row.reported_quantities,
      expected_quantities: expected,
      condition: condition || row.condition || "ok",
      viaje_ref: viajeRef || row.viaje_ref,
      trip_id: viaje?.id || row.trip_id,
      tenant_id: viaje?.tenant || row.tenant_id,
      origen: viaje?.origen || row.origen,
      destino: viaje?.destino || row.destino,
      nota_chofer: lectura?.resumen || row.nota_chofer,
      texto_ocr: lectura?.ocr_texto || row.texto_ocr,
      historial_push: "POP completado por chofer",
    });
    if (expected && updated.reported_quantities) {
      const obs = await markObservedIfDifference(updated.id, {
        expected,
        reported: updated.reported_quantities,
      });
      if (obs) updated = obs;
    }
    if (viaje?.id) await syncMilestonesForTrip(viaje.id);
    const msg = mensajeConfirmacionPop(updated, lectura);
    await enviar(phone, msg, { evidence_id: updated.id, nombre });
    return { flow: "pop_pendiente", mensaje: msg, message: msg, evidence: updated, pop: updated };
  }

  if (pending) {
    if (pending.estado === "esperando_foto") {
      if (!fotoUrl || !imageBuffer?.length) {
        const interp = t ? await interpretarTextoPop({ texto: t, estado: pending.estado, log }) : null;
        if (interp?.accion === "cancelar") {
          evidenceStore.updateEvidence(pending.id, { estado: "rechazado", historial_push: "Cancelado" });
          const msg = interp.mensaje || "Listo, cancelé el POP.";
          await enviar(phone, msg, { evidence_id: pending.id, nombre });
          return { flow: "pop_cancelado", mensaje: msg, message: msg };
        }
        const msg = interp?.mensaje || mensajePedirFotoPop(viajeRef);
        await enviar(phone, msg, { evidence_id: pending.id, nombre });
        return { flow: "pop_pedir_foto", mensaje: msg, message: msg, evidence: pending };
      }
      await enviar(phone, mensajeProcesandoPop(), { evidence_id: pending.id, nombre });
      const lectura = await leerPopDesdeImagen({ imageBuffer, mime, texto: t, log });
      evidenceStore.updateEvidence(pending.id, {
        imagen_url: fotoUrl,
        attachment: { url: fotoUrl, mimeType: mime || "image/jpeg" },
        texto_ocr: lectura?.ocr_texto || null,
      });
      const interp = t ? await interpretarTextoPop({ texto: t, estado: "esperando_carga", log }) : null;
      if (interp?.quantities) {
        return closePop(pending, lectura, interp.quantities, interp.condition);
      }
      const upd = evidenceStore.updateEvidence(pending.id, {
        estado: "esperando_carga",
        historial_push: "Foto recibida; pendiente cantidades",
      });
      const msg = mensajePedirCantidadesPop();
      await enviar(phone, msg, { evidence_id: upd.id, nombre });
      return { flow: "pop_pedir_carga", mensaje: msg, message: msg, evidence: upd };
    }

    if (pending.estado === "esperando_carga") {
      const interp = await interpretarTextoPop({ texto: t, estado: pending.estado, log });
      if (interp.accion === "cancelar") {
        evidenceStore.updateEvidence(pending.id, { estado: "rechazado", historial_push: "Cancelado" });
        const msg = interp.mensaje || "POP cancelado.";
        await enviar(phone, msg, { evidence_id: pending.id, nombre });
        return { flow: "pop_cancelado", mensaje: msg, message: msg };
      }
      if (fotoUrl && imageBuffer?.length) {
        evidenceStore.updateEvidence(pending.id, {
          attachment: { url: fotoUrl, mimeType: mime || "image/jpeg" },
        });
      }
      return closePop(pending, null, interp.quantities, interp.condition);
    }
  }

  // Nuevo POP
  if (fotoUrl && imageBuffer?.length) {
    await enviar(phone, mensajeProcesandoPop(), { nombre });
    const lectura = await leerPopDesdeImagen({ imageBuffer, mime, texto: t, log });
    const interp = t ? await interpretarTextoPop({ texto: t, estado: null, log }) : null;
    const row = evidenceStore.createEvidence({
      telefono: phone,
      type: "POP",
      chofer_nombre: chofer.nombre || nombre,
      imagen_url: fotoUrl,
      estado: interp?.quantities ? "pendiente" : "esperando_carga",
      viaje_ref: viajeRef,
      trip_id: viaje?.id || null,
      tenant_id: viaje?.tenant || null,
      origen: viaje?.origen || null,
      destino: viaje?.destino || null,
      reported_quantities: interp?.quantities,
      expected_quantities: expected,
      condition: interp?.condition,
      nota_chofer: lectura?.resumen || null,
      texto_ocr: lectura?.ocr_texto || null,
    });
    if (row.estado === "pendiente") {
      if (expected && row.reported_quantities) {
        await markObservedIfDifference(row.id, { expected, reported: row.reported_quantities });
      }
      if (viaje?.id) await syncMilestonesForTrip(viaje.id);
      const msg = mensajeConfirmacionPop(row, lectura);
      await enviar(phone, msg, { evidence_id: row.id, nombre });
      return { flow: "pop_pendiente", mensaje: msg, message: msg, evidence: row };
    }
    const msg = mensajePedirCantidadesPop();
    await enviar(phone, msg, { evidence_id: row.id, nombre });
    return { flow: "pop_pedir_carga", mensaje: msg, message: msg, evidence: row };
  }

  const row = evidenceStore.createEvidence({
    telefono: phone,
    type: "POP",
    chofer_nombre: chofer.nombre || nombre,
    estado: "esperando_foto",
    viaje_ref: viajeRef,
    trip_id: viaje?.id || null,
    tenant_id: viaje?.tenant || null,
    origen: viaje?.origen || null,
    destino: viaje?.destino || null,
    expected_quantities: expected,
  });
  const msg = mensajePedirFotoPop(viajeRef);
  await enviar(phone, msg, { evidence_id: row.id, nombre });
  return { flow: "pop_pedir_foto", mensaje: msg, message: msg, evidence: row };
}

export async function notificarDecisionPop(caso, opts = {}) {
  if (!caso?.telefono || caso.type !== "POP") return;
  const msg = mensajeDecisionPop(caso);
  try {
    await enviar(caso.telefono, msg, { evidence_id: caso.id, nombre: caso.chofer_nombre });
  } catch (err) {
    opts.log?.warn?.({ err: err.message, id: caso.id }, "POP: no pude notificar decisión");
  }
}
