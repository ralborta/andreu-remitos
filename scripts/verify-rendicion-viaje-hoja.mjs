#!/usr/bin/env node
/**
 * Confirmación del nº de viaje de la hoja de ruta (no el Delfos de mesa).
 * Uso: node scripts/verify-rendicion-viaje-hoja.mjs
 */
import assert from "node:assert/strict";
import {
  extraerNumeroViaje,
  interpretarRespuestaViajeHoja,
  mensajeConfirmarViajeHoja,
  mensajePedirNumeroViajeHoja,
  mensajeViajeHojaConfirmado,
  pareceHojaRuta,
  pareceRendicionGasto,
} from "../lib/rendicion-wa.mjs";

assert.equal(pareceHojaRuta("te mando la hoja de ruta"), true);
assert.equal(pareceHojaRuta("hoja ruta del viaje"), true);
assert.equal(pareceHojaRuta("ticket de peaje"), false);
assert.equal(pareceRendicionGasto("peaje ypf"), true);
assert.equal(pareceHojaRuta("peaje ypf"), false);

assert.equal(extraerNumeroViaje("24831"), "24831");
assert.equal(extraerNumeroViaje("es el VJ-24831"), "VJ-24831");
assert.equal(extraerNumeroViaje("sí es 24831"), "24831");
assert.equal(extraerNumeroViaje("no, es 99120"), "99120");
assert.equal(extraerNumeroViaje("5492616836663"), null);
assert.equal(extraerNumeroViaje("sí"), null);

const conNumero = mensajeConfirmarViajeHoja("24831");
assert.match(conNumero, /24831/);
assert.match(conNumero, /SÍ/);
assert.match(conNumero, /NO/);
assert.doesNotMatch(conNumero, /Delfos/i);

const sinNumero = mensajeConfirmarViajeHoja(null);
assert.match(sinNumero, /no pude leer/i);
assert.match(sinNumero, /escribime/i);

assert.equal(interpretarRespuestaViajeHoja("sí", "confirmar").accion, "aceptar");
assert.equal(interpretarRespuestaViajeHoja("ok", "confirmar").accion, "aceptar");
assert.equal(interpretarRespuestaViajeHoja("no", "confirmar").accion, "pedir");
assert.deepEqual(interpretarRespuestaViajeHoja("no, es 99120", "confirmar"), {
  accion: "guardar",
  numero: "99120",
});
assert.deepEqual(interpretarRespuestaViajeHoja("99120", "escribir"), {
  accion: "guardar",
  numero: "99120",
});
assert.equal(interpretarRespuestaViajeHoja("hola", "escribir").accion, "repedir");
assert.equal(interpretarRespuestaViajeHoja("después te digo", "confirmar").accion, "repreguntar");

assert.match(mensajePedirNumeroViajeHoja(), /número de viaje correcto/i);
const listo = mensajeViajeHojaConfirmado("99120");
assert.match(listo, /99120/);
assert.match(listo, /pendiente de aprobación/i);
assert.match(listo, /Delfos/);

console.log("OK verify-rendicion-viaje-hoja");
