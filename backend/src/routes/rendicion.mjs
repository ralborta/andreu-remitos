import * as rendicionStore from "../db/rendicion-store.mjs";
import {
  GASTO_ESTADO_LABEL,
  GASTO_ESTADOS,
  labelCategoria,
  labelEstadoGasto,
  moneyAR,
  RENDICION_CATEGORIA_LABEL,
  RENDICION_CATEGORIAS,
} from "../../../lib/rendicion.mjs";
import { mensajeDecisionGasto } from "../../../lib/rendicion-wa.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";

function mapGasto(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    estado: row.estado,
    estadoLabel: labelEstadoGasto(row.estado),
    categoria: row.categoria,
    categoriaLabel: labelCategoria(row.categoria),
    monto: row.monto,
    montoLabel: row.monto != null ? moneyAR(row.monto) : "—",
    moneda: row.moneda,
    proveedor: row.proveedor,
    fechaComprobante: row.fecha_comprobante,
    descripcion: row.descripcion,
    viajeRef: row.viaje_ref,
    telefono: row.telefono,
    choferNombre: row.chofer_nombre,
    imagenUrl: row.imagen_url,
    notaChofer: row.nota_chofer,
    textoOcr: row.texto_ocr || null,
    notaAprobacion: row.nota_aprobacion,
    aprobadoPor: row.aprobado_por,
    historial: row.historial ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function rendicionRoutes(fastify) {
  fastify.get("/meta", async () => ({
    categorias: RENDICION_CATEGORIAS.map((c) => ({
      id: c,
      label: RENDICION_CATEGORIA_LABEL[c],
    })),
    estados: GASTO_ESTADOS.map((e) => ({ id: e, label: GASTO_ESTADO_LABEL[e] })),
    nota: "Gastos menores sujetos a verificación humana",
  }));

  fastify.get("/resumen", async () => rendicionStore.resumenGastos());

  fastify.get("/", async (request) => {
    const { limit, estado, telefono, q, desde, hasta } = request.query ?? {};
    const rows = await rendicionStore.listGastos({
      limit: limit ? parseInt(limit, 10) : 100,
      estado: estado || undefined,
      telefono: telefono || undefined,
      q: q || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    });
    return rows.map(mapGasto);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await rendicionStore.getGasto(request.params.id);
    if (!row) return reply.code(404).send({ error: "Gasto no encontrado" });
    return mapGasto(row);
  });

  fastify.post("/", async (request, reply) => {
    try {
      const row = await rendicionStore.crearGasto(request.body ?? {});
      return reply.code(201).send(mapGasto(row));
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    const { estado, nota, aprobado_por, notificar = true } = request.body ?? {};
    try {
      const row = await rendicionStore.decidirGasto(request.params.id, {
        estado,
        nota,
        aprobado_por,
      });
      if (!row) return reply.code(404).send({ error: "Gasto no encontrado" });

      if (notificar !== false && row.telefono) {
        const msg = mensajeDecisionGasto(row);
        if (msg) {
          await sendWhatsAppMessage({ number: row.telefono, message: msg }).catch(() => {});
          await convStore
            .appendMensaje(
              row.telefono,
              { texto: msg, tipo: "text", gasto_id: row.id },
              { dir: "out", from: "bot", agente: "rendicion" },
            )
            .catch(() => {});
        }
      }

      return mapGasto(row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
