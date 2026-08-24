/**
 * Envío WhatsApp + reglas de recordatorio — SOL Tracking Express.
 */
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as trackingStore from "../db/tracking-store.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import {
  isTrackingExpressEnabled,
  isTrackingWhatsAppEnabled,
  trackingWaThresholds,
  isTrackingAllowedForTrip,
} from "../../../lib/tracking/flags.mjs";
import {
  buildTrackingPublicUrl,
  openTrackingToken,
} from "../../../lib/tracking/tokens.mjs";
import { computeTrackingStatus, positionAgeSeconds } from "../../../lib/tracking/status.mjs";
import {
  mensajeTrackingAsignado,
  mensajeTrackingCompletado,
  mensajeTrackingIncidenciaEscalada,
  mensajeTrackingInterrumpido,
  mensajeTrackingLlegadaProxima,
  mensajeTrackingPodPendiente,
  mensajeTrackingRecordatorioInicio,
  mensajeTrackingReabrir,
  mensajeTrackingUbicacionPuntual,
} from "../../../lib/tracking/wa-templates.mjs";

const TEMPLATE_BUILDERS = {
  assigned: mensajeTrackingAsignado,
  start_reminder: mensajeTrackingRecordatorioInicio,
  interrupted: mensajeTrackingInterrumpido,
  reopen: mensajeTrackingReabrir,
  location_ping: mensajeTrackingUbicacionPuntual,
  arrival_near: mensajeTrackingLlegadaProxima,
  pod_pending: mensajeTrackingPodPendiente,
  completed: mensajeTrackingCompletado,
  incident_escalated: mensajeTrackingIncidenciaEscalada,
};

function resolvePhone(viaje, link) {
  return sanitizePhone(viaje?.telefono_chofer || link?.driver_id || "");
}

function resolveTrackingUrl(link) {
  if (!link?.token_sealed) return null;
  const plain = openTrackingToken(link.token_sealed);
  if (!plain) return null;
  return buildTrackingPublicUrl(plain);
}

async function deliverWa(phone, message, { viaje, kind, log } = {}) {
  await sendWhatsAppMessage({ number: phone, message });
  try {
    await convStore.appendMensaje(
      phone,
      { texto: message, tipo: "text", viaje_id: viaje?.id ?? null },
      { dir: "out", from: "bot", agente: "tracking_express", nombre: viaje?.chofer ?? null },
    );
  } catch (err) {
    log?.warn?.({ err: err.message }, "tracking-wa: no se pudo guardar en conversaciones");
  }
  log?.info?.({ phone: phone.slice(-4), kind, viaje: viaje?.codigo }, "tracking-wa: enviado");
}

/**
 * @param {{ linkId?: string, tripId?: string, kind: string, force?: boolean, extra?: object, log?: object }} opts
 */
export async function sendTrackingWhatsApp(opts) {
  if (!isTrackingExpressEnabled() || !isTrackingWhatsAppEnabled()) {
    return { ok: false, skipped: true, reason: "wa_disabled" };
  }

  const kind = String(opts.kind || "");
  if (!TEMPLATE_BUILDERS[kind]) {
    throw Object.assign(new Error(`Plantilla desconocida: ${kind}`), { statusCode: 400 });
  }

  let link = opts.linkId ? trackingStore.getLinkById(opts.linkId) : null;
  if (!link && opts.tripId) {
    link = trackingStore.listLinksByTrip(opts.tripId).find((l) => !l.revoked_at) || null;
  }
  if (!link) {
    throw Object.assign(new Error("Enlace de tracking no encontrado"), { statusCode: 404 });
  }

  const viaje = await viajesStore.getViaje(link.trip_id);
  if (!viaje) {
    throw Object.assign(new Error("Viaje no encontrado"), { statusCode: 404 });
  }

  const phone = resolvePhone(viaje, link);
  if (!phone) {
    throw Object.assign(new Error("El viaje no tiene teléfono de chofer"), { statusCode: 400 });
  }

  const thresholds = trackingWaThresholds();
  if (!opts.force && !trackingStore.claimNotificationSlot(viaje.id, kind, thresholds.cooldownMs)) {
    return { ok: false, skipped: true, reason: "cooldown" };
  }
  if (opts.force) {
    trackingStore.claimNotificationSlot(viaje.id, kind, 0);
  }

  const trackingUrl = resolveTrackingUrl(link);
  if (!trackingUrl && !["completed", "arrival_near", "incident_escalated"].includes(kind)) {
    throw Object.assign(new Error("No se pudo recuperar la URL del enlace"), { statusCode: 500 });
  }

  const builder = TEMPLATE_BUILDERS[kind];
  const message = builder({
    chofer: viaje.chofer,
    viaje,
    trackingUrl,
    ageMinutes: opts.extra?.ageMinutes,
    tipo: opts.extra?.tipo,
    codigo: opts.extra?.codigo,
  });

  try {
    await deliverWa(phone, message, { viaje, kind, log: opts.log });
  } catch (err) {
    opts.log?.warn?.({ err: err.message, kind }, "tracking-wa: fallo envío");
    throw Object.assign(new Error(`WhatsApp: ${err.message}`), { statusCode: 502 });
  }

  trackingStore.patchLinkRecord(link.id, {
    last_wa_at: new Date().toISOString(),
    last_wa_kind: kind,
  });
  trackingStore.appendEventRecord({
    tenantId: link.tenant_id,
    tripId: link.trip_id,
    sessionId: null,
    type: "TRACKING_WA_SENT",
    payload: { waKind: kind, phoneLast4: phone.slice(-4) },
  });

  return { ok: true, kind, phoneLast4: phone.slice(-4), trackingUrl };
}

