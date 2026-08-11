/**
 * SOL Commander v1 — feature flags.
 * Default OFF → camino legacy en webhooks (rollback).
 * @see docs/SOL-COMMANDER-V1-DESIGN.md
 */

export function isCommanderV1Enabled() {
  return String(process.env.SOL_COMMANDER_V1 ?? "").toLowerCase() === "true";
}

/** Corre decide() en paralelo, loguea, ejecuta legacy. */
export function isCommanderShadowEnabled() {
  return String(process.env.SOL_COMMANDER_SHADOW ?? "").toLowerCase() === "true";
}
