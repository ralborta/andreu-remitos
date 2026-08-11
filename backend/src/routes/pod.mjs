import * as podStore from "../db/pod-store.mjs";
import { notificarDecisionPod } from "../services/pod-agent.mjs";
import { labelEstadoPod, POD_ESTADOS } from "../../../lib/pod.mjs";

function mapPod(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: labelEstadoPod(row.estado),
    chofer: row.chofer_nombre || "—",
    telefono: row.telefono,
    receptor: row.receptor_nombre || "—",
    imagenUrl: row.imagen_url || null,
    viaje: row.viaje_ref || "—",
    destino: row.destino || "—",
    destinoId: row.destino_id || null,
    notaChofer: row.nota_chofer || null,
    textoOcr: row.texto_ocr || null,
    notaBackoffice: row.nota_backoffice || null,
    aprobadoPor: row.aprobado_por || null,
    historial: row.historial || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function podRoutes(fastify) {
  fastify.get("/meta", async () => ({
    estados: POD_ESTADOS.filter((e) => !e.startsWith("esperando")).map((e) => ({
      id: e,
      label: labelEstadoPod(e),
    })),
    nota:
      "POD: constancia de entrega por WhatsApp — receptor + foto. Confirmación en mesa de control.",
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
      .map(mapPod);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await podStore.getPod(request.params.id);
    if (!row) return reply.code(404).send({ error: "POD no encontrado" });
    return mapPod(row);
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    try {
      const estado = request.body?.estado;
      const nota = request.body?.nota;
      const aprobado_por = request.body?.aprobado_por;
      const notificar = request.body?.notificar !== false;
      const updated = await podStore.decidirPod(request.params.id, {
        estado,
        nota,
        aprobado_por,
      });
      if (!updated) return reply.code(404).send({ error: "POD no encontrado" });
      if (notificar) {
        await notificarDecisionPod(updated, { log: request.log });
      }
      return mapPod(updated);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
