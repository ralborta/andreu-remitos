#!/usr/bin/env node
/**
 * Importa distancias — resuelve origen/destino por nombre o código contra localidades.
 *
 * Uso:
 *   node scripts/import-distancias-seed.mjs
 *   API_URL=https://... node scripts/import-distancias-seed.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "../seeds/distancias-crm-2026.json");
const apiUrl = (process.env.API_URL || "http://localhost:3001").replace(/\/$/, "");

function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findLocalidad(localidades, ref) {
  if (!ref) return null;
  const n = norm(ref);
  return (
    localidades.find((l) => norm(l.codigo) === n) ??
    localidades.find((l) => norm(l.nombre) === n) ??
    localidades.find((l) => n.includes(norm(l.nombre)) || norm(l.nombre).includes(n)) ??
    null
  );
}

async function api(pathname) {
  const res = await fetch(`${apiUrl}${pathname}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function createDistancia(body) {
  const res = await fetch(`${apiUrl}/api/parametros/distancias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
const tenant = seed.tenant ?? "beraldi";
const localidades = await api(`/api/parametros/localidades?tenant=${tenant}`);

let ok = 0;
const skipped = [];

for (const item of seed.items) {
  const origen = findLocalidad(localidades, item.origen);
  const destino = findLocalidad(localidades, item.destino);
  if (!origen || !destino) {
    skipped.push({
      id: item.id,
      origen: item.origen,
      destino: item.destino,
      falta: [!origen ? "origen" : null, !destino ? "destino" : null].filter(Boolean).join(", "),
    });
    continue;
  }
  await createDistancia({
    tenant,
    origen_id: origen.id,
    destino_id: destino.id,
    km: Math.round(Number(item.km)),
    activo: true,
  });
  ok++;
  console.log(`  ✓ ${item.id}: ${item.origen} → ${item.destino} = ${Math.round(Number(item.km))} km`);
}

console.log(`\nImportadas: ${ok}/${seed.items.length} (${tenant})`);
if (skipped.length) {
  console.log("\nSin match (falta localidad en base):");
  for (const s of skipped) console.log(`  ✗ ${s.id}: ${s.origen} → ${s.destino} (${s.falta})`);
}
