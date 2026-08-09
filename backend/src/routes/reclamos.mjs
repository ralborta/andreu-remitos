import * as reclamosStore from "../db/reclamos-store.mjs";
import {
  calcularSlaLabel,
  labelCriticidad,
  labelEstadoReclamo,
  labelMotivo,
  RECLAMO_CRITICIDAD_LABEL,
  RECLAMO_CRITICIDADES,
  RECLAMO_ESTADO_LABEL,
  RECLAMO_ESTADOS,
  RECLAMO_MOTIVO_LABEL,
  RECLAMO_MOTIVOS,
} from "../../../lib/reclamos.mjs";
import { mensajeDecisionReclamo } from "../../../lib/reclamos-wa.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";

function mapReclamo(row) {
  if (!row) return null;
  return {
    id: row.id,
    estado: row.estado,
    estadoLabel: labelEstadoReclamo(row.estado),
    motivo: row.motivo,
    motivoLabel: row.motivo ? labelMotivo(row.motivo) : "—",
    criticidad: row.criticidad,
    criticidadLabel: row.criticidad ? labelCriticidad(row.criticidad) : "—",
    cliente: row.cliente || row.nombre || "—",
    telefono: row.telefono,
    canal: row.canal === "whatsapp" ? "WhatsApp" : row.canal || "WhatsApp",
    viaje: row.viaje_ref || "—",
    remito: row.remito_ref || null,
    pedido: row.pedido_ref || null,
    resumen: row.resumen,
    detalle: row.detalle,
    imagenUrl: row.imagen_url || null,
    escaladoA: row.escalado_a,
    notaInterna: row.nota_interna,
    sla: calcularSlaLabel(row),
    historial: row.historial ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function reclamosRoutes(fastify) {
  fastify.get("/meta", async () => ({
    motivos: RECLAMO_MOTIVOS.map((m) => ({ id: m, label: RECLAMO_MOTIVO_LABEL[m] })),
    criticidades: RECLAMO_CRITICIDADES.map((c) => ({
      id: c,
      label: RECLAMO_CRITICIDAD_LABEL[c],
    })),
    estados: RECLAMO_ESTADOS.filter((e) => e !== "recolectando").map((e) => ({
      id: e,
      label: RECLAMO_ESTADO_LABEL[e],
    })),
    nota: "Reclamos de clientes por WhatsApp · diálogo 100% IA",
  }));

  fastify.get("/resumen", async () => reclamosStore.resumenReclamos());

  fastify.get("/", async (request) => {
    const { limit, estado, telefono } = request.query ?? {};
    const rows = await reclamosStore.listReclamos({
      limit: limit ? parseInt(limit, 10) : 100,
      estado: estado || undefined,
      telefono: telefono || undefined,
    });
    return rows.map(mapReclamo);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await reclamosStore.getReclamo(request.params.id);
    if (!row) return reply.code(404).send({ error: "Reclamo no encontrado" });
    return mapReclamo(row);
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    const { estado, nota, aprobado_por, notificar = true } = request.body ?? {};
    try {
      const row = await reclamosStore.decidirReclamo(request.params.id, {
        estado,
        nota,
        aprobado_por,
      });
      if (!row) return reply.code(404).send({ error: "Reclamo no encontrado" });

      if (notificar !== false && row.telefono) {
        const msg = mensajeDecisionReclamo(row);
        if (msg) {
          await sendWhatsAppMessage({ number: row.telefono, message: msg }).catch(() => {});
          await convStore
            .appendMensaje(
              row.telefono,
              { texto: msg, tipo: "text", reclamo_id: row.id },
              { dir: "out", from: "bot", agente: "reclamos" },
            )
            .catch(() => {});
        }
      }

      return mapReclamo(row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
