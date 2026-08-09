#!/usr/bin/env node
/**
 * Bug real: "ahora tengo un peaje para rendir" registraba pendiente
 * de aprobación sin pedir la foto del comprobante.
 *
 * Uso: node scripts/verify-rendicion-pedir-foto.mjs
 */
import assert from "node:assert/strict";
import { mensajePedirFotoComprobante } from "../lib/rendicion-wa.mjs";

const peaje = mensajePedirFotoComprobante("ahora tengo un peaje para rendir");
assert.match(peaje, /foto/i, "debe pedir foto");
assert.match(peaje, /peaje/i, "debe mencionar peaje");
assert.doesNotMatch(peaje, /registr[eé]|qued[aó] \*pendiente/i, "aún no confirma registro");

const generico = mensajePedirFotoComprobante("quiero rendir un gasto");
assert.match(generico, /foto/i, "pedido genérico pide foto");

console.log("OK verify-rendicion-pedir-foto");
