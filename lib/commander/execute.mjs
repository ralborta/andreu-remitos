/**
 * Ejecutor del Channel Adapter: aplica CommanderDecision con handlers legacy.
 * Vive junto al webhook para reutilizar tryProcesar* sin mover Remitos.
 * @module commander-executor — usado solo desde webhooks.mjs
 */

import { isCommanderV11InterruptEnabledForSubject } from "./flags.mjs";
import * as interruptApi from "./interrupt/index.mjs";
import {
  wrapLegacyAgentOutcome,
  shouldAutoResumeFromResult,
} from "./agent-execution-result.mjs";

/**
 * @param {object} deps — handlers y utils inyectados desde webhooks
 */
export async function executeCommanderDecision(decision, ctx, deps) {
  const {
    ev,
    texto,
    tenantCfg,
    log,
    esFoto,
    conv,
    respuestaWebhook,
    notificarChofer,
    downloadMedia,
    tryProcesarReclamo,
    tryProcesarIncidencia,
    tryProcesarPod,
    tryProcesarRendicion,
    tryProcesarDestinos,
    tryProcesarViajes,
    procesarTextoChofer,
    runRemitosIngest,
    runRemitosAudio,
    mensajeIncidenciaSoloChoferes,
    mensajeRendicionSoloChoferes,
    mensajePodSoloChoferes,
    convStore,
  } = deps;

  const key = decision.executorHints?.executorKey || "";
  const force = decision.forceAgent;
  const v11 = isCommanderV11InterruptEnabledForSubject(ev.from);

  function buildResultCtx() {
    const top = v11 ? interruptApi.peekStackTop(ev.from) : null;
    return {
      processId: decision.processId ?? interruptApi.getActiveProcess(ev.from)?.processId ?? null,
      agentId: decision.agentId ?? null,
      processType: decision.processType ?? null,
      frameResumeMode: top?.resumeMode ?? null,
      parentProcessId: top?.processId ?? null,
    };
  }

  /**
   * Wrapper: adjunta AgentExecutionResult y auto-resume solo vía contrato (no heurística).
   */
  async function finalizeOut(out) {
    if (!out || typeof out !== "object") return out;
    if (!v11) return out;

    const result = wrapLegacyAgentOutcome(out, buildResultCtx());
    let payload = { ...out, agentExecutionResult: result };

    if (result.status === "failed") {
      interruptApi.markActiveFailedNoPop({
        subjectId: ev.from,
        decisionId: decision.decisionId,
      });
      return payload;
    }

    if (shouldAutoResumeFromResult(result)) {
      try {
        const resumed = interruptApi.applyResumeFromExecutionResult({
          subjectId: ev.from,
          result,
          decisionId: decision.decisionId,
        });
        if (resumed.ok && resumed.resumeHint) {
          await notificarChofer(ev.from, resumed.resumeHint, { log, tenant: null }).catch(() => {});
          payload = {
            ...payload,
            resume_hint: resumed.resumeHint,
            resumed_process: resumed.parent?.processId,
            resume_mode: resumed.mode,
            flow: payload.flow || "interrupt_auto_resume",
            interrupt: {
              op: resumed.mode,
              parentProcessId: resumed.parent?.processId,
              pops: resumed.pops ?? null,
            },
          };
        }
      } catch (err) {
        log?.warn?.({ err: err?.message }, "v1.1.1 auto-resume from AgentExecutionResult failed");
      }
    }
    return payload;
  }

  async function reply(out) {
    const finalized = await finalizeOut(out);
    return respuestaWebhook(finalized);
  }

  async function mediaBuffers() {
    let imageBuffer = null;
    let mime = null;
    if (esFoto && ev.media?.url) {
      try {
        const dl = await downloadMedia(ev.media.url);
        if (!/audio/i.test(dl.mime || "")) {
          imageBuffer = dl.buffer;
          mime = dl.mime;
        }
      } catch (err) {
        log?.warn?.({ err: err.message }, "Commander executor: media download");
      }
    }
    return { imageBuffer, mime };
  }

  if (key === "resume_hint" || decision.action === "resume_process") {
    const msg = decision.suggestedReply || "Retomamos lo anterior. ¿Seguimos?";
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return reply({
      message: msg,
      flow: decision.executorHints?.legacyFlow || "resume_process",
      received: true,
      commander: decision.decisionId,
      interrupt: decision.interrupt,
    });
  }

  if (decision.action === "cancel_process" && decision.suggestedReply) {
    const msg = decision.suggestedReply;
    await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
    return reply({
      message: msg,
      flow: "process_cancelled",
      received: true,
      commander: decision.decisionId,
      interrupt: decision.interrupt,
    });
  }

  if (
    decision.suggestedReply &&
    (key === "remitos_pedir_foto" ||
      key === "clarify" ||
      key === "destinos_foto_bloqueada" ||
      key.endsWith("_solo_choferes"))
  ) {
    const msg = decision.suggestedReply;
    if (key === "incidencias_solo_choferes") {
      const m = mensajeIncidenciaSoloChoferes();
      await notificarChofer(ev.from, m, { log, tenant: null }).catch(() => {});
      return reply({
        message: m,
        flow: "incidencia_solo_choferes",
        received: true,
        commander: decision.decisionId,
      });
    }
    if (key === "rendicion_solo_choferes") {
      const m = mensajeRendicionSoloChoferes();
      await notificarChofer(ev.from, m, { log, tenant: null }).catch(() => {});
      await convStore
        .appendMensaje(ev.from, { texto: m, tipo: "text" }, { dir: "out", from: "bot", agente: "rendicion", nombre: ev.nombre })
        .catch(() => {});
      return reply({
        message: m,
        flow: "rendicion_solo_choferes",
        received: true,
        commander: decision.decisionId,
      });
    }
    if (key === "pod_solo_choferes") {
      const m = mensajePodSoloChoferes();
      await notificarChofer(ev.from, m, { log, tenant: null }).catch(() => {});
      return reply({
        message: m,
        flow: "pod_solo_choferes",
        received: true,
        commander: decision.decisionId,
      });
    }
    if (key === "remitos_pedir_foto") {
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      if (texto) {
        await convStore
          .appendMensaje(ev.from, { texto, tipo: "text" }, { dir: "in", from: "chofer", nombre: ev.nombre, agente: "remitos" })
          .catch(() => {});
      }
      await convStore
        .appendMensaje(ev.from, { texto: msg, tipo: "text" }, { dir: "out", from: "bot", agente: "remitos", nombre: ev.nombre })
        .catch(() => {});
      return reply({
        message: msg,
        flow: "remito_pedir_foto",
        received: true,
        commander: decision.decisionId,
      });
    }
    if (key === "destinos_foto_bloqueada") {
      await notificarChofer(ev.from, msg, { log }).catch(() => {});
      return reply({
        message: msg,
        flow: "destinos_esperando_texto",
        destino_id: decision.processId,
        received: true,
        commander: decision.decisionId,
      });
    }
    if (key === "clarify" || key === "remitos_solo_choferes") {
      if (texto) {
        await convStore
          .appendMensaje(ev.from, { texto, tipo: "text" }, { dir: "in", from: "client", nombre: ev.nombre, agente: "router" })
          .catch(() => {});
      }
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      await convStore
        .appendMensaje(ev.from, { texto: msg, tipo: "text" }, { dir: "out", from: "bot", agente: "router" })
        .catch(() => {});
      return reply({
        message: msg,
        flow: decision.executorHints?.legacyFlow || "intent_clarificar",
        received: true,
        commander: decision.decisionId,
      });
    }
  }

  switch (key) {
    case "reclamos_force":
    case "reclamos": {
      const { imageBuffer, mime } = await mediaBuffers();
      const out = await tryProcesarReclamo(ev, {
        texto,
        log,
        forzar: force || key === "reclamos_force",
        imageBuffer,
        mime,
      });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      break;
    }
    case "incidencias_force": {
      const { imageBuffer, mime } = await mediaBuffers();
      const out = await tryProcesarIncidencia(ev, { texto, log, forzar: true, imageBuffer, mime });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      const msg =
        `Perfecto, vamos con la *incidencia*.\n\n` +
        `Contame qué pasó (pinchazo, demora, control, mecánico, desvío…) y lo registro.`;
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      return reply({
        message: msg,
        flow: "incidencia_fallback",
        received: true,
        commander: decision.decisionId,
      });
    }
    case "pod_force":
    case "pod_force_media": {
      const { imageBuffer, mime } = await mediaBuffers();
      const out = await tryProcesarPod(ev, { texto, log, forzar: true, imageBuffer, mime });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      const msg =
        `Perfecto, vamos con la *constancia de entrega (POD)*.\n\n` +
        `Mandame una *foto clara* del *formulario de entrega* y/o del *producto entregado*. ` +
        `La leo yo y cargo los datos.`;
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      return reply({ message: msg, flow: "pod_fallback", received: true, commander: decision.decisionId });
    }
    case "rendicion_force":
    case "rendicion_force_media": {
      const { imageBuffer, mime } = await mediaBuffers();
      const out = await tryProcesarRendicion(ev, {
        texto: texto || (esFoto ? "comprobante de gasto" : ""),
        log,
        imageBuffer,
        mime,
        forzar: true,
      });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      const msg =
        `Perfecto, vamos con la *rendición de gastos*.\n\n` +
        `Mandame la *foto del ticket/factura* o contame: nafta, peaje, llantas, aceite, remolque, auxilio o arreglo menor.\n` +
        `Queda sujeto a *aprobación humana*.`;
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      return reply({
        message: msg,
        flow: "rendicion_fallback",
        received: true,
        commander: decision.decisionId,
      });
    }
    case "destinos": {
      const out = await tryProcesarDestinos(ev, { texto, log, tieneFoto: esFoto });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      break;
    }
    case "viajes_force": {
      const out = await tryProcesarViajes(ev, { texto, log, conv, forzar: true });
      if (out) return reply({ ...out, received: true, commander: decision.decisionId });
      try {
        const solViajesStore = deps.solViajesStore;
        const pending = await solViajesStore.getSolicitudPendientePorTelefono(ev.from);
        if (!pending) {
          await solViajesStore.crearSolicitud({ telefono: ev.from, nombre: ev.nombre || null });
        }
      } catch (err) {
        log?.warn?.({ err: err.message }, "viajes: no pude abrir solicitud fallback");
      }
      const msg =
        `Perfecto, vamos con tu *viaje*.\n\n` +
        `Pasame origen, destino, toneladas, tipo de carga y fecha/hora de retiro.`;
      await notificarChofer(ev.from, msg, { log, tenant: null }).catch(() => {});
      await convStore
        .appendMensaje(ev.from, { texto: msg, tipo: "text" }, { dir: "out", from: "bot", agente: "viajes", nombre: ev.nombre })
        .catch(() => {});
      return reply({ message: msg, flow: "viajes_fallback", received: true, commander: decision.decisionId });
    }
    case "remitos_ingest":
      return runRemitosIngest();
    case "remitos_audio":
      return runRemitosAudio();
    case "remitos_texto":
      return procesarTextoChofer(ev, tenantCfg, texto, log);
    case "empty":
      return reply({ ok: true, message: "Mensaje vacío, ignorado", commander: decision.decisionId });
    case "ubicacion_sin_pendiente":
      return reply({ flow: "ubicacion_sin_pendiente", commander: decision.decisionId });
    case "noop":
      return reply({ received: true, flow: "noop", commander: decision.decisionId });
    default:
      log?.warn?.({ key, decisionId: decision.decisionId }, "Commander: executorKey desconocido → remitos_texto");
      if (texto) return procesarTextoChofer(ev, tenantCfg, texto, log);
      return reply({ received: true, flow: "commander_unhandled", commander: decision.decisionId });
  }

  if (texto && !esFoto) {
    return procesarTextoChofer(ev, tenantCfg, texto, log);
  }
  return reply({ received: true, flow: "commander_no_out", commander: decision.decisionId });
}
