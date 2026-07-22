import { timingSafeEqual } from "node:crypto";

/**
 * Claves externas para integración (planillas, etc.).
 *
 * EXTERNAL_API_KEYS_JSON ejemplo:
 * [
 *   {
 *     "id": "tsb-prod",
 *     "name": "TSB integración",
 *     "tenant": "tsb",
 *     "key": "andreu_tsb_live_…",
 *     "scopes": ["planillas:read"]
 *   }
 * ]
 */

const TENANTS = new Set(["tsb", "beraldi", "corina"]);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function parseKeys() {
  const raw = process.env.EXTERNAL_API_KEYS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        id: String(row.id || row.name || "client").trim(),
        name: String(row.name || row.id || "client").trim(),
        tenant: String(row.tenant || "").trim().toLowerCase(),
        key: String(row.key || "").trim(),
        scopes: Array.isArray(row.scopes)
          ? row.scopes.map((s) => String(s).trim()).filter(Boolean)
          : ["planillas:read"],
      }))
      .filter((row) => row.key && TENANTS.has(row.tenant));
  } catch {
    return [];
  }
}

/**
 * @param {string | null | undefined} provided
 * @returns {{ id: string, name: string, tenant: string, scopes: string[] } | null}
 */
export function verifyExternalApiKey(provided) {
  const key = String(provided || "").trim();
  if (!key) return null;
  for (const row of parseKeys()) {
    if (safeEqual(row.key, key)) {
      return { id: row.id, name: row.name, tenant: row.tenant, scopes: row.scopes };
    }
  }
  return null;
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
