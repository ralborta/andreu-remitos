import {
  createCampaign,
  createCatalogItem,
  createOffer,
  deleteCampaign,
  deleteCatalogItem,
  deleteEmail,
  deleteOffer,
  generateEmail,
  getCatalog,
  getContenidos,
  getDifusion,
  getOverview,
  getResultados,
  getVisibilidad,
  patchCampaign,
  patchCatalogItem,
  patchEmail,
  patchOffer,
  proposeCampaign,
} from "../services/marketing.mjs";

function sendError(reply, err) {
  const code = err?.statusCode || 500;
  return reply.code(code).send({ error: err?.message || "Error interno" });
}

export default async function marketingRoutes(fastify) {
  fastify.get("/overview", async (_request, reply) => {
    try {
      return await getOverview();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get("/catalog", async (_request, reply) => {
    try {
      return getCatalog();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post("/catalog", async (request, reply) => {
    try {
      const body = request.body ?? {};
      if (!body.name || !body.description) {
        return reply.code(400).send({ error: "Faltan name y description" });
      }
      return reply.code(201).send(createCatalogItem(body));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch("/catalog/:id", async (request, reply) => {
    try {
      return patchCatalogItem(request.params.id, request.body ?? {});
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.delete("/catalog/:id", async (request, reply) => {
    try {
      return deleteCatalogItem(request.params.id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get("/visibilidad", async (_request, reply) => {
    try {
      return await getVisibilidad();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get("/contenidos", async (_request, reply) => {
    try {
      return getContenidos();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get("/difusion", async (_request, reply) => {
    try {
      return getDifusion();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.get("/resultados", async (_request, reply) => {
    try {
      return await getResultados();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post("/campaigns/propose", async (request, reply) => {
    try {
      const body = request.body ?? {};
      if (!body.catalogItemId || !body.goal) {
        return reply.code(400).send({ error: "Faltan catalogItemId y goal" });
      }
      return await proposeCampaign(body);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post("/campaigns", async (request, reply) => {
    try {
      const body = request.body ?? {};
      if (!body.opportunityId && (!body.title || !body.objective)) {
        return reply
          .code(400)
          .send({ error: "title y objective son requeridos (u opportunityId)" });
      }
      return reply.code(201).send(createCampaign(body));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch("/campaigns/:id", async (request, reply) => {
    try {
      return patchCampaign(request.params.id, request.body ?? {});
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.delete("/campaigns/:id", async (request, reply) => {
    try {
      return deleteCampaign(request.params.id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post("/campaigns/:id/generate-email", async (request, reply) => {
    try {
      return generateEmail(request.params.id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.post("/offers", async (request, reply) => {
    try {
      const body = request.body ?? {};
      if (!body.title || !body.description) {
        return reply.code(400).send({ error: "Faltan title y description" });
      }
      return reply.code(201).send(createOffer(body));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch("/offers/:id", async (request, reply) => {
    try {
      return patchOffer(request.params.id, request.body ?? {});
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.delete("/offers/:id", async (request, reply) => {
    try {
      return deleteOffer(request.params.id);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.patch("/emails/:id", async (request, reply) => {
    try {
      return patchEmail(request.params.id, request.body ?? {});
    } catch (err) {
      return sendError(reply, err);
    }
  });

  fastify.delete("/emails/:id", async (request, reply) => {
    try {
      return deleteEmail(request.params.id);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
