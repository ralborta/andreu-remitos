#!/usr/bin/env node
/**
 * Importa unidades (tractores / acoplados) desde seeds/*.json
 *
 * Uso:
 *   node scripts/import-unidades-seed.mjs seeds/tractores-crm-2026.json
 *   node scripts/import-unidades-seed.mjs seeds/tractores-crm-2026.json --tipo tractor
 *   API_URL=https://... node scripts/import-unidades-seed.mjs seeds/tractores-crm-2026.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const seedPath = args.find((a) => !a.startsWith("--")) ?? path.join(__dirname, "../seeds/tractores-crm-2026.json");
const tipoArg = args.includes("--tipo") ? args[args.indexOf("--tipo") + 1] : "tractor";
const tenantArg = args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null;
const tenants = tenantArg ? [tenantArg] : ["tsb", "beraldi"];
const apiUrl = (process.env.API_URL || "http://localhost:3001").replace(/\/$/, "");

const seed = JSON.parse(fs.readFileSync(path.resolve(seedPath), "utf8"));
const tipo = tipoArg === "acoplado" ? "acoplado" : "tractor";

const items = (seed.items ?? []).map((i) => ({
  patente: i.patente,
  unidad_interna: i.codigo != null ? String(i.codigo) : null,
}));

async function createUnidad(tenant, body) {
  const res = await fetch(`${apiUrl}/api/parametros/unidades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant, tipo, activo: true, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${tenant} ${body.patente}: ${data.error || res.statusText}`);
  return data;
}

console.log(`Importando ${items.length} ${tipo}s → ${tenants.join(", ")} (${apiUrl})`);
for (const tenant of tenants) {
  let ok = 0;
  for (const item of items) {
    await createUnidad(tenant, item);
    ok++;
  }
  console.log(`  ${tenant}: ${ok} cargados`);
}
