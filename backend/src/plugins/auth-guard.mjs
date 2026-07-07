import {
  canDeleteRemitos,
  extractSessionToken,
  isPublicApiPath,
  verifySessionToken,
} from "../../../lib/auth.mjs";
import { getUserById, toPublicUser } from "../db/users-store.mjs";

/** Hook global: valida JWT en rutas /api/* (excepto públicas). */
export async function registerAuthGuard(app) {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (isPublicApiPath(pathname, request.method)) return;
    if (!pathname.startsWith("/api/")) return;

    const token = extractSessionToken(request);
    if (!token) {
      return reply.code(401).send({ error: "No autenticado" });
    }

    try {
      const payload = await verifySessionToken(token);
      const row = await getUserById(payload.id);
      if (!row || row.activo === false) {
        return reply.code(401).send({ error: "Sesión inválida" });
      }
      request.user = toPublicUser(row);
    } catch {
      return reply.code(401).send({ error: "Sesión inválida o expirada" });
    }
  });
}

export async function adminOnly(request, reply) {
  if (!request.user) {
    return reply.code(401).send({ error: "No autenticado" });
  }
  if (request.user.rol !== "administrador") {
    return reply.code(403).send({ error: "Solo administradores" });
  }
}

export async function deleteRemitoOnly(request, reply) {
  if (!request.user) {
    return reply.code(401).send({ error: "No autenticado" });
  }
  if (!canDeleteRemitos(request.user)) {
    return reply.code(403).send({ error: "No tenés permiso para eliminar remitos" });
  }
}
