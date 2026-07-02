#!/usr/bin/env node
/**
 * Importa choferes desde seeds/choferes-crm-2026.json
 *
 * Uso:
 *   node scripts/import-choferes-seed.mjs                    # tsb + beraldi, local
 *   node scripts/import-choferes-seed.mjs --tenant tsb       # solo TSB
 *   API_URL=https://... node scripts/import-choferes-seed.mjs  # contra prod
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "../seeds/choferes-crm-2026.json");

const args = process.argv.slice(2);
const tenantArg = args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null;
const tenants = tenantArg ? [tenantArg] : ["tsb", "beraldi"];
const replace = args.includes("--replace");
const apiUrl = (process.env.API_URL || "http://localhost:3001").replace(/\/$/, "");

const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
const exclude = new Set(seed.exclude_tests ?? []);
const items = seed.items
  .filter((i) => !exclude.has(i.codigo))
  .map(({ nombre, telefono }) => {
    // En el CRM Empliados el WhatsApp va en el campo DNI (documento), no en código interno.
    const phone = String(telefono || "").replace(/\D/g, "") || null;
    return { nombre, telefono: phone, documento: phone };
  });

async function importTenant(tenant) {
  const res = await fetch(`${apiUrl}/api/parametros/choferes/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant, items, replace }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${tenant}: ${body.error || res.statusText}`);
  return body;
}

console.log(`Importando ${items.length} choferes → ${tenants.join(", ")} (${apiUrl})`);
for (const t of tenants) {
  const r = await importTenant(t);
  console.log(`  ${t}: ${r.created} nuevos, ${r.total} total`);
}
