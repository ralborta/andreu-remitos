import {
  createItem,
  deleteItem,
  getItem,
  importChoferes,
  listCollection,
  normalizePatente,
  normalizePhone,
  updateItem,
} from "../db/master-data-store.mjs";
import { adminOnly } from "../plugins/auth-guard.mjs";

const admin = { preHandler: adminOnly };

const TENANTS = new Set(["tsb", "beraldi", "corina"]);
const UNIDAD_TIPOS = new Set(["tractor", "acoplado"]);
const LOC_TIPOS = new Set(["origen", "destino", "ambos"]);

function requireTenant(tenant) {
  const t = String(tenant || "").toLowerCase();
  if (!TENANTS.has(t)) return null;
  return t;
}

function listRoute(collection) {
  return async (request) => {
    const { tenant, activo, tipo } = request.query;
    return listCollection(collection, {
      tenant: requireTenant(tenant) ?? undefined,
      activo: activo === "true" ? true : undefined,
      tipo: tipo || undefined,
    });
  };
}

function createRoute(collection, validate) {
  return async (request, reply) => {
    const body = request.body ?? {};
    const err = await validate?.(body);
    if (err) return reply.code(400).send({ error: err });
    const row = await createItem(collection, body);
    return reply.code(201).send(row);
  };
}

function patchRoute(collection, validate) {
  return async (request, reply) => {
    const body = request.body ?? {};
    const err = await validate?.(body, true);
    if (err) return reply.code(400).send({ error: err });
    const row = await updateItem(collection, request.params.id, body);
    if (!row) return reply.code(404).send({ error: "No encontrado" });
    return row;
  };
}

function deleteRoute(collection) {
  return async (request, reply) => {
    const ok = await deleteItem(collection, request.params.id);
    if (!ok) return reply.code(404).send({ error: "No encontrado" });
    return { ok: true };
  };
}

function validateChofer(body, partial) {
  if (!partial && !requireTenant(body.tenant)) return "tenant requerido (tsb | beraldi)";
  if (!partial && !String(body.nombre || "").trim()) return "nombre requerido";
  if (body.tenant && !requireTenant(body.tenant)) return "tenant inválido";
  if (body.telefono !== undefined && body.telefono !== null) {
    body.telefono = normalizePhone(body.telefono) || null;
  }
  return null;
}

function validateUnidad(body, partial) {
  if (!partial && !requireTenant(body.tenant)) return "tenant requerido";
  if (!partial && !UNIDAD_TIPOS.has(body.tipo)) return "tipo requerido (tractor | acoplado)";
  if (body.tipo && !UNIDAD_TIPOS.has(body.tipo)) return "tipo inválido";
  if (!partial && !String(body.patente || "").trim()) return "patente requerida";
  if (body.patente) body.patente = normalizePatente(body.patente);
  if (body.tenant && !requireTenant(body.tenant)) return "tenant inválido";
  return null;
}

function validateLocalidad(body, partial) {
  if (!partial && !requireTenant(body.tenant)) return "tenant requerido";
  if (!partial && !String(body.nombre || "").trim()) return "nombre requerido";
  if (body.tipo && !LOC_TIPOS.has(body.tipo)) return "tipo inválido (origen | destino | ambos)";
  if (body.tenant && !requireTenant(body.tenant)) return "tenant inválido";
  return null;
}

async function validateDistancia(body, partial) {
  if (!partial && !requireTenant(body.tenant)) return "tenant requerido";
  if (!partial && !body.origen_id) return "origen_id requerido";
  if (!partial && !body.destino_id) return "destino_id requerido";
  if (body.km !== undefined && (!Number.isFinite(Number(body.km)) || Number(body.km) < 0)) {
    return "km inválido";
  }
  if (body.origen_id) {
    const o = await getItem("localidades", body.origen_id);
    if (!o) return "origen_id no existe";
  }
  if (body.destino_id) {
    const d = await getItem("localidades", body.destino_id);
    if (!d) return "destino_id no existe";
  }
  if (body.tenant && !requireTenant(body.tenant)) return "tenant inválido";
  if (body.km !== undefined) body.km = Math.round(Number(body.km) * 100) / 100;
  return null;
}

export default async function parametrosRoutes(fastify) {
  // Choferes
  fastify.get("/choferes", listRoute("choferes"));
  fastify.post("/choferes", { ...admin, handler: createRoute("choferes", validateChofer) });
  fastify.patch("/choferes/:id", { ...admin, handler: patchRoute("choferes", validateChofer) });
  fastify.delete("/choferes/:id", { ...admin, handler: deleteRoute("choferes") });
  fastify.post("/choferes/import", {
    ...admin,
    handler: async (request, reply) => {
    const { tenant, items, replace } = request.body ?? {};
    const t = requireTenant(tenant);
    if (!t) return reply.code(400).send({ error: "tenant requerido" });
    if (!Array.isArray(items)) return reply.code(400).send({ error: "items[] requerido" });
    const result = await importChoferes(items, { tenant: t, replace: !!replace });
    return result;
    },
  });

  // Unidades (tractores + acoplados)
  fastify.get("/unidades", listRoute("unidades"));
  fastify.post("/unidades", { ...admin, handler: createRoute("unidades", validateUnidad) });
  fastify.patch("/unidades/:id", { ...admin, handler: patchRoute("unidades", validateUnidad) });
  fastify.delete("/unidades/:id", { ...admin, handler: deleteRoute("unidades") });

  // Localidades
  fastify.get("/localidades", listRoute("localidades"));
  fastify.post("/localidades", { ...admin, handler: createRoute("localidades", validateLocalidad) });
  fastify.patch("/localidades/:id", { ...admin, handler: patchRoute("localidades", validateLocalidad) });
  fastify.delete("/localidades/:id", { ...admin, handler: deleteRoute("localidades") });

  // Distancias
  fastify.get("/distancias", async (request) => {
    const { tenant } = request.query;
    const distancias = await listCollection("distancias", {
      tenant: requireTenant(tenant) ?? undefined,
    });
    const locs = await listCollection("localidades", {
      tenant: requireTenant(tenant) ?? undefined,
    });
    const byId = Object.fromEntries(locs.map((l) => [l.id, l]));
    return distancias.map((d) => ({
      ...d,
      origen_nombre: byId[d.origen_id]?.nombre ?? "—",
      destino_nombre: byId[d.destino_id]?.nombre ?? "—",
    }));
  });
  fastify.post("/distancias", { ...admin, handler: createRoute("distancias", validateDistancia) });
  fastify.patch("/distancias/:id", { ...admin, handler: patchRoute("distancias", validateDistancia) });
  fastify.delete("/distancias/:id", { ...admin, handler: deleteRoute("distancias") });
}
