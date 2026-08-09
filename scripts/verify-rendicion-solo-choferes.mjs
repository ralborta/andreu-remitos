#!/usr/bin/env node
import assert from "node:assert/strict";
import { clasificarIntencionHeuristica } from "../lib/wa-intent-router.mjs";
import { mensajeRendicionSoloChoferes } from "../backend/src/services/rendicion-agent.mjs";

assert.equal(
  clasificarIntencionHeuristica("tengo un peaje para rendir", { esChoferRemitos: false })
    .intent,
  "desconocido",
  "cliente no entra a rendición",
);
assert.equal(
  clasificarIntencionHeuristica("tengo un peaje para rendir", { esChoferRemitos: true })
    .intent,
  "rendicion",
  "chofer sí entra a rendición",
);
const menuCliente = clasificarIntencionHeuristica("hola", { esChoferRemitos: false }).mensaje || "";
assert.ok(!/rendici/i.test(menuCliente), "menú cliente sin rendición");
assert.ok(/reclamo/i.test(menuCliente), "menú cliente ofrece reclamo");
assert.ok(/choferes registrados/i.test(mensajeRendicionSoloChoferes()));

console.log("OK verify-rendicion-solo-choferes");
