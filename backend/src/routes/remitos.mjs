import fs from "node:fs";
import path from "node:path";
import { ingestarRemito, listarRemitos, obtenerRemito, actualizarCampos, procesarRemitosBatch, cambiarTenantRemito, eliminarRemito, reprocesarRemito } from "../services/remitos.mjs";
import { deleteRemitoOnly } from "../plugins/auth-guard.mjs";

export default async function remitosRoutes(fastify) {
  fastify.post("/ingest", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "Falta archivo (multipart field: file)" });
    }

    const buffer = await data.toBuffer();
    const telefono = data.fields.telefono?.value;
    const tenant = data.fields.tenant?.value;

    try {
      const out = await ingestarRemito(buffer, {
        filename: data.filename,
        telefono,
        tenantForzado: tenant,
      });
      return reply.code(201).send(out);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/", async (request) => {
    const { tenant, estado, pendientes, limit } = request.query;
    return listarRemitos({
      tenant,
      estado,
      pendientes,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  });

  fastify.post("/procesar", async (request, reply) => {
    const { ids, tenant } = request.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: "Se requiere ids: string[]" });
    }
    return procesarRemitosBatch(ids, tenant);
  });

  fastify.get("/:id/imagen", async (request, reply) => {
    const row = await obtenerRemito(request.params.id);
    if (!row?.imagen_path || !fs.existsSync(row.imagen_path)) {
      return reply.code(404).send({ error: "Imagen no encontrada" });
    }
    const ext = path.extname(row.imagen_path).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
    return reply.type(mime).send(fs.createReadStream(row.imagen_path));
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await obtenerRemito(request.params.id);
    if (!row) return reply.code(404).send({ error: "Remito no encontrado" });
    return row;
  });

  fastify.patch("/:id/campos", async (request, reply) => {
    const row = await actualizarCampos(request.params.id, request.body);
    if (!row) return reply.code(404).send({ error: "Remito no encontrado" });
    return row;
  });

  fastify.post("/:id/reprocesar", async (request, reply) => {
    try {
      const row = await reprocesarRemito(request.params.id);
      if (!row) return reply.code(404).send({ error: "Remito no encontrado" });
      return row;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.patch("/:id/tenant", async (request, reply) => {
    const { tenant } = request.body ?? {};
    if (!tenant) return reply.code(400).send({ error: "tenant requerido" });
    try {
      const row = await cambiarTenantRemito(request.params.id, tenant);
      if (!row) return reply.code(404).send({ error: "Remito no encontrado" });
      return row;
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.delete("/:id", { preHandler: deleteRemitoOnly }, async (request, reply) => {
    const out = await eliminarRemito(request.params.id);
    if (!out) return reply.code(404).send({ error: "Remito no encontrado" });
    return out;
  });
}
