/**
 * SOL Commander flags.
 * @see docs/SOL-COMMANDER-V1-DESIGN.md
 * @see docs/SOL-COMMANDER-V1.1-INTERRUPT-RESUME-DESIGN.md
 */

export function isCommanderV1Enabled() {
  return String(process.env.SOL_COMMANDER_V1 ?? "").toLowerCase() === "true";
}

/** Corre decide() en paralelo, loguea, ejecuta legacy (o observa junto a V1). */
export function isCommanderShadowEnabled() {
  return String(process.env.SOL_COMMANDER_SHADOW ?? "").toLowerCase() === "true";
}

/**
 * v1.1 Interrupt & Resume — default OFF.
 * Requiere V1 ON para aplicar; si V1 off, esta flag es inerte.
 */
export function isCommanderV11InterruptEnabled() {
  if (!isCommanderV1Enabled()) return false;
  return String(process.env.SOL_COMMANDER_V1_1_INTERRUPT ?? "").toLowerCase() === "true";
}
