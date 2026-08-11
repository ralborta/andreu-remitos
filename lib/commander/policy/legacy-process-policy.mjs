/**
 * LegacyProcessPolicy — stickiness AS-IS 1:1 (solo decisión, sin side-effects).
 * Orden alineado a backend/src/routes/webhooks.mjs (bloque early binds).
 * No añade heurísticas nuevas: reutiliza las mismas funciones parece* existentes.
 */

import * as reclamosStore from "../../../backend/src/db/reclamos-store.mjs";
import * as incidenciasStore from "../../../backend/src/db/incidencias-store.mjs";
import * as podStore from "../../../backend/src/db/pod-store.mjs";
import * as destinosStore from "../../../backend/src/db/destinos-store.mjs";
import * as solViajesStore from "../../../backend/src/db/viajes-solicitudes-store.mjs";
import { extractCodigoReclamo, pareceConsultaEstadoReclamo } from "../../reclamos.mjs";
import { pareceIncidenciaEnRuta } from "../../incidencias-wa.mjs";
import { pareceRendicionGasto } from "../../rendicion-wa.mjs";
import { parecePod } from "../../pod-wa.mjs";
import { pareceQuiereRemito } from "../../wa-intent-router.mjs";
import { finalizeDecision } from "../trace/log-trace.mjs";

function dec(partial) {
  return {
    handled: true,
    decision: finalizeDecision({
      ...partial,
      intentSource: partial.intentSource ?? "policy",
      trace: { branch: "legacy_process_policy", notes: partial.notes ?? [] },
    }),
  };
}

/**
 * @param {object} input
 * @param {object} input.message
 * @param {object} input.actor
 * @param {object} [input.conversation]
 * @param {object} [input.log]
 * @param {object} [input.ev] evento raw para hints
 */
