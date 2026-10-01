#!/usr/bin/env node
/**
 * Bandeja WhatsApp: listado liviano (sin historial completo).
 * Uso: node scripts/verify-conversaciones-listado-liviano.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "andreu-conv-"));
process.env.DATA_DIR = tmp;

const store = await import("../backend/src/db/conversations-store.mjs");

const phone = "5492611111111";
await store.appendMensaje(phone, { texto: "hola 1", tipo: "text" }, { dir: "in", from: "client", nombre: "Test" });
for (let i = 2; i <= 20; i++) {
  await store.appendMensaje(phone, { texto: `msg ${i}`, tipo: "text" }, { dir: "in", from: "client" });
}

const list = await store.listConversaciones({ limit: 10 });
assert.equal(list.length, 1);
assert.equal(list[0].total_mensajes, 20);
assert.equal(list[0].ultimo_mensaje?.texto, "msg 20");
assert.equal(list[0].mensajes, undefined, "el listado no debe traer historial");
assert.ok(!("imagen_url" in (list[0].ultimo_mensaje || {})), "preview sin imagen");

const fullish = await store.getConversacion(phone, { mensajesLimit: 5 });
assert.equal(fullish.mensajes.length, 5);
assert.equal(fullish.mensajes[0].texto, "msg 16");
assert.equal(fullish.mensajes.at(-1).texto, "msg 20");

const all = await store.getConversacion(phone);
assert.equal(all.mensajes.length, 20);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("OK verify-conversaciones-listado-liviano");
