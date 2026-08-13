/**
 * Schemas del Desk Chat Runtime (plan LLM + args de capabilities).
 * Validación determinística en backend — el LLM no escribe queries libres.
 */

/** Tipos de plan admitidos (Pass 1). */
export const PLAN_TYPES = Object.freeze([
  "query",
  "clarify",
  "out_of_domain",
  "chitchat",
]);

/** Working set referencial (sin dumps). */
export function emptyWorkingSet(entityType = null) {
  return {
    entityType: entityType || null,
    entityIds: [],
    filters: {},
    lastGoal: null,
    lastCapability: null,
    label: null,
    agentId: null,
    domains: {},
    relations: [],
  };
}

function normalizeDomainSlice(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entityIds = Array.isArray(raw.entityIds) ? raw.entityIds.map(String).slice(0, 40) : [];
  return {
    agentId: raw.agentId != null ? String(raw.agentId) : null,
    capability: raw.capability != null ? String(raw.capability) : null,
    entityType: raw.entityType != null ? String(raw.entityType) : null,
    entityIds,
    filters: raw.filters && typeof raw.filters === "object" ? { ...raw.filters } : {},
    goal: raw.goal != null ? String(raw.goal) : null,
  };
}

function normalizeRelations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).map((r) => ({
    fromDomain: r?.fromDomain != null ? String(r.fromDomain) : null,
    toDomain: r?.toDomain != null ? String(r.toDomain) : null,
    field: r?.field != null ? String(r.field) : null,
    fromId: r?.fromId != null ? String(r.fromId) : null,
    fromCodigo: r?.fromCodigo != null ? String(r.fromCodigo) : null,
    toIds: Array.isArray(r?.toIds) ? r.toIds.map(String).slice(0, 40) : [],
    relatedCount: Number.isFinite(Number(r?.relatedCount)) ? Number(r.relatedCount) : (r?.toIds?.length || 0),
    verified: r?.verified === true,
  }));
}

/**
 * Normaliza workingSet legacy `{ podIds }` → forma referencial multi-dominio.
 */
export function normalizeWorkingSet(raw, fallbackEntityType = null) {
  if (!raw || typeof raw !== "object") return emptyWorkingSet(fallbackEntityType);
  const entityType =
    raw.entityType != null
      ? String(raw.entityType)
      : Array.isArray(raw.podIds)
        ? "pod"
        : fallbackEntityType;
  const entityIds = Array.isArray(raw.entityIds)
    ? raw.entityIds.map(String)
    : Array.isArray(raw.podIds)
      ? raw.podIds.map(String)
      : [];
  const domains = {};
  if (raw.domains && typeof raw.domains === "object") {
    for (const [k, v] of Object.entries(raw.domains)) {
      const slice = normalizeDomainSlice(v);
      if (slice) domains[String(k)] = slice;
    }
  }
  return {
    entityType: entityType || null,
    entityIds,
    filters: raw.filters && typeof raw.filters === "object" ? { ...raw.filters } : {},
    lastGoal: raw.lastGoal != null ? String(raw.lastGoal) : null,
    lastCapability: raw.lastCapability != null ? String(raw.lastCapability) : null,
    label: raw.label != null ? String(raw.label) : null,
    agentId: raw.agentId != null ? String(raw.agentId) : fallbackEntityType,
    domains,
    relations: normalizeRelations(raw.relations),
  };
}

/** Compat: exponer podIds si entityType=pod (UI/traces viejos). */
export function workingSetForStore(ws) {
  const n = normalizeWorkingSet(ws);
  const out = { ...n };
  if (n.entityType === "pod") out.podIds = [...n.entityIds];
  return out;
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Valida args contra un schema JSON-like mínimo:
 * { type:"object", properties:{...}, required?:[], additionalProperties?:false }
 */
export function validateArgsAgainstSchema(args, schema) {
  const errors = [];
  if (!schema || schema.type !== "object") {
    return { ok: false, errors: ["schema_invalido"], value: null };
  }
  const input = args == null ? {} : args;
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["args_deben_ser_objeto"], value: null };
  }

  const props = schema.properties || {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  const additional = schema.additionalProperties !== false;

  const out = {};
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) {
      if (!additional) errors.push(`propiedad_no_permitida:${key}`);
      continue;
    }
  }

  for (const key of required) {
    if (input[key] === undefined || input[key] === null || input[key] === "") {
      errors.push(`faltante:${key}`);
    }
  }

  for (const [key, propSchema] of Object.entries(props)) {
    if (input[key] === undefined) continue;
    const v = input[key];
    const coerced = coerceProp(v, propSchema, key, errors);
    if (coerced !== undefined) out[key] = coerced;
  }

  if (errors.length) return { ok: false, errors, value: null };
  return { ok: true, errors: [], value: out };
}

