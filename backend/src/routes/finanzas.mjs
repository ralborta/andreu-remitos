import fs from "node:fs";
import path from "node:path";
import {
  confirmarFacturaPagar,
  ingestarFacturaPagar,
  listarFacturasFinanzas,
  obtenerArchivoFactura,
  obtenerFacturaFinanzas,
} from "../services/finanzas-facturas.mjs";
import {
  comunicarFactura,
  conciliarCobro,
  ingestarFacturaSistema,
  listarCobrosFinanzas,
  registrarCobroPasarela,
  resumenFinanzas,
} from "../services/finanzas-gestion.mjs";

function pasarelaAutorizada(request) {
  const secret = process.env.FINANZAS_PASARELA_SECRET?.trim();
  if (!secret) return true;
  const got =
    request.headers["x-pasarela-secret"] ||
    request.headers["x-api-key"] ||
    request.query?.secret;
  return String(got || "") === secret || Boolean(request.user);
}

export default async function finanzasRoutes(fastify) {
  fastify.get("/resumen", async () => resumenFinanzas());

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

  fastify.post("/facturas/sistema", async (request, reply) => {
    try {
      const out = await ingestarFacturaSistema(request.body ?? {});
      return reply.code(201).send(out);
    } catch (err) {
      const msg = err?.message || "No se pudo ingresar la factura";
      const code = /Ya existe/.test(msg) ? 409 : 400;
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

  fastify.post("/facturas/:id/comunicar", async (request, reply) => {
    try {
      const out = await comunicarFactura(request.params.id, request.body ?? {});
      return out;
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.get("/cobros", async (request) => {
    const { estado, limit } = request.query ?? {};
    return listarCobrosFinanzas({
      estado,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  });

  fastify.post("/pasarela", async (request, reply) => {
    if (!pasarelaAutorizada(request)) {
      return reply.code(401).send({ error: "Pasarela no autorizada" });
    }
    try {
      const out = await registrarCobroPasarela(request.body ?? {}, { log: request.log });
      return reply.code(201).send(out);
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });

  fastify.post("/cobros/:id/conciliar", async (request, reply) => {
    const facturaId = request.body?.factura_id;
    if (!facturaId) return reply.code(400).send({ error: "Falta factura_id" });
    try {
      const out = await conciliarCobro(request.params.id, facturaId);
      return out;
    } catch (err) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
