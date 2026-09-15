#!/usr/bin/env node
/**
 * Verifica rechazo/aprobación con nota opcional (nota_aprobacion).
 * Usa DATA_DIR temporal; sin mocks permanentes.
 *
 *   node scripts/verify-rendicion-rechazo-motivo.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rendicion-rechazo-"));
process.env.DATA_DIR = tmp;

const store = await import("../backend/src/db/rendicion-store.mjs");
const { mensajeDecisionGasto } = await import("../lib/rendicion-wa.mjs");

const gasto = await store.crearGasto({
  telefono: "5491555555555",
  chofer_nombre: "Test Chofer",
  categoria: "peaje",
  monto: 1200,
  descripcion: "Peaje test",
  estado: "pendiente_aprobacion",
});

assert.equal(gasto.estado, "pendiente_aprobacion");
assert.equal(gasto.nota_aprobacion, null);

const rechazado = await store.decidirGasto(gasto.id, {
  estado: "rechazado",
  nota: "Comprobante borroso",
  aprobado_por: "mesa",
});
assert.ok(rechazado);
assert.equal(rechazado.estado, "rechazado");
assert.equal(rechazado.nota_aprobacion, "Comprobante borroso");
assert.match(rechazado.historial.at(-1), /rechazado.*Comprobante borroso/);

const wa = mensajeDecisionGasto(rechazado);
assert.match(wa, /rechaz/i);
assert.match(wa, /Comprobante borroso/);

const g2 = await store.crearGasto({
  telefono: "5491666666666",
  chofer_nombre: "Otro",
  categoria: "combustible",
  monto: 5000,
  estado: "pendiente_aprobacion",
});
const sinNota = await store.decidirGasto(g2.id, { estado: "rechazado" });
assert.equal(sinNota.estado, "rechazado");
assert.equal(sinNota.nota_aprobacion, null);

const g3 = await store.crearGasto({
  telefono: "5491777777777",
  chofer_nombre: "Aprobado",
  categoria: "otro",
  monto: 100,
  estado: "pendiente_aprobacion",
});
const ok = await store.decidirGasto(g3.id, {
  estado: "aprobado",
  nota: "Todo bien",
});
assert.equal(ok.estado, "aprobado");
assert.equal(ok.nota_aprobacion, "Todo bien");
const waOk = mensajeDecisionGasto(ok);
assert.match(waOk, /Todo bien/);

console.log("OK verify-rendicion-rechazo-motivo");