export async function evaluateLegacyProcessPolicy(input) {
  const { message, actor, log } = input;
  const subjectId = message.subjectId;
  const texto = String(message.text ?? "").trim();
  const esFoto = Boolean(message.hasMedia && message.mediaKind === "image");
  const mediaKind = message.mediaKind;

  if (!subjectId) return { handled: false, reason: "no_subject" };

  // 1. Reclamo pendiente
  const pendingReclamo = await reclamosStore.getReclamoPendientePorTelefono(subjectId);
  if (pendingReclamo && (texto || esFoto)) {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "reclamos",
      action: "run_agent",
      forceAgent: true,
      processType: "reclamo",
      processId: pendingReclamo.id ?? null,
      executorHints: { executorKey: "reclamos_force", legacyFlow: "reclamo_pending" },
      notes: ["sticky:reclamo_pending"],
    });
  }

  // 2. Consulta estado reclamo
  if (
    texto &&
    !esFoto &&
    !pendingReclamo &&
    (extractCodigoReclamo(texto) || pareceConsultaEstadoReclamo(texto))
  ) {
    return dec({
      intent: "reclamo",
      confidence: 0.9,
      agentId: "reclamos",
      action: "run_agent",
      forceAgent: true,
      executorHints: { executorKey: "reclamos_force", legacyFlow: "reclamo_consulta" },
      notes: ["sticky:reclamo_consulta"],
    });
  }

  // 3. Incidencia pendiente
  const pendingIncidencia = await incidenciasStore.getIncidenciaPendientePorTelefono(subjectId);
  if (pendingIncidencia && (texto || esFoto)) {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "incidencias",
      action: "run_agent",
      forceAgent: true,
      processType: "incidencia",
      processId: pendingIncidencia.id ?? null,
      executorHints: { executorKey: "incidencias_force", legacyFlow: "incidencia_pending" },
      notes: ["sticky:incidencia_pending"],
    });
  }

  // 4. POD pendiente
  const pendingPod = await podStore.getPodPendientePorTelefono(subjectId);
  if (pendingPod && (texto || esFoto)) {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "pod",
      action: "run_agent",
      forceAgent: true,
      processType: "pod_caso",
      processId: pendingPod.id ?? null,
      executorHints: { executorKey: "pod_force", legacyFlow: "pod_pending" },
      notes: ["sticky:pod_pending"],
    });
  }

  // 5. Incidencia por texto (chofer operativo)
  if (
    actor.isChoferOperativo &&
    !pendingIncidencia &&
    texto &&
    !esFoto &&
    pareceIncidenciaEnRuta(texto)
  ) {
    return dec({
      intent: "incidencia",
      confidence: 0.85,
      intentSource: "heuristica",
      agentId: "incidencias",
      action: "run_agent",
      forceAgent: true,
      executorHints: { executorKey: "incidencias_force", legacyFlow: "incidencia_parece" },
      notes: ["sticky:incidencia_parece"],
    });
  }

  // 6. POD por IA (texto) — misma condición AS-IS
  if (actor.isChoferRemitos && !pendingPod && texto && !pareceQuiereRemito(texto)) {
    const quierePod = await parecePod(texto, { log });
    if (quierePod) {
      return dec({
        intent: "pod",
        confidence: 0.85,
        intentSource: "ia",
        agentId: "pod",
        action: "run_agent",
        forceAgent: true,
        executorHints: { executorKey: "pod_force", legacyFlow: "pod_parece" },
        notes: ["sticky:pod_parece"],
      });
    }
  }

  // 7. Atajo remito pedir foto
  if (texto && !esFoto && actor.isChoferRemitos && pareceQuiereRemito(texto)) {
    return dec({
      intent: "remito",
      confidence: 1,
      intentSource: "heuristica",
      agentId: "remitos",
      action: "run_agent",
      forceAgent: true,
      suggestedReply:
        "Perfecto 👍 Enviame una *foto clara del remito* (que se vea bien la guía y los datos).",
      executorHints: { executorKey: "remitos_pedir_foto", legacyFlow: "remito_pedir_foto" },
      notes: ["sticky:remito_pedir_foto"],
    });
  }

  // 8. Rendición
  const quiereRendicion =
    actor.isChoferRemitos && !pareceQuiereRemito(texto) && pareceRendicionGasto(texto);
  if (quiereRendicion) {
    return dec({
      intent: "rendicion",
      confidence: 0.8,
      intentSource: "heuristica",
      agentId: "rendicion",
      action: "run_agent",
      forceAgent: true,
      executorHints: { executorKey: "rendicion_force", legacyFlow: "rendicion_parece" },
      notes: ["sticky:rendicion"],
    });
  }

  // 9. Destinos pendientes (detectar; executor corre tryProcesarDestinos)
  const pendingCliente = await destinosStore.getDestinoPendientePorTelefono(subjectId);
  if (pendingCliente) {
    if (!(esFoto && !message.location && !texto)) {
      return dec({
        intent: "continue_process",
        confidence: 1,
        agentId: "destinos",
        action: "continue_process",
        processType: "destino_confirmacion",
        processId: pendingCliente.id ?? null,
        executorHints: { executorKey: "destinos", legacyFlow: "destinos_cliente" },
        notes: ["sticky:destinos_cliente"],
      });
    }
  }
  const pendingChofer = await destinosStore.getDestinoActivoPorChofer(subjectId);
  if (pendingChofer && !esFoto && !message.hasMedia) {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "destinos",
      action: "continue_process",
      processType: "destino_eta_chofer",
      processId: pendingChofer.id ?? null,
      executorHints: { executorKey: "destinos", legacyFlow: "destinos_chofer" },
      notes: ["sticky:destinos_chofer"],
    });
  }

  // 10. Viaje pending
  const pendingViaje = await solViajesStore.getSolicitudPendientePorTelefono(subjectId);
  if (pendingViaje) {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "viajes",
      action: "continue_process",
      forceAgent: true,
      processType: "viaje_solicitud",
      processId: pendingViaje.id ?? null,
      executorHints: { executorKey: "viajes_force", legacyFlow: "viaje_pending" },
      notes: ["sticky:viaje_pending"],
    });
  }

  // 11. Media: caption POD/rendición (parity bloque media)
  if (mediaKind === "image" && actor.isChoferRemitos) {
    const caption = texto;
    if (caption && !pareceQuiereRemito(caption)) {
      const quierePod = await parecePod(caption, { log });
      if (quierePod) {
        return dec({
          intent: "pod",
          confidence: 0.85,
          agentId: "pod",
          action: "run_agent",
          forceAgent: true,
          executorHints: { executorKey: "pod_force_media", legacyFlow: "pod_media" },
          notes: ["sticky:pod_media"],
        });
      }
    }
    if (pareceRendicionGasto(caption) && caption) {
      return dec({
        intent: "rendicion",
        confidence: 0.8,
        agentId: "rendicion",
        action: "run_agent",
        forceAgent: true,
        executorHints: { executorKey: "rendicion_force_media", legacyFlow: "rendicion_media" },
        notes: ["sticky:rendicion_media"],
      });
    }
    if (pendingCliente) {
      return dec({
        intent: "continue_process",
        confidence: 1,
        agentId: "destinos",
        action: "ask_clarification",
        suggestedReply:
          "Recibí una imagen, pero estoy esperando que confirmes el *destino*.\n" +
          "Respondé *SÍ*, escribí la dirección corregida, o enviá tu ubicación 📌",
        processId: pendingCliente.id ?? null,
        executorHints: {
          executorKey: "destinos_foto_bloqueada",
          legacyFlow: "destinos_esperando_texto",
        },
        notes: ["sticky:destinos_foto"],
      });
    }
  }

  // 12. Audio → flujo remito audio (parity)
  if (mediaKind === "audio" || mediaKind === "voice_note") {
    return dec({
      intent: "continue_process",
      confidence: 1,
      agentId: "remitos",
      action: "run_agent",
      executorHints: { executorKey: "remitos_audio", legacyFlow: "audio" },
      notes: ["sticky:audio_remitos"],
    });
  }

  // 13. Foto de remito (default media image sin sticky previo)
  if (mediaKind === "image") {
    return dec({
      intent: "remito",
      confidence: 0.9,
      agentId: "remitos",
      action: "run_agent",
      executorHints: { executorKey: "remitos_ingest", legacyFlow: "foto_remito" },
      notes: ["media:remitos_ingest"],
    });
  }

  return { handled: false, reason: "no_sticky" };
}
