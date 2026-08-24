/**
 * Servicio de dominio — evidencias POP/POD, comparación y milestones.
 */
import * as evidenceStore from "../db/evidence-store.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import * as incidenciasStore from "../db/incidencias-store.mjs";
import * as fileStore from "../db/file-store.mjs";
import {
  milestoneFromEvidence,
  normalizeQuantities,
} from "../../../lib/transport-evidence.mjs";
import { getEvidenceConfig, requiresPop, requiresPod } from "../../../lib/evidence-config.mjs";

function qtyField(q, key) {
  if (!q || q[key] == null) return null;
  const n = Number(q[key]);
  return Number.isFinite(n) ? n : null;
}

export function compareQuantities(expected, reported) {
  const diffs = [];
  if (!expected || !reported) return { diffs, hasDifference: false };
  for (const k of ["pallets", "cajas", "bultos"]) {
    const exp = qtyField(expected, k);
    const rep = qtyField(reported, k);
    if (exp != null && rep != null && exp !== rep) {
      diffs.push({ field: k, expected: exp, reported: rep, delta: rep - exp });
    }
  }
  return { diffs, hasDifference: diffs.length > 0 };
}

export function comparePopPod(pop, pod) {
  if (!pop?.reported_quantities || !pod?.reported_quantities) {
    return { diffs: [], hasDifference: false, summary: null };
  }
  const { diffs, hasDifference } = compareQuantities(
    pop.reported_quantities,
    pod.reported_quantities,
  );
  const summary = hasDifference
    ? diffs.map((d) => `${d.delta > 0 ? "+" : ""}${d.delta} ${d.field}`).join(", ")
    : null;
  return { diffs, hasDifference, summary };
}

export async function syncMilestonesForTrip(tripId) {
  const viaje = await viajesStore.getViaje(tripId);
  const tenant = viaje?.tenant || null;
  const cfg = getEvidenceConfig(tenant);
  const pop = evidenceStore.getEvidenceByTrip(tripId, "POP");
  const pod = evidenceStore.getEvidenceByTrip(tripId, "POD");

  const popStatus = pop
    ? milestoneFromEvidence(pop)
    : cfg.require_pop
      ? "pending"
      : "not_required";
  const podStatus = pod
    ? milestoneFromEvidence(pod)
    : cfg.require_pod
      ? "pending"
      : "not_required";

  evidenceStore.setTripMilestone(tripId, "pop", {
    status: popStatus,
    evidence_id: pop?.id || null,
    codigo: pop?.codigo || null,
  });
  evidenceStore.setTripMilestone(tripId, "pod", {
    status: podStatus,
    evidence_id: pod?.id || null,
    codigo: pod?.codigo || null,
  });

  return evidenceStore.getTripMilestones(tripId);
}

export async function getTripEvidenceSummary(tripId) {
  const viaje = await viajesStore.getViaje(tripId);
  const pop = evidenceStore.getEvidenceByTrip(tripId, "POP");
  const pod = evidenceStore.getEvidenceByTrip(tripId, "POD");
  const milestones = await syncMilestonesForTrip(tripId);
  const comparison = comparePopPod(pop, pod);
  const popVsPlan = pop
    ? compareQuantities(parsePlannedQuantities(viaje), pop.reported_quantities)
    : { diffs: [], hasDifference: false };
  const remitoQty = await loadRemitoQuantities(viaje);
  const remitoVsPop =
    remitoQty && pop?.reported_quantities
      ? compareQuantities(remitoQty, pop.reported_quantities)
      : { diffs: [], hasDifference: false };

  if (comparison.hasDifference && pop && pod) {
    await createDifferenceIncidencia({
      evidence: pod,
      viaje,
      diffSummary: comparison.summary || "diferencia POP vs POD",
      compareKind: "pop_vs_pod",
    }).catch(() => null);
  }

  return {
    tripId,
    viaje: viaje
      ? { id: viaje.id, codigo: viaje.codigo, estado: viaje.estado, tenant: viaje.tenant }
      : null,
    config: getEvidenceConfig(viaje?.tenant),
    milestones,
    pop,
    pod,
    comparison,
    popVsPlan,
    remitoQuantities: remitoQty,
    remitoVsPop,
  };
}

async function loadRemitoQuantities(viaje) {
  const ids = viaje?.remito_ids || [];
  if (!ids.length) return null;
  const q = {};
  for (const id of ids.slice(0, 5)) {
    try {
      const r = await fileStore.getRemito(id);
      if (!r) continue;
      const text = JSON.stringify(r.datos || r);
      const pal = text.match(/(\d+)\s*pallet/i);
      const caj = text.match(/(\d+)\s*caja/i);
      const bul = text.match(/(\d+)\s*bulto/i);
      if (pal) q.pallets = (q.pallets || 0) + Number(pal[1]);
      if (caj) q.cajas = (q.cajas || 0) + Number(caj[1]);
      if (bul) q.bultos = (q.bultos || 0) + Number(bul[1]);
    } catch {
      /* skip */
    }
  }
  return Object.keys(q).length ? q : null;
}

