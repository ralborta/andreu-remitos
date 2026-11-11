#!/usr/bin/env node
/**
 * Corina de baja — mensaje y flag.
 * Uso: node scripts/verify-corina-fuera-servicio.mjs
 */
import assert from "node:assert/strict";
import {
  corinaFueraDeServicio,
  mensajeCorinaFueraDeServicio,
  mensajeSaludo,
} from "../lib/builderbot-webhook.mjs";

process.env.PRODUCT_PROFILE = "andreu";
delete process.env.CORINA_FUERA_DE_SERVICIO;
assert.equal(corinaFueraDeServicio(), true);

process.env.CORINA_FUERA_DE_SERVICIO = "false";
assert.equal(corinaFueraDeServicio(), false);

process.env.CORINA_FUERA_DE_SERVICIO = "true";
assert.equal(corinaFueraDeServicio(), true);

const msg = mensajeCorinaFueraDeServicio();
assert.match(msg, /ya no está en servicio/i);
assert.match(msg, /Gracias/i);

assert.equal(mensajeSaludo("corina", "SUAREZ"), msg);

console.log("OK verify-corina-fuera-servicio");
