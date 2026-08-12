/**
 * Framework local de Data Capabilities (read-only).
 * No es Tool Registry global ni Event Bus — packs por dominio desk-chat.
 */

/** @type {Map<string, object>} */
const REGISTRY = new Map();

/**
 * @typedef {object} CapabilityDef
 * @property {string} name
 * @property {string} agentId
 * @property {string} domain
 * @property {string} description
 * @property {object} argsSchema
 * @property {object} resultSchema
 * @property {string[]} requiredPermissions
 * @property {number} timeoutMs
 * @property {true} readOnly
 * @property {(args: object, ctx: object) => Promise<object>} execute
 */

/**
 * @param {CapabilityDef} def
 */
export function registerCapability(def) {
  if (!def?.name || typeof def.execute !== "function") {
    throw new Error("capability_invalida");
  }
  if (def.readOnly !== true) {
    throw new Error(`capability_debe_ser_readonly:${def.name}`);
  }
  REGISTRY.set(def.name, {
    name: def.name,
    agentId: String(def.agentId),
    domain: String(def.domain || def.agentId),
    description: String(def.description || ""),
    argsSchema: def.argsSchema || { type: "object", properties: {}, additionalProperties: false },
    resultSchema: def.resultSchema || { type: "object" },
    requiredPermissions: Array.isArray(def.requiredPermissions) ? def.requiredPermissions : [],
    timeoutMs: Number(def.timeoutMs) > 0 ? Number(def.timeoutMs) : 8000,
    readOnly: true,
    execute: def.execute,
  });
}

export function getCapability(name) {
  return REGISTRY.get(String(name)) || null;
}

export function listCapabilities({ agentId } = {}) {
  const all = [...REGISTRY.values()].map((c) => ({
    name: c.name,
    agentId: c.agentId,
    domain: c.domain,
    description: c.description,
    argsSchema: c.argsSchema,
    resultSchema: c.resultSchema,
    requiredPermissions: c.requiredPermissions,
    timeoutMs: c.timeoutMs,
    readOnly: true,
  }));
  if (!agentId) return all;
  if (agentId === "commander") return all;
  return all.filter((c) => c.agentId === agentId);
}

export function allowedCapabilityNames(agentId) {
  return new Set(listCapabilities({ agentId }).map((c) => c.name));
}

/**
 * Catalogo compacto para el system prompt del plan LLM.
 */
export function capabilityCatalogForPrompt(agentId) {
  return listCapabilities({ agentId }).map((c) => ({
    name: c.name,
    description: c.description,
    argsSchema: c.argsSchema,
  }));
}

function userHasPermissions(user, required) {
  if (!required?.length) return true;
  const perms = new Set(
    []
      .concat(user?.permissions || [])
      .concat(user?.scopes || [])
      .concat(user?.roles || [])
      .map(String),
  );
  // Mesa web autenticada JWT: sin lista explícita → permitir lectura desk.
  if (perms.size === 0 && user?.id) return true;
  if (perms.has("admin") || perms.has("operador") || perms.has("*")) return true;
  return required.every((p) => perms.has(p));
}

/**
 * Valida + ejecuta una capability con timeout.
 */
export async function executeCapability(name, rawArgs, ctx = {}) {
  const started = Date.now();
  const def = getCapability(name);
  if (!def) {
    return {
      ok: false,
      capability: name,
      error: "capability_desconocida",
      latencyMs: Date.now() - started,
      result: null,
    };
  }

  if (ctx.agentId && ctx.agentId !== "commander" && def.agentId !== ctx.agentId) {
    return {
      ok: false,
      capability: name,
      error: "capability_fuera_de_dominio",
      latencyMs: Date.now() - started,
      result: null,
    };
  }

  if (!userHasPermissions(ctx.user, def.requiredPermissions)) {
    return {
      ok: false,
      capability: name,
      error: "permiso_denegado",
      latencyMs: Date.now() - started,
      result: null,
    };
  }

  const { validateArgsAgainstSchema } = await import("./schemas.mjs");
  const validated = validateArgsAgainstSchema(rawArgs ?? {}, def.argsSchema);
  if (!validated.ok) {
    return {
      ok: false,
      capability: name,
      error: "args_invalidos",
      argErrors: validated.errors,
      latencyMs: Date.now() - started,
      result: null,
    };
  }

  try {
    const result = await Promise.race([
      def.execute(validated.value, {
        tenant: ctx.tenant ?? null,
        user: ctx.user ?? null,
        workingSet: ctx.workingSet ?? null,
        log: ctx.log,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("capability_timeout")), def.timeoutMs),
      ),
    ]);
    return {
      ok: true,
      capability: name,
      agentId: def.agentId,
      readOnly: true,
      latencyMs: Date.now() - started,
      result: result ?? null,
    };
  } catch (err) {
    ctx.log?.warn?.({ err: err.message, capability: name }, "desk-chat capability error");
    return {
      ok: false,
      capability: name,
      error: err.message || "capability_error",
      latencyMs: Date.now() - started,
      result: null,
    };
  }
}

/**
 * Ejecuta varias capabilities; independientes en paralelo.
 */
export async function executeCapabilitiesParallel(queries, ctx = {}) {
  return Promise.all(
    (queries || []).map((q) => executeCapability(q.capability, q.args, ctx)),
  );
}

/** Solo tests: limpia registry. */
export function _resetRegistryForTests() {
  REGISTRY.clear();
}
