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
      bot_pausado: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rows.unshift(conv);
  }
  if (tenant && !conv.tenant) conv.tenant = tenant;
  if (conv.bot_pausado == null) conv.bot_pausado = false;
  return conv;
}

function actorFromOpts(opts) {
  if (opts.from === "human" || opts.from === "HUMAN") return "human";
  if (opts.from === "bot" || opts.from === "BOT") return "bot";
  if (opts.dir === "out") return opts.from === "human" ? "human" : "bot";
  return "customer";
}

export async function appendMensaje(telefono, msg, opts = {}) {
  if (!telefono) return null;
  const rows = readAll();
  const conv = findOrCreate(rows, telefono, opts.tenant);
  const actor = actorFromOpts(opts);
  const entry = {
    id: `${Date.now()}-${conv.mensajes.length}`,
    dir: opts.dir ?? (actor === "customer" ? "in" : "out"),
    from: actor,
    texto: msg.texto ?? null,
    tipo: msg.tipo ?? "text",
    remito_id: msg.remito_id ?? null,
    imagen_url: msg.imagen_url ?? null,
    transcripcion: msg.transcripcion ?? null,
    at: new Date().toISOString(),
  };
  conv.mensajes.push(entry);
  if (conv.mensajes.length > 300) conv.mensajes = conv.mensajes.slice(-300);
  if (opts.remito_id) conv.ultimo_remito_id = opts.remito_id;
  if (opts.nombre) conv.nombre = opts.nombre;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

export async function setBotPausado(telefono, pausado) {
  const phone = sanitizePhone(telefono);
  const rows = readAll();
  const conv = findOrCreate(rows, phone, null);
  conv.bot_pausado = !!pausado;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

export async function isBotPausado(telefono) {
  const conv = await getConversacion(telefono);
  return !!conv?.bot_pausado;
}

export async function listConversaciones({ tenant, limit = 80 } = {}) {
  let rows = readAll();
  if (tenant) rows = rows.filter((c) => c.tenant === tenant);
  rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return rows.slice(0, limit).map(({ mensajes, ...rest }) => ({
    ...rest,
    ultimo_mensaje: mensajes.at(-1) ?? null,
    total_mensajes: mensajes.length,
  }));
}

export async function getConversacion(telefono) {
  const phone = sanitizePhone(telefono);
  return readAll().find((c) => c.telefono === phone) ?? null;
}
