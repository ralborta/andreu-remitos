import fs from "node:fs";
import {
  mediaMimeFromFilename,
  resolveLocalMediaPath,
} from "../services/chat-media.mjs";

export default async function mediaRoutes(fastify) {
  /** Imágenes persistidas del chat / rendición */
  fastify.get("/local/:filename", async (request, reply) => {
    const abs = resolveLocalMediaPath(request.params.filename);
    if (!abs) return reply.code(404).send({ error: "Archivo no encontrado" });
    return reply
      .type(mediaMimeFromFilename(request.params.filename))
      .header("Cache-Control", "private, max-age=3600")
      .send(fs.createReadStream(abs));
  });

  /** Proxy a archivos temporales del bot Baileys (pueden expirar). */
  fastify.get("/bot/:id", async (request, reply) => {
    const botBase = process.env.BAILEYS_BOT_URL?.trim().replace(/\/$/, "") || "";
    if (!botBase) return reply.code(503).send({ error: "Bot no configurado" });
    const id = String(request.params.id || "").replace(/[^a-fA-F0-9]/g, "");
    if (!id) return reply.code(400).send({ error: "id inválido" });
    try {
      const res = await fetch(`${botBase}/v1/files/${id}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return reply.code(res.status).send({ error: "Media no disponible (expiró o no existe)" });
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || "image/jpeg";
      return reply
        .type(mime)
        .header("Cache-Control", "private, max-age=300")
        .send(buf);
    } catch (err) {
      request.log?.warn?.({ err: err.message }, "media bot proxy");
      return reply.code(502).send({ error: "No pude obtener la media del bot" });
    }
  });
}
