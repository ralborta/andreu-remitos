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
 * v1.1 Interrupt & Resume — feature flag (default OFF).
 * Requiere V1 ON; si V1 off, esta flag es inerte.
 * El gating por sujeto es `isCommanderV11InterruptEnabledForSubject`.
 */
export function isCommanderV11InterruptEnabled() {
  if (!isCommanderV1Enabled()) return false;
  return String(process.env.SOL_COMMANDER_V1_1_INTERRUPT ?? "").toLowerCase() === "true";
}

export function normalizeSubjectId(subjectId) {
  return String(subjectId || "").replace(/\D/g, "");
}

/**
 * Allowlist de prueba controlada.
 * - vacío → nadie (fail-closed; no activación global accidental)
 * - `*` / `all` → todos (solo para activación global futura explícita)
 * - lista CSV / espacios / `;` → solo esos subjectIds (dígitos)
 */
export function getCommanderV11Allowlist() {
  const raw = String(process.env.SOL_COMMANDER_V1_1_ALLOWLIST ?? "").trim();
  if (!raw) {
    return { mode: "empty", subjects: [], size: 0 };
  }
  if (raw === "*" || raw.toLowerCase() === "all") {
    return { mode: "all", subjects: null, size: null };
  }
  const subjects = [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((s) => normalizeSubjectId(s))
        .filter(Boolean),
    ),
  ];
  return { mode: "list", subjects, size: subjects.length };
}

/**
 * v1.1 efectivo para un sujeto: flag ON + allowlist.
 * Fuera de allowlist → exactamente Commander V1.
 */
export function isCommanderV11InterruptEnabledForSubject(subjectId) {
  if (!isCommanderV11InterruptEnabled()) return false;
  const al = getCommanderV11Allowlist();
  if (al.mode === "all") return true;
  if (al.mode === "empty") return false;
  const phone = normalizeSubjectId(subjectId);
  if (!phone) return false;
  return al.subjects.includes(phone);
}

/** Snapshot seguro para health (sin dump completo de PII en logs). */
export function getCommanderV11GateSnapshot() {
  const al = getCommanderV11Allowlist();
  return {
    interrupt_flag: isCommanderV11InterruptEnabled(),
    allowlist_mode: al.mode,
    allowlist_size: al.size,
    gated: al.mode !== "all",
  };
}
