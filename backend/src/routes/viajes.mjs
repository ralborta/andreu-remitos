import * as viajesStore from "../db/viajes-store.mjs";
import { VIAJE_ESTADO_LABEL, VIAJE_ESTADOS, VIAJE_TRANSICIONES } from "../../../lib/viajes.mjs";

function mapViaje(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    estado: row.estado,
    estadoLabel: VIAJE_ESTADO_LABEL[row.estado] ?? row.estado,
    tenant: row.tenant,
    cliente: row.cliente,
    origen: row.origen,
    destino: row.destino,
    carga: row.carga,
    fecha: row.fecha,
    chofer: row.chofer,
    telefonoChofer: row.telefono_chofer,
    tractor: row.tractor,
    semi: row.semi,
    notas: row.notas,
    remitoIds: row.remito_ids ?? [],
    destinoValidacionId: row.destino_validacion_id,
    tmsId: row.tms_id,
    tmsSyncStatus: row.tms_sync_status ?? "none",
    tmsSyncedAt: row.tms_synced_at,
    historial: row.historial ?? [],
    transiciones: VIAJE_TRANSICIONES[row.estado] ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function viajesRoutes(fastify) {
  fastify.get("/meta", async () => ({
    estados: VIAJE_ESTADOS.map((e) => ({ id: e, label: VIAJE_ESTADO_LABEL[e] })),
    transiciones: VIAJE_TRANSICIONES,
    tms: {
      enabled: String(process.env.TMS_ENABLED || "").toLowerCase() === "true",
      note: "Conector opcional; Andreu opera solo si TMS_ENABLED no está activo",
    },
  }));

  fastify.get("/", async (request) => {
    const { limit, estado, tenant } = request.query ?? {};
    const rows = await viajesStore.listViajes({
      limit: limit ? parseInt(limit, 10) : 100,
      estado: estado || undefined,
      tenant: tenant || undefined,
    });
    return rows.map(mapViaje);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await viajesStore.getViaje(request.params.id);
    if (!row) return reply.code(404).send({ error: "Viaje no encontrado" });
    return mapViaje(row);
  });

  fastify.post("/", async (request, reply) => {
    try {
      const row = await viajesStore.crearViaje(request.body ?? {});
      return reply.code(201).send(mapViaje(row));
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.patch("/:id", async (request, reply) => {
    try {
      const row = await viajesStore.actualizarViaje(request.params.id, request.body ?? {});
      if (!row) return reply.code(404).send({ error: "Viaje no encontrado" });
      return mapViaje(row);
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.post("/:id/estado", async (request, reply) => {
    const estado = String(request.body?.estado ?? "").trim();
    if (!estado) return reply.code(400).send({ error: "Falta estado" });
    try {
      const row = await viajesStore.cambiarEstadoViaje(request.params.id, estado);
      if (!row) return reply.code(404).send({ error: "Viaje no encontrado" });
      return mapViaje(row);
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  fastify.delete("/:id", async (request, reply) => {
    const ok = await viajesStore.eliminarViaje(request.params.id);
    if (!ok) return reply.code(404).send({ error: "Viaje no encontrado" });
    return { ok: true };
  });
}
