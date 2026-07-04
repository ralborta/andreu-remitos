import fs from "node:fs";
import path from "node:path";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as remitoStore from "./file-store.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "conversaciones.json");

/** Tras pausar manualmente, el bot vuelve solo si no hay mensajes en este lapso. */
export const BOT_PAUSA_INACTIVIDAD_MS = 5 * 60 * 1000;

export function inactividadSuperaUmbralReactivacion(conv) {
  if (!conv?.bot_pausado || !conv.updated_at) return false;
  const elapsed = Date.now() - new Date(conv.updated_at).getTime();
  return elapsed >= BOT_PAUSA_INACTIVIDAD_MS;
}

export async function reactivarBotSiInactivo(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return { conv: null, reactivated: false };

  const rows = readAll();
  const conv = rows.find((c) => c.telefono === phone);
  if (!conv?.bot_pausado) return { conv: conv ?? null, reactivated: false };
  if (!inactividadSuperaUmbralReactivacion(conv)) return { conv, reactivated: false };

  conv.bot_pausado = false;
  writeAll(rows);
  return { conv, reactivated: true };
}

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

export async function syncTenantDesdeRemito(conv) {
  if (!conv?.ultimo_remito_id) return conv;
  const rem = await remitoStore.getRemito(conv.ultimo_remito_id);
  if (!rem?.tenant || rem.tenant === conv.tenant) return conv;
  return updateTenantConversacion(conv.telefono, rem.tenant);
}

export async function listConversaciones({ tenant, limit = 80 } = {}) {
  let rows = readAll();
  rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const enriched = [];
  for (const row of rows) {
    const synced = (await syncTenantDesdeRemito(row)) ?? row;
    const tenantEfectivo = synced.tenant ?? row.tenant;
    if (tenant && tenantEfectivo !== tenant) continue;
    const { mensajes, ...rest } = synced;
    enriched.push({
      ...rest,
      tenant: tenantEfectivo,
      ultimo_mensaje: mensajes?.at(-1) ?? null,
      total_mensajes: mensajes?.length ?? 0,
    });
    if (enriched.length >= limit) break;
  }
  return enriched;
}

export async function getConversacion(telefono) {
  const phone = sanitizePhone(telefono);
  const conv = readAll().find((c) => c.telefono === phone) ?? null;
  if (!conv) return null;
  return syncTenantDesdeRemito(conv);
}

/** Vincula el remito recién ingestado aunque falle el envío por WhatsApp. */
export async function setUltimoRemito(telefono, remito_id, tenant) {
  if (!telefono || !remito_id) return null;
  const rows = readAll();
  const conv = findOrCreate(rows, telefono, tenant ?? null);
  conv.ultimo_remito_id = remito_id;
  if (tenant) conv.tenant = tenant;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

export async function updateTenantConversacion(telefono, tenant) {
  if (!telefono || !tenant) return null;
  const rows = readAll();
  const conv = rows.find((c) => c.telefono === sanitizePhone(telefono));
  if (!conv) return null;
  conv.tenant = tenant;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

/** Correcciones detectadas pendientes de confirmación OK del chofer. */
export async function setCorreccionesPendientes(telefono, correcciones) {
  if (!telefono) return null;
  const rows = readAll();
  const conv = findOrCreate(rows, telefono, null);
  conv.correcciones_pendientes = Array.isArray(correcciones) ? correcciones : [];
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}

export async function clearCorreccionesPendientes(telefono) {
  if (!telefono) return null;
  const rows = readAll();
  const conv = rows.find((c) => c.telefono === sanitizePhone(telefono));
  if (!conv) return null;
  delete conv.correcciones_pendientes;
  conv.updated_at = new Date().toISOString();
  writeAll(rows);
  return conv;
}
