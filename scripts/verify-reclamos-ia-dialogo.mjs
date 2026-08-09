#!/usr/bin/env node
/**
 * Smoke: dominio + exports del agente de reclamos (diálogo IA).
 * Uso: node scripts/verify-reclamos-ia-dialogo.mjs
 */
import assert from "node:assert/strict";
import {
  RECLAMO_MOTIVOS,
  RECLAMO_MOTIVO_LABEL,
  RECLAMO_MOTIVO_ABBR,
  labelMotivo,
  calcularSlaLabel,
  motivoRequiereFoto,
  buildCodigoReclamo,
  extractCodigoReclamo,
  pareceConsultaEstadoReclamo,
  codigoVisible,
} from "../lib/reclamos.mjs";
import {
  procesarReclamoWhatsApp,
  turnoAgenteReclamos,
  mensajeDecisionReclamo,
  consultarEstadoReclamoWhatsApp,
} from "../lib/reclamos-wa.mjs";

assert.ok(RECLAMO_MOTIVOS.includes("demora_entrega"));
assert.ok(RECLAMO_MOTIVOS.includes("producto_equivocado"));
assert.equal(labelMotivo("faltante"), RECLAMO_MOTIVO_LABEL.faltante);
assert.equal(RECLAMO_MOTIVO_ABBR.averia, "PD");
assert.equal(RECLAMO_MOTIVO_ABBR.demora_entrega, "RT");
assert.equal(RECLAMO_MOTIVO_ABBR.producto_equivocado, "PE");
assert.equal(RECLAMO_MOTIVO_ABBR.otro, "OT");
assert.equal(motivoRequiereFoto("averia"), true, "dañado pide foto");
assert.equal(motivoRequiereFoto("producto_equivocado"), true, "equivocado pide foto");
assert.equal(motivoRequiereFoto("demora_entrega"), false, "demora NO pide foto");
assert.equal(motivoRequiereFoto("faltante"), false, "faltante NO pide foto");

const c1 = buildCodigoReclamo("averia", [], new Date("2026-08-09T12:00:00"));
assert.match(c1, /^RC-20260809-0001-PD$/);
const c2 = buildCodigoReclamo("demora_entrega", [{ codigo: c1 }], new Date("2026-08-09T12:00:00"));
assert.match(c2, /^RC-20260809-0002-RT$/);
assert.equal(extractCodigoReclamo("hola mi caso es RC-20260809-0001-PD gracias"), "RC-20260809-0001-PD");
assert.equal(pareceConsultaEstadoReclamo("cómo va mi reclamo?"), true);
assert.equal(pareceConsultaEstadoReclamo("quiero pedir un viaje"), false);
assert.equal(codigoVisible({ codigo: c1, id: "RID-X" }), c1);

assert.equal(typeof procesarReclamoWhatsApp, "function");
assert.equal(typeof turnoAgenteReclamos, "function");
assert.equal(typeof consultarEstadoReclamoWhatsApp, "function");
assert.ok(
  mensajeDecisionReclamo({
    id: "RID-TEST",
    codigo: "RC-20260809-0001-PD",
    estado: "resuelto",
    motivo: "averia",
  })?.includes("RC-20260809-0001-PD"),
);
assert.ok(
  mensajeDecisionReclamo({
    id: "RID-TEST",
    codigo: "RC-20260809-0002-RT",
    estado: "en_proceso",
    motivo: "demora_entrega",
  })?.toLowerCase().includes("agente"),
);
assert.equal(
  calcularSlaLabel({ estado: "resuelto", created_at: new Date().toISOString() }),
  "Cumplido",
);

console.log("OK verify-reclamos-ia-dialogo");
