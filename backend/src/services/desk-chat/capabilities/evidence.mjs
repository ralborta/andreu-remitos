/**
 * Pack Evidencias — capabilities read-only (POP + POD).
 */
import * as evidenceStore from "../../../db/evidence-store.mjs";
import { comparePopPod, getTripEvidenceSummary } from "../../evidence-service.mjs";
import {
  EVIDENCE_ESTADOS_DIALOG,
  labelEstadoEvidence,
  labelEvidenceType,
} from "../../../../../lib/transport-evidence.mjs";
import { registerCapability } from "../capability-registry.mjs";

function mapRow(row) {
  const type = row.type || "POD";
  return {
    id: row.id,
    type,
    typeLabel: labelEvidenceType(type),
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: labelEstadoEvidence(row.estado),
    chofer: row.chofer_nombre || null,
    viaje: row.viaje_ref || row.trip_id || null,
    destino: row.destino || null,
    reportedQuantities: row.reported_quantities || null,
    observed: Boolean(row.observed),
    dataSource: "real",
  };
}

export function registerEvidenceCapabilities() {
  registerCapability({
    name: "evidence.resumen",
    agentId: "pod",
    domain: "evidence",
    description: "Resumen POP/POD (pendientes, observados, ok, rechazados). Read-only.",
    argsSchema: { type: "object", properties: { type: { enum: ["POP", "POD"] } } },
    readOnly: true,
    async execute(args) {
      const pop = evidenceStore.resumenEvidence({ type: "POP" });
      const pod = evidenceStore.resumenEvidence({ type: "POD" });
      const all = evidenceStore.resumenEvidence({});
      return { pop, pod, all, dataSource: "real" };
    },
  });

  registerCapability({
    name: "evidence.list",
    agentId: "pod",
    domain: "evidence",
    description: "Lista evidencias POP/POD con filtros type, estado, tripId, limit.",
    argsSchema: {
      type: "object",
      properties: {
        type: { enum: ["POP", "POD"] },
        estado: { type: "string" },
        tripId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
    readOnly: true,
    async execute(args) {
      const rows = evidenceStore
        .listEvidence({
          type: args.type,
          estado: args.estado,
          tripId: args.tripId,
          limit: args.limit ?? 20,
        })
        .filter((r) => !EVIDENCE_ESTADOS_DIALOG.has(r.estado))
        .map(mapRow);
      return { count: rows.length, items: rows, entityIds: rows.map((r) => r.id), dataSource: "real" };
    },
  });

  registerCapability({
    name: "evidence.trip",
    agentId: "pod",
    domain: "evidence",
    description: "Resumen evidencias + milestones + comparación POP vs POD de un viaje.",
    argsSchema: {
      type: "object",
      properties: { tripId: { type: "string" } },
      required: ["tripId"],
    },
    readOnly: true,
    async execute(args) {
      const summary = await getTripEvidenceSummary(args.tripId);
      return {
        ...summary,
        pop: summary.pop ? mapRow(summary.pop) : null,
        pod: summary.pod ? mapRow(summary.pod) : null,
        dataSource: "real",
      };
    },
  });
}

export const EVIDENCE_CAPABILITY_NAMES = ["evidence.resumen", "evidence.list", "evidence.trip"];
