import * as podStore from "../db/pod-store.mjs";
import { decideEvidenceWithSideEffects } from "../services/evidence-service.mjs";
import { notificarDecisionPod } from "../services/pod-agent.mjs";
import { labelEstadoPod, POD_ESTADOS } from "../../../lib/pod.mjs";
import { mapEvidence } from "./evidence.mjs";

export default async function podRoutes(fastify) {
  fastify.get("/meta", async () => ({
    estados: POD_ESTADOS.filter((e) => !e.startsWith("esperando")).map((e) => ({
      id: e,
      label: labelEstadoPod(e),
    })),
    nota:
      "POD: constancia de entrega — alias de /api/evidence?type=POD. Preferir /api/evidence.",
  }));

  fastify.get("/resumen", async () => podStore.resumenPods());

  fastify.get("/", async (request) => {
    const { limit, estado, telefono } = request.query ?? {};
    const rows = await podStore.listPods({
      limit: limit ? Number(limit) : 100,
      estado,
      telefono,
    });
    return rows
      .filter((r) => !String(r.estado || "").startsWith("esperando"))
      .map((r) => {
        const m = mapEvidence(r);
        return {
          id: m.id,
          codigo: m.codigo,
          estado: m.estado,
          estadoLabel: m.estadoLabel,
          chofer: m.chofer,
          telefono: m.telefono,
          receptor: m.receptor,
          imagenUrl: m.imagenUrl,
          viaje: m.viaje,
          destino: m.destino,
          destinoId: m.destinoId,
          notaChofer: m.notaChofer,
          textoOcr: m.textoOcr,
          notaBackoffice: m.notaBackoffice,
          aprobadoPor: m.aprobadoPor,
          historial: m.historial,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
      });
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await podStore.getPod(request.params.id);
    if (!row) return reply.code(404).send({ error: "POD no encontrado" });
    const m = mapEvidence(row);
    return {
      id: m.id,
      codigo: m.codigo,
      estado: m.estado,
      estadoLabel: m.estadoLabel,
      chofer: m.chofer,
      telefono: m.telefono,
      receptor: m.receptor,
      imagenUrl: m.imagenUrl,
      viaje: m.viaje,
      destino: m.destino,
      destinoId: m.destinoId,
      notaChofer: m.notaChofer,
      textoOcr: m.textoOcr,
      notaBackoffice: m.notaBackoffice,
      aprobadoPor: m.aprobadoPor,
      historial: m.historial,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
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
      if (!result?.row) return reply.code(404).send({ error: "POD no encontrado" });
      if (result.notificar) {
        await notificarDecisionPod(result.row, { log: request.log });
      }
      const m = mapEvidence(result.row);
      return {
        id: m.id,
        codigo: m.codigo,
        estado: m.estado,
        estadoLabel: m.estadoLabel,
        chofer: m.chofer,
        telefono: m.telefono,
        receptor: m.receptor,
        imagenUrl: m.imagenUrl,
        viaje: m.viaje,
        destino: m.destino,
        destinoId: m.destinoId,
        notaChofer: m.notaChofer,
        textoOcr: m.textoOcr,
        notaBackoffice: m.notaBackoffice,
        aprobadoPor: m.aprobadoPor,
        historial: m.historial,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
