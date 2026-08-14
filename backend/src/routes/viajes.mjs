import * as viajesStore from "../db/viajes-store.mjs";
import {
  DIAS_LABEL,
  eliminarCamionViajes,
  eliminarChoferViajes,
} from "../db/viajes-flota-store.mjs";
import {
  actualizarCamionFlotaConSync,
  actualizarChoferFlotaConSync,
  crearCamionFlotaConSync,
  crearChoferFlotaConSync,
  listCamionesFlotaEnriquecidos,
  listChoferesFlotaEnriquecidos,
} from "../db/flota-unificada.mjs";
import { VIAJE_ESTADO_LABEL, VIAJE_ESTADOS, VIAJE_TRANSICIONES } from "../../../lib/viajes.mjs";
import { procesarSolicitudViaje } from "../services/viajes-agent.mjs";

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
    hora: row.hora ?? null,
    tipoCarga: row.tipo_carga ?? null,
    tipoUnidad: row.tipo_unidad ?? null,
    chofer: row.chofer,
    telefonoChofer: row.telefono_chofer,
    telefonoCliente: row.telefono_cliente ?? null,
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

  fastify.get("/flota", async () => {
    const [choferes, camiones] = await Promise.all([
      listChoferesFlotaEnriquecidos(),
      listCamionesFlotaEnriquecidos(),
    ]);
    return {
      fuente: "viajes-flota+master",
      choferes,
      camiones,
      resumen: {
        choferes: choferes.length,
        camiones: camiones.length,
        choferesActivos: choferes.filter((c) => c.activo !== false).length,
        camionesActivos: camiones.filter((c) => c.activo !== false).length,
      },
      diasLabel: DIAS_LABEL,
      nota:
        "Flota Viajes: horarios/días locales; identidad (teléfono/patente) unificada con Parámetros",
    };
  });

  fastify.get("/flota/choferes", async () => listChoferesFlotaEnriquecidos());
  fastify.post("/flota/choferes", async (request, reply) => {
    try {
      const row = await crearChoferFlotaConSync(request.body ?? {});
      return reply.code(201).send(row);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.patch("/flota/choferes/:id", async (request, reply) => {
    try {
      const row = await actualizarChoferFlotaConSync(request.params.id, request.body ?? {});
      if (!row) return reply.code(404).send({ error: "Chofer no encontrado" });
      return row;
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.delete("/flota/choferes/:id", async (request, reply) => {
    const ok = eliminarChoferViajes(request.params.id);
    if (!ok) return reply.code(404).send({ error: "Chofer no encontrado" });
    return { ok: true };
  });

  fastify.get("/flota/camiones", async () => listCamionesFlotaEnriquecidos());
  fastify.post("/flota/camiones", async (request, reply) => {
    try {
      const row = await crearCamionFlotaConSync(request.body ?? {});
      return reply.code(201).send(row);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.patch("/flota/camiones/:id", async (request, reply) => {
    try {
      const row = await actualizarCamionFlotaConSync(request.params.id, request.body ?? {});
      if (!row) return reply.code(404).send({ error: "Camión no encontrado" });
      return row;
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
  fastify.delete("/flota/camiones/:id", async (request, reply) => {
    const ok = eliminarCamionViajes(request.params.id);
    if (!ok) return reply.code(404).send({ error: "Camión no encontrado" });
    return { ok: true };
  });

  /** Ingesta automática — email (Gmail webhook / manual demo). */
  fastify.post("/ingest/email", async (request, reply) => {
    const body = request.body ?? {};
    const subject = String(body.subject ?? "").trim();
    const textBody = String(body.body ?? body.text ?? body.texto ?? "").trim();
    const from = String(body.from ?? body.remitente ?? "").trim();
    const texto = [subject, textBody].filter(Boolean).join("\n\n");
    if (!texto) return reply.code(400).send({ error: "Falta body o subject del email" });

    try {
      const out = await procesarSolicitudViaje({
        texto,
        canal: "email",
        remitente: from || "Cliente email",
        notificar: false,
        log: request.log,
      });
      return reply.code(201).send({
        ok: true,
        codigo: out.viaje.codigo,
        viaje: mapViaje(out.viaje),
        parsed: out.parsed,
        asignacion: out.asignacion,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ error: err.message, parsed: err.parsed });
    }
  });

  /** Ingesta automática — WhatsApp (cliente solicita transporte). */
  fastify.post("/ingest/whatsapp", async (request, reply) => {
    const body = request.body ?? {};
    const texto = String(body.texto ?? body.text ?? body.message ?? "").trim();
    const telefono = String(body.telefono ?? body.from ?? body.phone ?? "").trim();
    const remitente = String(body.remitente ?? body.nombre ?? "").trim();
    if (!texto) return reply.code(400).send({ error: "Falta texto del mensaje" });

    try {
      const out = await procesarSolicitudViaje({
        texto,
        canal: "whatsapp",
        remitente: remitente || "Cliente WhatsApp",
        telefono: telefono || undefined,
        tenant: body.tenant,
        log: request.log,
      });
      return reply.code(201).send({
        ok: true,
        codigo: out.viaje.codigo,
        viaje: mapViaje(out.viaje),
        mensajes: out.mensajes,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(err.statusCode || 500).send({ error: err.message, parsed: err.parsed });
    }
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