export async function createDifferenceIncidencia({ evidence, viaje, diffSummary, compareKind }) {
  if (!evidence?.telefono || !diffSummary) return null;
  const rows = await incidenciasStore.listIncidencias({ telefono: evidence.telefono, limit: 30 });
  const tag = `evidence:${evidence.id}`;
  if (rows.some((r) => (r.resumen || "").includes(tag))) return null;

  return incidenciasStore.crearIncidencia({
    telefono: evidence.telefono,
    chofer_nombre: evidence.chofer_nombre,
    origen: "agente",
    estado: "nueva",
    tipo: "anomalia",
    criticidad: "media",
    resumen: `${tag} · Diferencia ${evidence.type} (${compareKind}): ${diffSummary}`,
    viaje_ref: viaje?.codigo || evidence.viaje_ref || evidence.trip_id,
    imagen_url: evidence.imagen_url || null,
  });
}

function parsePlannedQuantities(viaje) {
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

export async function decideEvidenceWithSideEffects(
  id,
  { estado, nota, aprobado_por, notificar } = {},
  { log } = {},
) {
  const row = evidenceStore.getEvidence(id);
  if (!row) return null;

  const updated = evidenceStore.decideEvidence(id, { estado, nota, aprobado_por });
  const tripId = updated.trip_id || updated.viaje_ref;
  let viaje = null;
  if (tripId) {
    viaje = await viajesStore.getViaje(tripId);
    await syncMilestonesForTrip(viaje?.id || tripId);

    if (updated.estado === "ok" && viaje) {
      try {
        if (updated.type === "POP" && viaje.estado === "asignado") {
          await viajesStore.cambiarEstadoViaje(viaje.id, "en_curso");
        }
        if (updated.type === "POD" && viaje.estado === "en_curso") {
          await viajesStore.cambiarEstadoViaje(viaje.id, "entregado");
        }
      } catch (err) {
        log?.warn?.({ err: err.message, tripId: viaje.id }, "evidence: transición viaje omitida");
      }
    }
  }

  return { row: updated, viaje, notificar: notificar !== false };
}

export async function resolveActiveViajeForChofer(telefono) {
  const { sanitizePhone } = await import("../../../lib/builderbot-webhook.mjs");
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  const viajes = await viajesStore.listViajes({ limit: 50 });
  const activos = viajes.filter((v) =>
    ["asignado", "en_curso"].includes(v.estado),
  );
  return (
    activos.find(
      (v) =>
        String(v.telefono_chofer || "").replace(/\D/g, "").endsWith(phone.slice(-10)) ||
        String(v.telefono_chofer || "").includes(phone),
    ) || activos[0] ||
    null
  );
}

export function inferEvidenceTypeFromContext({ viaje, texto, hasImage }) {
  const t = String(texto || "").toLowerCase();
  const popHints = /\b(cargu[eé]|retir[eé]|pickup|pop|origen|dep[oó]sito)\b/i;
  const podHints = /\b(entregu[eé]|pod|receptor|destino|firm[aó])\b/i;

  if (viaje?.estado === "asignado" && (popHints.test(t) || hasImage)) return "POP";
  if (viaje?.estado === "en_curso" && (podHints.test(t) || hasImage)) return "POD";
  if (popHints.test(t)) return "POP";
  if (podHints.test(t)) return "POD";
  if (viaje?.estado === "asignado") return "POP";
  if (viaje?.estado === "en_curso") return "POD";
  return "POD";
}

export async function markObservedIfDifference(evidenceId, { expected, reported, notes, viaje }) {
  const cmp = compareQuantities(expected, reported);
  if (!cmp.hasDifference) return null;
  const note =
    notes || cmp.diffs.map((d) => `${d.field}: ${d.expected}→${d.reported} (${d.delta})`).join("; ");
  const prev = evidenceStore.getEvidence(evidenceId);
  const updated = evidenceStore.updateEvidence(evidenceId, {
    estado: "observado",
    observed: true,
    difference_notes: note,
    historial_push: `Diferencia detectada: ${note}`,
  });
  if (prev) {
    await createDifferenceIncidencia({
      evidence: updated,
      viaje,
      diffSummary: note,
      compareKind: "planificado",
    }).catch(() => null);
  }
  return updated;
}

export { requiresPop, requiresPod, getEvidenceConfig, normalizeQuantities };
