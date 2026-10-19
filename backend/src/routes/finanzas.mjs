import fs from "node:fs";
import path from "node:path";
import {
  confirmarFacturaPagar,
  ingestarFacturaPagar,
  listarFacturasFinanzas,
  obtenerArchivoFactura,
  obtenerFacturaFinanzas,
} from "../services/finanzas-facturas.mjs";

export default async function finanzasRoutes(fastify) {
  fastify.get("/facturas", async (request) => {
    const { tipo, limit } = request.query ?? {};
    return listarFacturasFinanzas({
      tipo,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  });

  fastify.post("/facturas/ingest", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "Falta archivo (multipart field: file)" });
    }
    const buffer = await data.toBuffer();
    try {
      const out = await ingestarFacturaPagar(buffer, {
        filename: data.filename,
        mime: data.mimetype,
        log: request.log,
      });
      return reply.code(201).send(out);
    } catch (err) {
      request.log.error(err);
      const msg = err?.message || "No se pudo leer la factura";
      const code = /Ya está cargada/.test(msg) ? 409 : 500;
      return reply.code(code).send({ error: msg });
    }
  });

  fastify.get("/facturas/:id/archivo", async (request, reply) => {
    const row = await obtenerArchivoFactura(request.params.id);
    if (!row?.archivo_path || !fs.existsSync(row.archivo_path)) {
      return reply.code(404).send({ error: "Archivo no encontrado" });
    }
    const ext = path.extname(row.archivo_path).toLowerCase();
    const mime =
      row.archivo_mime ||
      (ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg");
    return reply.type(mime).send(fs.createReadStream(row.archivo_path));
  });

  fastify.get("/facturas/:id", async (request, reply) => {
    const row = await obtenerFacturaFinanzas(request.params.id);
    if (!row) return reply.code(404).send({ error: "Factura no encontrada" });
    return row;
  });

  fastify.patch("/facturas/:id", async (request, reply) => {
    try {
      const row = await confirmarFacturaPagar(request.params.id, request.body ?? {});
      if (!row) return reply.code(404).send({ error: "Factura no encontrada" });
      return row;
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
