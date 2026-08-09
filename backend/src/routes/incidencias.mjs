import * as incidenciasStore from "../db/incidencias-store.mjs";
import {
  consultarChoferIncidencia,
} from "../services/incidencias-agent.mjs";
import {
  calcularSlaLabel,
  codigoVisible,
  labelCriticidad,
  labelEstadoIncidencia,
  labelTipo,
  INCIDENCIA_ABBR_LABEL,
  INCIDENCIA_CRITICIDAD_LABEL,
  INCIDENCIA_CRITICIDADES,
  INCIDENCIA_ESTADO_LABEL,
  INCIDENCIA_ESTADOS,
  INCIDENCIA_TIPO_ABBR,
  INCIDENCIA_TIPO_LABEL,
  INCIDENCIA_TIPOS,
} from "../../../lib/incidencias.mjs";
import { mensajeDecisionIncidencia } from "../../../lib/incidencias-wa.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";

function mapIncidencia(row) {
  if (!row) return null;
  const codigo = codigoVisible(row);
  const abbr = row.tipo ? INCIDENCIA_TIPO_ABBR[row.tipo] || "OT" : null;
  return {
    id: row.id,
    codigo,
    tipoAbbr: abbr,
    tipoAbbrLabel: abbr ? INCIDENCIA_ABBR_LABEL[abbr] || null : null,
    estado: row.estado,
    estadoLabel: labelEstadoIncidencia(row.estado),
    tipo: row.tipo,
    tipoLabel: row.tipo ? labelTipo(row.tipo) : "—",
    criticidad: row.criticidad,
    criticidadLabel: row.criticidad ? labelCriticidad(row.criticidad) : "—",
    chofer: row.chofer_nombre || "—",
    telefono: row.telefono,
    canal: row.canal === "whatsapp" ? "WhatsApp" : row.canal || "WhatsApp",
    origen: row.origen || "chofer",
    viaje: row.viaje_ref || "—",
    causa: row.causa,
    resumen: row.resumen,
    destinoId: row.destino_id || null,
    lat: row.lat,
    lng: row.lng,
    imagenUrl: row.imagen_url || null,
    notaInterna: row.nota_interna,
    sla: calcularSlaLabel(row),
    historial: row.historial ?? [],
    mensajes: row.mensajes ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function incidenciasRoutes(fastify) {
  fastify.get("/meta", async () => ({
    tipos: INCIDENCIA_TIPOS.map((t) => ({ id: t, label: INCIDENCIA_TIPO_LABEL[t] })),
    criticidades: INCIDENCIA_CRITICIDADES.map((c) => ({
      id: c,
      label: INCIDENCIA_CRITICIDAD_LABEL[c],
    })),
    estados: INCIDENCIA_ESTADOS.filter((e) => e !== "esperando_causa").map((e) => ({
      id: e,
      label: INCIDENCIA_ESTADO_LABEL[e],
    })),
    nota:
      "Incidencias en ruta: el chofer reporta por WhatsApp o el agente consulta proactivamente",
  }));

  fastify.get("/resumen", async () => incidenciasStore.resumenIncidencias());

  fastify.get("/", async (request) => {
    const { limit, estado, telefono } = request.query ?? {};
    const rows = await incidenciasStore.listIncidencias({
      limit: limit ? parseInt(limit, 10) : 100,
      estado: estado || undefined,
      telefono: telefono || undefined,
    });
    return rows.map(mapIncidencia);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await incidenciasStore.getIncidencia(request.params.id);
    if (!row) return reply.code(404).send({ error: "Incidencia no encontrada" });
    return mapIncidencia(row);
  });

  /** Simula detección / consulta proactiva al chofer. */
  fastify.post("/consultar-chofer", async (request, reply) => {
    try {
      const out = await consultarChoferIncidencia({
        ...(request.body ?? {}),
        log: request.log,
      });
      return {
        ok: true,
        incidencia: mapIncidencia(out.incidencia),
        mensaje: out.mensaje,
      };
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    const { estado, nota, notificar = true } = request.body ?? {};
    try {
      const row = await incidenciasStore.decidirIncidencia(request.params.id, {
        estado,
        nota,
      });
      if (!row) return reply.code(404).send({ error: "Incidencia no encontrada" });

      if (notificar !== false && row.telefono) {
        const msg = mensajeDecisionIncidencia(row);
        if (msg) {
          await sendWhatsAppMessage({ number: row.telefono, message: msg }).catch(() => {});
          await convStore
            .appendMensaje(
              row.telefono,
              { texto: msg, tipo: "text", incidencia_id: row.id },
              { dir: "out", from: "bot", agente: "incidencias" },
            )
            .catch(() => {});
        }
      }

      return mapIncidencia(row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
