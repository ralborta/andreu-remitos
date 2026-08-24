/**
 * SOL Tracking Express — feature flags + allowlist piloto.
 * @see docs/SOL-TRACKING-EXPRESS.md
 * @see docs/SOL-TRACKING-EXPRESS-PILOT.md
 */

export function isTrackingExpressEnabled() {
  return String(process.env.SOL_TRACKING_EXPRESS_ENABLED ?? "").toLowerCase() === "true";
}

/** WhatsApp automático (recordatorios / envío de link). Default ON si el módulo está ON. */
export function isTrackingWhatsAppEnabled() {
  if (!isTrackingExpressEnabled()) return false;
  const raw = process.env.SOL_TRACKING_WA_ENABLED;
  if (raw == null || raw === "") return true;
  return String(raw).toLowerCase() === "true";
}

/** TTL default de enlaces (horas). */
export function trackingLinkTtlHours() {
  const n = parseInt(process.env.SOL_TRACKING_LINK_TTL_HOURS ?? "72", 10);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

/** Versión de consentimiento mostrada al chofer. */
export function trackingConsentVersion() {
  return String(process.env.SOL_TRACKING_CONSENT_VERSION ?? "1.0").trim() || "1.0";
}

/** Radio geocerca destino (metros). */
export function trackingGeofenceRadiusMeters() {
  const n = parseInt(process.env.SOL_TRACKING_GEOFENCE_RADIUS_M ?? "300", 10);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

function msEnv(name, fallback) {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Umbrales watcher WA (ms). */
export function trackingWaThresholds() {
  return {
    pollMs: msEnv("SOL_TRACKING_WA_POLL_MS", 60_000),
    startReminderMs: msEnv("SOL_TRACKING_WA_START_REMINDER_MS", 15 * 60_000),
    staleMs: msEnv("SOL_TRACKING_WA_STALE_MS", 3 * 60_000),
    criticalMs: msEnv("SOL_TRACKING_WA_CRITICAL_MS", 5 * 60_000),
    podPendingMs: msEnv("SOL_TRACKING_WA_POD_PENDING_MS", 10 * 60_000),
    cooldownMs: msEnv("SOL_TRACKING_WA_COOLDOWN_MS", 30 * 60_000),
  };
}

export function normalizeTrackingPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

/**
 * Parse allowlist CSV.
 * - vacío → { mode: "empty" } fail-closed
 * - `*` / `all` → { mode: "all" }
 * - lista → { mode: "list", items }
 */
export function parseTrackingAllowlist(raw, { normalizeItem } = {}) {
  const text = String(raw ?? "").trim();
  if (!text) return { mode: "empty", items: [], size: 0 };
  if (text === "*" || text.toLowerCase() === "all") {
    return { mode: "all", items: null, size: null };
  }
  const items = [
    ...new Set(
      text
        .split(/[,;\s]+/)
        .map((s) => (normalizeItem ? normalizeItem(s) : String(s).trim().toLowerCase()))
        .filter(Boolean),
    ),
  ];
  return { mode: "list", items, size: items.length };
}

export function getTrackingTenantAllowlist() {
  return parseTrackingAllowlist(process.env.SOL_TRACKING_ALLOWLIST_TENANTS, {
    normalizeItem: (s) => String(s).trim().toLowerCase(),
  });
}

export function getTrackingPhoneAllowlist() {
  return parseTrackingAllowlist(process.env.SOL_TRACKING_ALLOWLIST_PHONES, {
    normalizeItem: normalizeTrackingPhone,
  });
}

function allowlistAllows(al, value) {
  if (al.mode === "all") return true;
  if (al.mode === "empty") return false;
  return al.items.includes(value);
}

/**
 * Gate piloto: módulo ON + tenant allowlist + phone allowlist.
 * Fail-closed si alguna lista está vacía (evita activación global accidental).
 * Para abrir a todos: SOL_TRACKING_ALLOWLIST_TENANTS=* y SOL_TRACKING_ALLOWLIST_PHONES=*
 */
export function isTrackingAllowedForTrip(viaje = {}) {
  if (!isTrackingExpressEnabled()) {
    return { ok: false, reason: "feature_disabled" };
  }
  const tenants = getTrackingTenantAllowlist();
  const phones = getTrackingPhoneAllowlist();
  const tenant = String(viaje.tenant || "").trim().toLowerCase() || null;
  const phone = normalizeTrackingPhone(viaje.telefono_chofer || viaje.telefonoChofer || "");

  if (!allowlistAllows(tenants, tenant || "")) {
    return { ok: false, reason: "tenant_not_allowlisted", tenant };
  }
  if (!phone) {
    return { ok: false, reason: "phone_missing" };
  }
  if (!allowlistAllows(phones, phone)) {
    return { ok: false, reason: "phone_not_allowlisted" };
  }
  return { ok: true, tenant, phoneLast4: phone.slice(-4) };
}

/** Snapshot seguro (sin dump de teléfonos). */
export function getTrackingPilotGateSnapshot() {
  const tenants = getTrackingTenantAllowlist();
  const phones = getTrackingPhoneAllowlist();
  const gated = tenants.mode !== "all" || phones.mode !== "all";
  return {
    enabled: isTrackingExpressEnabled(),
    whatsapp: isTrackingWhatsAppEnabled(),
    tenants_mode: tenants.mode,
    tenants_size: tenants.size,
    phones_mode: phones.mode,
    phones_size: phones.size,
    gated,
    pilot: gated && isTrackingExpressEnabled(),
  };
}
