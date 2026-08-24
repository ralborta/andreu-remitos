import * as tracking from "../services/tracking-service.mjs";
import {
  isTrackingExpressEnabled,
  isTrackingWhatsAppEnabled,
  getTrackingPilotGateSnapshot,
} from "../../../lib/tracking/flags.mjs";
import fs from "node:fs";
import {
  resolveTrackingMediaPath,
  trackingMediaMime,
} from "../services/tracking-media.mjs";

function mapError(reply, err) {
  const code = err.statusCode || 500;
  const body = { error: err.code || "error", message: err.message };
  if (err.linkStatus) body.linkStatus = err.linkStatus;
  if (err.existingLinkId) body.existingLinkId = err.existingLinkId;
  return reply.code(code).send(body);
}

export default async function trackingRoutes(fastify) {
  fastify.get("/meta", async () => ({
    enabled: isTrackingExpressEnabled(),
    module: "SOL Tracking Express",
    version: "0.5.0",
    note: "MVP piloto — allowlist + métricas (Fase 5)",
    whatsappEnabled: isTrackingWhatsAppEnabled(),
    pilot: getTrackingPilotGateSnapshot(),
  }));

  fastify.get("/pilot/metrics", async (request, reply) => {
    try {
      return await tracking.getPilotMetrics();
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.get("/pilot/gate", async () => tracking.getPilotGate());

  // ─── Autenticado (mesa / torre) ───────────────────────────────────────────

  fastify.post("/links", async (request, reply) => {
    try {
      const { tripId, expiresAt, sendWhatsApp } = request.body ?? {};
      if (!tripId) return reply.code(400).send({ error: "tripId requerido" });
      const result = await tracking.createTrackingLink({
        tripId: String(tripId),
        createdBy: request.user?.id || request.user?.username || null,
        expiresAt,
        sendWhatsApp: Boolean(sendWhatsApp),
      });
      return result;
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/links/:id/send", async (request, reply) => {
    try {
      const kind = String(request.body?.kind || "assigned");
      const force = request.body?.force !== false;
      const result = await tracking.sendLinkWhatsApp(request.params.id, { kind, force });
      return result;
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/links/:id/revoke", async (request, reply) => {
    try {
      const row = await tracking.revokeTrackingLink(request.params.id);
      return { ok: true, link: { id: row.id, revokedAt: row.revoked_at } };
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.get("/trips/active", async (request, reply) => {
    try {
      const tenantId = request.query?.tenant ? String(request.query.tenant) : null;
      const rows = await tracking.listActiveTrackingTrips({ tenantId });
      return { trips: rows };
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.get("/trips/:tripId/live", async (request, reply) => {
    try {
      const data = await tracking.getTripLive(request.params.tripId);
      return data;
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.get("/trips/:tripId/history", async (request, reply) => {
    try {
      const data = await tracking.getTripHistory(request.params.tripId);
      return data;
    } catch (err) {
      return mapError(reply, err);
    }
  });

  // ─── Público (chofer, token en URL) ───────────────────────────────────────

  fastify.get("/public/media/:filename", async (request, reply) => {
    const abs = resolveTrackingMediaPath(request.params.filename);
    if (!abs) return reply.code(404).send({ error: "Archivo no encontrado" });
    return reply
      .type(trackingMediaMime(request.params.filename))
      .header("Cache-Control", "private, max-age=86400")
      .send(fs.createReadStream(abs));
  });

  fastify.get("/public/:token", async (request, reply) => {
    try {
      const result = await tracking.getPublicTracking(request.params.token, request);
      if (result.linkStatus !== "valid" && !isTrackingExpressEnabled()) {
        return reply.code(404).send({ error: "feature_disabled" });
      }
      return result;
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/consent", async (request, reply) => {
    try {
      return await tracking.acceptConsent(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/start", async (request, reply) => {
    try {
      return await tracking.startTracking(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/heartbeat", async (request, reply) => {
    try {
      return await tracking.recordHeartbeat(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/positions/batch", async (request, reply) => {
    try {
      return await tracking.ingestPositionsBatch(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/incidents", async (request, reply) => {
    try {
      return await tracking.reportIncident(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/arrive", async (request, reply) => {
    try {
      return await tracking.confirmArrival(request.params.token, request);
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/pod", async (request, reply) => {
    try {
      return await tracking.submitPod(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/stop", async (request, reply) => {
    try {
      return await tracking.stopTracking(request.params.token, request, request.body ?? {});
    } catch (err) {
      return mapError(reply, err);
    }
  });

  fastify.post("/public/:token/upload", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: "file_requerido", message: "Enviá multipart field: file" });
      }
      const buffer = await data.toBuffer();
      const mime = data.mimetype || "image/jpeg";
      return await tracking.uploadTrackingPhoto(request.params.token, request, { buffer, mime });
    } catch (err) {
      return mapError(reply, err);
    }
  });
}
