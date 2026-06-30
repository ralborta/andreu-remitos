import { autocompleteAddress, placeDetails } from "../../../lib/geocoding.mjs";
import {
  geocodeInput,
  iniciarValidacionDestino,
} from "../services/destinos.mjs";
import * as destinosStore from "../db/destinos-store.mjs";

function mapDestino(row) {
  if (!row) return null;
  return {
    id: row.id,
    estado: row.estado,
    cliente: row.cliente,
    telefonoCliente: row.telefono_cliente,
    telefonoChofer: row.telefono_chofer,
    formattedAddress: row.formatted_address,
    lat: row.lat,
    lng: row.lng,
    partial: row.partial,
    correccion: row.correccion,
    historial: row.historial ?? [],
    whatsappSent: row.whatsapp_sent ?? row.estado === "esperando_cliente",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

  fastify.get("/", async (request) => {
    const { limit, estado } = request.query;
    const rows = await destinosStore.listDestinos({
      limit: limit ? parseInt(limit, 10) : 50,
      estado: estado || undefined,
    });
    return rows.map(mapDestino);
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await destinosStore.getDestino(request.params.id);
    if (!row) return reply.code(404).send({ error: "Destino no encontrado" });
    return mapDestino(row);
  });

  fastify.post("/geocode", async (request, reply) => {
    const body = request.body ?? {};
    const mode = body.mode === "coordenadas" ? "coordenadas" : "direccion";
    const query = String(body.query ?? "").trim();

    if (!query) {
      return reply.code(400).send({ error: "Falta query" });
    }

    try {
      const result = await geocodeInput({ query, mode, placeId: body.placeId });
      return { ...result, inputRaw: query, mode };
    } catch (err) {
      request.log.error(err);
      const code = err.message.includes("No se encontró") || err.message.includes("inválidas") ? 404 : 500;
      return reply.code(code).send({ error: err.message });
    }
  });

  /** Geocode + envío real WhatsApp al cliente (BuilderBot) */
  fastify.post("/validar", async (request, reply) => {
    try {
      const out = await iniciarValidacionDestino(request.body ?? {}, { log: request.log });
      return reply.code(201).send({
        ...mapDestino(out),
        whatsappSent: true,
        mensajeCliente: out.mensaje_cliente,
      });
    } catch (err) {
      request.log.error(err);
      const code =
        err.message.includes("Falta") || err.message.includes("inválid")
          ? 400
          : err.message.includes("BuilderBot")
            ? 502
            : 500;
      return reply.code(code).send({ error: err.message });
    }
  });
}