export async function tickTrackingWhatsApp({ log } = {}) {
  if (!isTrackingExpressEnabled() || !isTrackingWhatsAppEnabled()) {
    return { skipped: true };
  }

  const thresholds = trackingWaThresholds();
  const links = trackingStore.listActiveLinks();
  const stats = {
    startReminders: 0,
    interrupted: 0,
    critical: 0,
    podPending: 0,
    nearArrival: 0,
    scanned: links.length,
  };

  for (const link of links) {
    const viaje = await viajesStore.getViaje(link.trip_id);
    if (!viaje) continue;
    if (["cerrado", "cancelado", "entregado"].includes(viaje.estado)) continue;
    if (!isTrackingAllowedForTrip(viaje).ok) continue;

    const session = trackingStore.getActiveSessionForLink(link.id);
    const state = trackingStore.getTripTrackingState(link.trip_id);
    const phone = resolvePhone(viaje, link);
    if (!phone) continue;

    const lastAt = state?.last_position_at || session?.last_position_at || session?.last_heartbeat_at;
    const ageSec = positionAgeSeconds(lastAt);
    const status = computeTrackingStatus({
      sessionStatus: session?.status || state?.status || "NOT_STARTED",
      lastPositionAt: lastAt,
      lastHeartbeatAt: session?.last_heartbeat_at,
      pageHidden: session?.page_hidden,
      accuracyMeters: state?.accuracy,
    });

    // 1) Link creado / sesión sin start → recordatorio de inicio
    const notStarted =
      !session ||
      !session.started_at ||
      ["NOT_STARTED", "AWAITING_PERMISSION"].includes(session.status);
    if (notStarted) {
      const createdAge = Date.now() - new Date(link.created_at).getTime();
      if (createdAge >= thresholds.startReminderMs) {
        const r = await sendTrackingWhatsApp({
          linkId: link.id,
          kind: "start_reminder",
          log,
        }).catch((err) => ({ ok: false, error: err.message }));
        if (r.ok) stats.startReminders += 1;
      }
      continue;
    }

    // 2) Llegó → POD pendiente
    if (session.status === "ARRIVED") {
      const arrivedAt = session.updated_at || session.last_position_at || session.started_at;
      const arrivedAge = arrivedAt ? Date.now() - new Date(arrivedAt).getTime() : 0;
      if (arrivedAge >= thresholds.podPendingMs) {
        const r = await sendTrackingWhatsApp({
          linkId: link.id,
          kind: "pod_pending",
          log,
        }).catch(() => ({ ok: false }));
        if (r.ok) stats.podPending += 1;
      }
      continue;
    }

    if (["COMPLETED", "CANCELLED", "STOPPED_BY_DRIVER"].includes(session.status)) {
      continue;
    }

    // 3) Geocerca / llegada próxima (evento ya emitido)
    const events = trackingStore.listEventsByTrip(link.trip_id, { limit: 50 });
    const geofence = events.find((e) => e.type === "DESTINATION_GEOFENCE_ENTERED");
    if (geofence && session.status === "ACTIVE") {
      const r = await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "arrival_near",
        log,
      }).catch(() => ({ ok: false }));
      if (r.ok) stats.nearArrival += 1;
    }

    // 4) Tracking interrumpido / crítico
    if (ageSec != null && ageSec * 1000 >= thresholds.criticalMs) {
      trackingStore.appendEventRecord({
        tenantId: link.tenant_id,
        tripId: link.trip_id,
        sessionId: session.id,
        type: "TRACKING_STALE",
        payload: { ageSec, level: "critical" },
      });
      const r = await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "interrupted",
        extra: { ageMinutes: ageSec / 60 },
        log,
      }).catch(() => ({ ok: false }));
      if (r.ok) {
        stats.critical += 1;
        await sendTrackingWhatsApp({
          linkId: link.id,
          kind: "reopen",
          log,
        }).catch(() => {});
      }
      continue;
    }

    if (
      (status === "STALE" ||
        status === "BACKGROUND_SUSPECTED" ||
        (ageSec != null && ageSec * 1000 >= thresholds.staleMs)) &&
      session.status === "ACTIVE"
    ) {
      trackingStore.appendEventRecord({
        tenantId: link.tenant_id,
        tripId: link.trip_id,
        sessionId: session.id,
        type: "TRACKING_STALE",
        payload: { ageSec, status },
      });
      const r = await sendTrackingWhatsApp({
        linkId: link.id,
        kind: "interrupted",
        extra: { ageMinutes: ageSec != null ? ageSec / 60 : null },
        log,
      }).catch(() => ({ ok: false }));
      if (r.ok) stats.interrupted += 1;
    }
  }

  return stats;
}

let _timer = null;

export function startTrackingWhatsAppWatcher(log) {
  if (_timer) return;
  if (!isTrackingExpressEnabled()) {
    log?.info?.("tracking-wa: módulo off — watcher no iniciado");
    return;
  }
  const { pollMs } = trackingWaThresholds();
  const run = () => {
    tickTrackingWhatsApp({ log }).catch((err) => {
      log?.warn?.({ err: err.message }, "tracking-wa: tick falló");
    });
  };
  _timer = setInterval(run, pollMs);
  if (typeof _timer.unref === "function") _timer.unref();
  log?.info?.({ pollMs, wa: isTrackingWhatsAppEnabled() }, "tracking-wa: watcher iniciado");
}
