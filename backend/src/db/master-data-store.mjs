import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "parametros.json");

const COLLECTIONS = ["choferes", "unidades", "localidades", "distancias"];

function readDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    fs.writeFileSync(FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  const db = JSON.parse(fs.readFileSync(FILE, "utf8"));
  for (const c of COLLECTIONS) {
    if (!Array.isArray(db[c])) db[c] = [];
  }
  return db;
}

function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

export function normalizePatente(patente) {
  if (!patente) return "";
  return String(patente).replace(/\s+/g, " ").trim().toUpperCase();
}

function filterTenant(rows, tenant) {
  if (!tenant) return rows;
  return rows.filter((r) => r.tenant === tenant);
}

function stamp(row, patch = {}) {
  const now = new Date().toISOString();
  return {
    ...row,
    ...patch,
    updated_at: now,
    created_at: row.created_at ?? now,
  };
}

export async function listCollection(name, { tenant, activo, tipo } = {}) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Colección desconocida: ${name}`);
  let rows = readDb()[name];
  if (tenant) rows = filterTenant(rows, tenant);
  if (activo === true) rows = rows.filter((r) => r.activo !== false);
  if (tipo && name === "unidades") rows = rows.filter((r) => r.tipo === tipo);
  return rows.sort((a, b) => (a.nombre || a.patente || "").localeCompare(b.nombre || b.patente || ""));
}

export async function getItem(name, id) {
  if (!COLLECTIONS.includes(name)) return null;
  return readDb()[name].find((r) => r.id === id) ?? null;
}

export async function createItem(name, body) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Colección desconocida: ${name}`);
  const db = readDb();
  const row = stamp({ id: randomUUID(), activo: true, ...body });
  db[name].unshift(row);
  writeDb(db);
  return row;
}

export async function updateItem(name, id, patch) {
  if (!COLLECTIONS.includes(name)) return null;
  const db = readDb();
  const i = db[name].findIndex((r) => r.id === id);
  if (i < 0) return null;
  db[name][i] = stamp(db[name][i], patch);
  writeDb(db);
  return db[name][i];
}

export async function deleteItem(name, id) {
  if (!COLLECTIONS.includes(name)) return false;
  const db = readDb();
  const before = db[name].length;
  db[name] = db[name].filter((r) => r.id !== id);
  if (db[name].length === before) return false;
  writeDb(db);
  return true;
}

export function findChoferByPhone(choferes, telefono) {
  const tel = normalizePhone(telefono);
  if (!tel) return null;
  return (
    choferes.find(
      (c) => normalizePhone(c.telefono) === tel || normalizePhone(c.documento) === tel,
    ) ?? null
  );
}

/** Chofer en maestros → tenant (fix Castro: Beraldi no cae en TSB). */
export async function resolverTenantPorTelefono(telefono) {
  const tel = normalizePhone(telefono);
  if (!tel) return null;
  for (const tenant of ["tsb", "beraldi", "corina"]) {
    const choferes = await listCollection("choferes", { tenant, activo: true });
    if (findChoferByPhone(choferes, tel)) return tenant;
  }
  return null;
}

/** Import masivo desde array (upsert por teléfono en telefono o documento/DNI) */
export async function importChoferes(items, { tenant, replace = false } = {}) {
  const db = readDb();
  if (replace) db.choferes = db.choferes.filter((c) => c.tenant !== tenant);
  let created = 0;
  for (const raw of items) {
    const phone = normalizePhone(raw.documento || raw.telefono || raw.tel);
    const nombre = String(raw.nombre || "").trim();
    if (!nombre) continue;
    const existing = findChoferByPhone(
      db.choferes.filter((c) => c.tenant === tenant),
      phone,
    );
    if (existing) {
      Object.assign(
        existing,
        stamp(existing, {
          nombre,
          telefono: phone || existing.telefono,
          documento: phone || existing.documento,
          activo: true,
        }),
      );
    } else {
      db.choferes.unshift(
        stamp({
          id: randomUUID(),
          tenant,
          nombre,
          telefono: phone || null,
          documento: phone || null,
          activo: true,
        }),
      );
      created++;
    }
  }
  writeDb(db);
  return { created, total: db.choferes.filter((c) => c.tenant === tenant).length };
}
