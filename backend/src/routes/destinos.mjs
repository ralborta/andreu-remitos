import {
  autocompleteAddress,
  geocodeAddress,
  parseCoordInput,
  placeDetails,
  reverseGeocode,
} from "../../../lib/geocoding.mjs";

export default async function destinosRoutes(fastify) {
  fastify.get("/autocomplete", async (request, reply) => {
    const { input } = request.query;
    if (!input?.trim()) return [];
    try {
      return await autocompleteAddress(input);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get("/place", async (request, reply) => {
    const { placeId } = request.query;
    if (!placeId?.trim()) {
      return reply.code(400).send({ error: "Falta placeId" });
    }
    try {
      return await placeDetails(placeId);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.post("/geocode", async (request, reply) => {
    const body = request.body ?? {};
    const mode = body.mode === "coordenadas" ? "coordenadas" : "direccion";
    const query = String(body.query ?? "").trim();

    if (!query) {
      return reply.code(400).send({ error: "Falta query" });
    }

    try {
      if (mode === "coordenadas") {
        const coords = parseCoordInput(query);
        if (!coords) {
          return reply.code(400).send({ error: "Coordenadas inválidas (usá lat, lng)" });
        }
        const result = await reverseGeocode(coords.lat, coords.lng);
        return { ...result, inputRaw: query, mode };
      }

      if (body.placeId) {
        const result = await placeDetails(body.placeId);
        return { ...result, inputRaw: query, mode };
      }

      const result = await geocodeAddress(query);
      return { ...result, inputRaw: query, mode };
    } catch (err) {
      request.log.error(err);
      const code = err.message.includes("No se encontró") ? 404 : 500;
      return reply.code(code).send({ error: err.message });
    }
  });
}