function coerceProp(v, propSchema, key, errors) {
  const t = propSchema?.type;
  if (v === null && propSchema.nullable) return null;

  if (t === "string") {
    if (typeof v !== "string" && typeof v !== "number") {
      errors.push(`tipo:${key}:string`);
      return undefined;
    }
    const s = String(v).trim();
    if (propSchema.enum && !propSchema.enum.includes(s)) {
      errors.push(`enum:${key}`);
      return undefined;
    }
    if (propSchema.minLength != null && s.length < propSchema.minLength) {
      errors.push(`minLength:${key}`);
      return undefined;
    }
    if (propSchema.maxLength != null && s.length > propSchema.maxLength) {
      errors.push(`maxLength:${key}`);
      return undefined;
    }
    return s;
  }

  if (t === "integer" || t === "number") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      errors.push(`tipo:${key}:number`);
      return undefined;
    }
    const intish = t === "integer" ? Math.trunc(n) : n;
    if (propSchema.minimum != null && intish < propSchema.minimum) {
      errors.push(`minimum:${key}`);
      return undefined;
    }
    if (propSchema.maximum != null && intish > propSchema.maximum) {
      errors.push(`maximum:${key}`);
      return undefined;
    }
    return intish;
  }

  if (t === "boolean") {
    if (typeof v === "boolean") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    errors.push(`tipo:${key}:boolean`);
    return undefined;
  }

  if (t === "array") {
    if (!Array.isArray(v)) {
      errors.push(`tipo:${key}:array`);
      return undefined;
    }
    const itemType = propSchema.items?.type || "string";
    return v.map((item, i) => {
      if (itemType === "string") return String(item);
      if (itemType === "integer" || itemType === "number") return Number(item);
      errors.push(`tipo:${key}[${i}]`);
      return item;
    });
  }

  if (t === "object") {
    if (!isPlainObject(v)) {
      errors.push(`tipo:${key}:object`);
      return undefined;
    }
    return v;
  }

  return v;
}

/**
 * Normaliza y valida el plan Pass 1 del LLM.
 * @param {unknown} raw
 * @param {{ allowedCapabilities: Set<string> }} ctx
 */
export function normalizePlan(raw, { allowedCapabilities }) {
  const errors = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ["plan_no_objeto"], plan: null };
  }

  const type = String(raw.type || "").trim();
  if (!PLAN_TYPES.includes(type)) {
    errors.push(`type_invalido:${type || "(vacío)"}`);
  }

  const goal = raw.goal != null ? String(raw.goal).trim() : "";
  const workingSetOp = ["replace", "filter", "keep", "clear"].includes(raw.workingSetOp)
    ? raw.workingSetOp
    : "replace";
  const needsSynthesis = raw.needsSynthesis !== false;

  const queriesIn = Array.isArray(raw.queries) ? raw.queries : [];
  const queries = [];
  for (let i = 0; i < queriesIn.length; i++) {
    const q = queriesIn[i];
    if (!isPlainObject(q)) {
      errors.push(`query_${i}_invalida`);
      continue;
    }
    const capability = String(q.capability || "").trim();
    if (!capability) {
      errors.push(`query_${i}_sin_capability`);
      continue;
    }
    if (allowedCapabilities && !allowedCapabilities.has(capability)) {
      errors.push(`capability_no_autorizada:${capability}`);
      continue;
    }
    queries.push({
      capability,
      args: isPlainObject(q.args) ? q.args : {},
      agentId: q.agentId != null ? String(q.agentId) : undefined,
    });
  }

  if (type === "query" && queries.length === 0) {
    errors.push("query_sin_capabilities");
  }

  if (errors.length) return { ok: false, errors, plan: null };

  return {
    ok: true,
    errors: [],
    plan: {
      type,
      goal,
      queries,
      workingSetOp,
      needsSynthesis,
      clarifyQuestion:
        type === "clarify" && raw.clarifyQuestion
          ? String(raw.clarifyQuestion)
          : null,
    },
  };
}

/**
 * Normaliza respuesta Pass 2.
 */
export function normalizeAnswer(raw) {
  if (!isPlainObject(raw)) return null;
  const reply = String(raw.reply || raw.text || "").trim();
  if (!reply) return null;
  const entityIds = Array.isArray(raw.entityIds)
    ? raw.entityIds.map(String)
    : Array.isArray(raw.workingPodIds)
      ? raw.workingPodIds.map(String)
      : Array.isArray(raw.citedIds)
        ? raw.citedIds.map(String)
        : [];
  return {
    reply,
    entityIds,
    label: raw.label != null ? String(raw.label) : null,
    citedIds: Array.isArray(raw.citedIds) ? raw.citedIds.map(String) : entityIds,
  };
}
