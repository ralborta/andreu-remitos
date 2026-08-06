import { timingSafeEqual } from "node:crypto";

/**
 * Claves externas para integración (planillas, etc.).
 *
 * EXTERNAL_API_KEYS_JSON ejemplo:
 * [
 *   {
 *     "id": "andreu-prod",
 *     "name": "Andreu integración",
 *     "tenants": ["tsb", "beraldi", "corina", "mye"],
 *     "key": "andreu_live_…",
 *     "scopes": ["planillas:read"]
 *   }
 * ]
 *
 * Compat: `"tenant": "tsb"` (uno solo) o `"tenant": "*"` (todos).
 */

export const ALL_TENANTS = ["tsb", "beraldi", "corina", "mye"];
const TENANTS = new Set(ALL_TENANTS);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function normalizeTenants(row) {
  if (Array.isArray(row.tenants) && row.tenants.length) {
    return [...new Set(row.tenants.map((t) => String(t).trim().toLowerCase()).filter((t) => TENANTS.has(t)))];
  }
  const single = String(row.tenant || "").trim().toLowerCase();
  if (single === "*" || single === "all") return [...ALL_TENANTS];
  if (TENANTS.has(single)) return [single];
  return [];
}

function parseKeys() {
  const raw = process.env.EXTERNAL_API_KEYS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const tenants = normalizeTenants(row);
        return {
          id: String(row.id || row.name || "client").trim(),
          name: String(row.name || row.id || "client").trim(),
          tenants,
          /** Primer tenant (compat respuestas / default). */
          tenant: tenants[0] ?? null,
          key: String(row.key || "").trim(),
          scopes: Array.isArray(row.scopes)
            ? row.scopes.map((s) => String(s).trim()).filter(Boolean)
            : ["planillas:read"],
        };
      })
      .filter((row) => row.key && row.tenants.length > 0);
  } catch {
    return [];
  }
}

/**
 * @param {string | null | undefined} provided
 * @returns {{ id: string, name: string, tenant: string|null, tenants: string[], scopes: string[] } | null}
 */
export function verifyExternalApiKey(provided) {
  const key = String(provided || "").trim();
  if (!key) return null;
  for (const row of parseKeys()) {
    if (safeEqual(row.key, key)) {
      return {
        id: row.id,
        name: row.name,
        tenant: row.tenant,
        tenants: row.tenants,
        scopes: row.scopes,
      };
    }
  }
  return null;
}

/** @param {{ tenants?: string[], tenant?: string|null } | null} client */
export function apiClientCanAccessTenant(client, tenant) {
  if (!client || !tenant) return false;
  const t = String(tenant).trim().toLowerCase();
  const allowed = client.tenants?.length ? client.tenants : client.tenant ? [client.tenant] : [];
  return allowed.includes(t);
}

export function extractApiKey(request) {
  const h = request.headers || {};
  const fromHeader = h["x-api-key"] || h["X-Api-Key"];
  if (typeof fromHeader === "string" && fromHeader.trim()) return fromHeader.trim();

  const auth = h.authorization || h.Authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("apikey ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function apiClientHasScope(client, scope) {
  if (!client) return false;
  const scopes = client.scopes || [];
  return scopes.includes(scope) || scopes.includes("*");
}
