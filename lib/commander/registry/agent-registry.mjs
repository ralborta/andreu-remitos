/**
 * Agent Registry — manifests declarativos (datos).
 * Commander no importa implementaciones de agentes.
 */

/** @typedef {{ id: string, label: string, intents: string[], ownsProcessTypes: string[], requires: { choferOperativo?: boolean, choferRemitos?: boolean }, executorKey: string }} AgentManifest */

/** @type {AgentManifest[]} */
const manifests = [];

export function resetAgentRegistry() {
  manifests.length = 0;
}

export function registerAgent(manifest) {
  const i = manifests.findIndex((m) => m.id === manifest.id);
  if (i >= 0) manifests[i] = manifest;
  else manifests.push(manifest);
}

export function listAgents() {
  return [...manifests];
}

/**
 * @param {string} intent
 * @param {{ isChoferOperativo?: boolean, isChoferRemitos?: boolean }} actor
 * @returns {AgentManifest | null}
 */
export function resolveByIntent(intent, actor = {}) {
  const id = String(intent || "").toLowerCase();
  const candidates = manifests.filter((m) => m.intents.includes(id));
  for (const m of candidates) {
    if (m.requires?.choferOperativo && !actor.isChoferOperativo) continue;
    if (m.requires?.choferRemitos && !actor.isChoferRemitos) continue;
    return m;
  }
  // Fallback: primer match ignorando requires (executor aplicará mensajes solo-choferes)
  return candidates[0] ?? null;
}

export function getAgentById(id) {
  return manifests.find((m) => m.id === id) ?? null;
}
