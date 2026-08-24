import * as evidenceStore from "../db/evidence-store.mjs";
import {
  decideEvidenceWithSideEffects,
  getTripEvidenceSummary,
  comparePopPod,
} from "../services/evidence-service.mjs";
import { notificarDecisionPod } from "../services/pod-agent.mjs";
import { notificarDecisionPop } from "../services/pop-agent.mjs";
import {
  EVIDENCE_ESTADOS,
  EVIDENCE_ESTADOS_DIALOG,
  EVIDENCE_TYPES,
  labelEstadoEvidence,
  labelEvidenceType,
} from "../../../lib/transport-evidence.mjs";
import { getEvidenceConfig } from "../../../lib/evidence-config.mjs";

function mapEvidence(row) {
  if (!row) return null;
  const type = row.type || "POD";
  return {
    id: row.id,
    type,
    typeLabel: labelEvidenceType(type),
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: labelEstadoEvidence(row.estado),
    tenantId: row.tenant_id || null,
    tripId: row.trip_id || null,
    chofer: row.chofer_nombre || "—",
    telefono: row.telefono,
    receptor: row.receptor_nombre || row.responsable_nombre || "—",
    responsable: row.responsable_nombre || row.receptor_nombre || "—",
    imagenUrl: row.imagen_url || evidenceStore.primaryImage(row),
    attachments: (row.attachments || []).map((a) => ({
      id: a.id,
      url: a.url,
      mimeType: a.mime_type || a.mimeType || null,
      kind: a.kind || "photo",
      createdAt: a.created_at,
    })),
    viaje: row.viaje_ref || row.trip_id || "—",
    origen: row.origen || "—",
    destino: row.destino || "—",
    destinoId: row.destino_id || null,
    reportedQuantities: row.reported_quantities || null,
    expectedQuantities: row.expected_quantities || null,
    condition: row.condition || null,
    observed: Boolean(row.observed),
    differenceNotes: row.difference_notes || null,
    location: row.location || null,
    source: row.source || "whatsapp",
    notaChofer: row.nota_chofer || null,
    textoOcr: row.texto_ocr || null,
    notaBackoffice: row.nota_backoffice || null,
    aprobadoPor: row.aprobado_por || null,
    historial: row.historial || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receivedAt: row.received_at,
    approvedAt: row.approved_at,
  };
}

export default async function evidenceRoutes(fastify) {
  fastify.get("/meta", async () => ({
    types: EVIDENCE_TYPES.map((t) => ({ id: t, label: labelEvidenceType(t) })),
    estados: EVIDENCE_ESTADOS.filter((e) => !EVIDENCE_ESTADOS_DIALOG.has(e)).map((e) => ({
      id: e,
      label: labelEstadoEvidence(e),
    })),
    nota:
      "Evidencias de Transporte — POP (retiro) y POD (entrega). Confirmación en mesa de control.",
  }));

  fastify.get("/config", async (request) => {
    const tenant = request.query?.tenant || null;
    return getEvidenceConfig(tenant);
  });

  fastify.get("/resumen", async (request) => {
    const type = request.query?.type || undefined;
    return evidenceStore.resumenEvidence({ type });
  });

  fastify.get("/", async (request) => {
    const { limit, estado, telefono, type, tripId, tenantId } = request.query ?? {};
    const rows = evidenceStore.listEvidence({
      limit: limit ? Number(limit) : 100,
      estado,
      telefono,
      type,
      tripId,
      tenantId,
    });
    return rows
      .filter((r) => !EVIDENCE_ESTADOS_DIALOG.has(r.estado))
      .map(mapEvidence);
  });

  fastify.get("/trip/:tripId", async (request, reply) => {
    try {
      const summary = await getTripEvidenceSummary(request.params.tripId);
      return {
        ...summary,
        pop: summary.pop ? mapEvidence(summary.pop) : null,
        pod: summary.pod ? mapEvidence(summary.pod) : null,
        comparison: summary.comparison,
        popVsPlan: summary.popVsPlan,
      };
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.get("/compare/:tripId", async (request) => {
    const pop = evidenceStore.getEvidenceByTrip(request.params.tripId, "POP");
    const pod = evidenceStore.getEvidenceByTrip(request.params.tripId, "POD");
    return comparePopPod(pop, pod);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = evidenceStore.getEvidence(request.params.id);
    if (!row) return reply.code(404).send({ error: "Evidencia no encontrada" });
    return mapEvidence(row);
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    try {
      const estado = request.body?.estado;
      const nota = request.body?.nota;
      const aprobado_por = request.body?.aprobado_por;
      const notificar = request.body?.notificar !== false;
      const result = await decideEvidenceWithSideEffects(
        request.params.id,
        { estado, nota, aprobado_por, notificar },
        { log: request.log },
      );
      if (!result?.row) return reply.code(404).send({ error: "Evidencia no encontrada" });
      if (result.notificar) {
        if (result.row.type === "POP") {
          await notificarDecisionPop(result.row, { log: request.log });
        } else {
          await notificarDecisionPod(result.row, { log: request.log });
        }
      }
      return mapEvidence(result.row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}

export { mapEvidence };
