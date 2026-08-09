#!/usr/bin/env node
/**
 * Smoke: dominio + exports del agente de reclamos (diálogo IA).
 * Uso: node scripts/verify-reclamos-ia-dialogo.mjs
 */
import assert from "node:assert/strict";
import {
  RECLAMO_MOTIVOS,
  RECLAMO_MOTIVO_LABEL,
  labelMotivo,
  calcularSlaLabel,
  motivoRequiereFoto,
} from "../lib/reclamos.mjs";
import {
  procesarReclamoWhatsApp,
  turnoAgenteReclamos,
  mensajeDecisionReclamo,
} from "../lib/reclamos-wa.mjs";

assert.ok(RECLAMO_MOTIVOS.includes("demora_entrega"));
assert.ok(RECLAMO_MOTIVOS.includes("producto_equivocado"));
assert.equal(labelMotivo("faltante"), RECLAMO_MOTIVO_LABEL.faltante);
assert.equal(motivoRequiereFoto("averia"), true, "dañado pide foto");
assert.equal(motivoRequiereFoto("producto_equivocado"), true, "equivocado pide foto");
assert.equal(motivoRequiereFoto("demora_entrega"), false, "demora NO pide foto");
assert.equal(motivoRequiereFoto("faltante"), false, "faltante NO pide foto");
assert.equal(typeof procesarReclamoWhatsApp, "function");
assert.equal(typeof turnoAgenteReclamos, "function");
assert.ok(
  mensajeDecisionReclamo({
    id: "RC-TEST",
    estado: "resuelto",
    motivo: "demora_entrega",
  })?.includes("RC-TEST"),
);
assert.equal(
  calcularSlaLabel({ estado: "resuelto", created_at: new Date().toISOString() }),
  "Cumplido",
);

console.log("OK verify-reclamos-ia-dialogo");
