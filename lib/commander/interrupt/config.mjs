/**
 * Configuración v1.1 Interrupt — defaults documentados, todo override por env.
 * maxDepth y TTL no están hardcodeados como regla definitiva.
 */

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_PAUSED_TTL_MS = 24 * 60 * 60 * 1000;

/** TTL default por ProcessType (ms). Override: SOL_COMMANDER_V1_1_TTL_<TYPE>_MS */
const DEFAULT_TTL_BY_TYPE = {
  remito_revision: DEFAULT_PAUSED_TTL_MS,
  viaje_solicitud: DEFAULT_PAUSED_TTL_MS,
  destino_confirmacion: DEFAULT_PAUSED_TTL_MS,
  destino_eta_chofer: DEFAULT_PAUSED_TTL_MS,
  pod_caso: DEFAULT_PAUSED_TTL_MS,
  rendicion_gasto: DEFAULT_PAUSED_TTL_MS,
  incidencia: DEFAULT_PAUSED_TTL_MS,
  reclamo: DEFAULT_PAUSED_TTL_MS,
  human_takeover: DEFAULT_PAUSED_TTL_MS,
  ephemeral_qa: 2 * 60 * 60 * 1000, // 2h default más corto para Q&A
};

function parsePositiveInt(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** Profundidad máxima del interruptStack (frames paused). Default 2. */
export function getInterruptMaxDepth() {
  return parsePositiveInt(process.env.SOL_COMMANDER_V1_1_MAX_DEPTH, DEFAULT_MAX_DEPTH);
}

/** TTL global paused (ms) si no hay override por tipo. Default 24h. */
export function getDefaultPausedTtlMs() {
  return parsePositiveInt(process.env.SOL_COMMANDER_V1_1_PAUSED_TTL_MS, DEFAULT_PAUSED_TTL_MS);
}

/**
 * TTL paused por ProcessType (ms).
 * Env: SOL_COMMANDER_V1_1_TTL_<PROCESS_TYPE>_MS (mayúsculas, sin guiones → _)
 */
export function getPausedTtlMsForProcessType(processType) {
  const key = String(processType || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  const envKey = `SOL_COMMANDER_V1_1_TTL_${key}_MS`;
  if (process.env[envKey] != null && process.env[envKey] !== "") {
    return parsePositiveInt(process.env[envKey], getDefaultPausedTtlMs());
  }
  if (DEFAULT_TTL_BY_TYPE[processType] != null) {
    return DEFAULT_TTL_BY_TYPE[processType];
  }
  return getDefaultPausedTtlMs();
}

export function expiresAtForProcessType(processType, now = Date.now()) {
  const ttl = getPausedTtlMsForProcessType(processType);
  return new Date(now + ttl).toISOString();
}

export function getInterruptConfigSnapshot() {
  return {
    maxDepth: getInterruptMaxDepth(),
    defaultPausedTtlMs: getDefaultPausedTtlMs(),
    ttlByTypeDefaults: { ...DEFAULT_TTL_BY_TYPE },
  };
}
