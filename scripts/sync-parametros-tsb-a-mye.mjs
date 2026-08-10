/**
 * Replica choferes y unidades (tractores/semis) de TSB → MyESA (mye).
 * El cliente indica que son los mismos maestros.
 *
 * Uso (DATA_DIR apuntando al volumen):
 *   DATA_DIR=./data node scripts/sync-parametros-tsb-a-mye.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "parametros.json");
const FROM = "tsb";
const TO = "mye";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizePatente(patente) {
  return String(patente || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function choferKey(r) {
  return `${normalizePhone(r.telefono || r.documento)}|${String(r.nombre || "").trim().toLowerCase()}`;
}

function unidadKey(r) {
  return `${r.tipo || ""}|${normalizePatente(r.patente)}`;
}

function copyCollection(db, name, keyFn) {
  const src = (db[name] || []).filter((r) => r.tenant === FROM);
  const existing = new Set((db[name] || []).filter((r) => r.tenant === TO).map(keyFn));
  const now = new Date().toISOString();
  let added = 0;
  for (const r of src) {
    const k = keyFn(r);
    if (!k || k === "|" || existing.has(k)) continue;
    const { id: _id, tenant: _t, created_at: _c, updated_at: _u, ...rest } = r;
    db[name].unshift({
      ...rest,
      id: randomUUID(),
      tenant: TO,
      activo: r.activo !== false,
      created_at: now,
      updated_at: now,
    });
    existing.add(k);
    added += 1;
  }
  return { source: src.length, added };
}

if (!fs.existsSync(FILE)) {
  console.error("No existe", FILE);
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(FILE, "utf8"));
for (const c of ["choferes", "unidades", "localidades", "distancias"]) {
  if (!Array.isArray(db[c])) db[c] = [];
}

const choferes = copyCollection(db, "choferes", choferKey);
const unidades = copyCollection(db, "unidades", unidadKey);

fs.writeFileSync(FILE, JSON.stringify(db, null, 2));

console.log(
  JSON.stringify(
    {
      from: FROM,
      to: TO,
      choferes,
      unidades,
      myeChoferes: db.choferes.filter((r) => r.tenant === TO).length,
      myeUnidades: db.unidades.filter((r) => r.tenant === TO).length,
    },
    null,
    2,
  ),
);
