/**
 * Configuración POP/POD por tenant (§6).
 * Env: SOL_EVIDENCE_CONFIG_JSON='{"tsb":{"require_pop":true,"require_pod":true}}'
 */

const DEFAULT = {
  require_pop: false,
  require_pod: true,
  auto_approve_on_match: false,
  pop_fields: ["fotos", "cantidades", "condition"],
  pod_fields: ["fotos", "receptor", "cantidades", "condition"],
};

let cache = null;

function parseConfig() {
  if (cache) return cache;
  const raw = process.env.SOL_EVIDENCE_CONFIG_JSON?.trim();
  if (!raw) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(raw);
    return cache;
  } catch {
    cache = {};
    return cache;
  }
}

/** @param {string|null|undefined} tenant */
export function getEvidenceConfig(tenant) {
  const all = parseConfig();
  const key = String(tenant || "default").toLowerCase();
  const base = all.default || all["*"] || {};
  const specific = all[key] || {};
  return { ...DEFAULT, ...base, ...specific };
}

export function requiresPop(tenant) {
  return Boolean(getEvidenceConfig(tenant).require_pop);
}

export function requiresPod(tenant) {
  return Boolean(getEvidenceConfig(tenant).require_pod);
}

/** Solo tests — reset cache. */
export function __resetEvidenceConfigCache() {
  cache = null;
}
