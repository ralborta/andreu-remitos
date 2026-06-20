import { ingestarRemito, listarRemitos, obtenerRemito, actualizarCampos } from "../services/remitos.mjs";

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
    const { tenant, estado, limit } = request.query;
    return listarRemitos({
      tenant,
      estado,
      limit: limit ? parseInt(limit, 10) : 50,
    });
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
}
