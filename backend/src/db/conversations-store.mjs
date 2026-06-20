import fs from "node:fs";
import path from "node:path";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "conversaciones.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function findOrCreate(rows, telefono, tenant) {
  const phone = sanitizePhone(telefono);
  let conv = rows.find((c) => c.telefono === phone);
  if (!conv) {
    conv = {
      id: phone,
      telefono: phone,
      tenant: tenant ?? null,
      nombre: null,
      mensajes: [],
      ultimo_remito_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rows.unshift(conv);
  }
  if (tenant && !conv.tenant) conv.tenant = tenant;
  return conv;
}

export async function appendMensaje(telefono, msg, opts = {}) {
  if (!telefono) return null;
  const rows = readAll();
  const conv = findOrCreate(rows, telefono, opts.tenant);
  const entry = {
    id: `${Date.now()}-${conv.mensajes.length}`,
    dir: opts.dir ?? "in",
    texto: msg.texto ?? null,
    tipo: msg.tipo ?? "text",
    remito_id: msg.remito_id ?? null,
    imagen_url: msg.imagen_url ?? null,
    at: new Date().toISOString(),
  };
  conv.mensajes.push(entry);
  if (conv.mensajes.length > 200) conv.mensajes = conv.mensajes.slice(-200);
  if (opts.remito_id) conv.ultimo_remito_id = opts.remito_id;
  if (opts.nombre) conv.nombre = opts.nombre;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

export async function listConversaciones({ tenant, limit = 50 } = {}) {
  let rows = readAll();
  if (tenant) rows = rows.filter((c) => c.tenant === tenant);
  return rows
    .slice(0, limit)
    .map(({ mensajes, ...rest }) => ({
      ...rest,
      ultimo_mensaje: mensajes.at(-1) ?? null,
      total_mensajes: mensajes.length,
    }));
}

export async function getConversacion(telefono) {
  const phone = sanitizePhone(telefono);
  return readAll().find((c) => c.telefono === phone) ?? null;
}
