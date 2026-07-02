#!/usr/bin/env node
/**
 * Importa localidades desde seeds/localidades-crm-2026.json
 *
 * Uso:
 *   node scripts/import-localidades-seed.mjs
 *   API_URL=https://... node scripts/import-localidades-seed.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "../seeds/localidades-crm-2026.json");
const apiUrl = (process.env.API_URL || "http://localhost:3001").replace(/\/$/, "");

const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
const tenantMap = seed.tenant_map ?? { TSB: "tsb", BERALDI: "beraldi", Localero: "corina" };

async function createLocalidad(body) {
  const res = await fetch(`${apiUrl}/api/parametros/localidades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${body.tenant} ${body.nombre}: ${data.error || res.statusText}`);
  return data;
}

const counts = { tsb: 0, beraldi: 0, corina: 0 };

console.log(`Importando ${seed.items.length} localidades (${apiUrl})`);
for (const item of seed.items) {
  const tenant = tenantMap[item.empresa] ?? item.empresa.toLowerCase();
  await createLocalidad({
    tenant,
    nombre: item.nombre.trim(),
    codigo: item.codigo != null ? String(item.codigo) : null,
    tipo: "ambos",
    activo: true,
  });
  counts[tenant] = (counts[tenant] ?? 0) + 1;
}

console.log(`  tsb: ${counts.tsb}`);
console.log(`  beraldi: ${counts.beraldi}`);
console.log(`  corina (Localero): ${counts.corina}`);
