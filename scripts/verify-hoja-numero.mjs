#!/usr/bin/env node
/**
 * El chofer confirma el número impreso en la hoja de ruta antes de cargar tickets.
 * Uso: node scripts/verify-hoja-numero.mjs
 */
import assert from "node:assert/strict";
import {
  extraerNumeroViajeHoja,
  interpretarRespuestaNumeroHoja,
  mensajeConfirmarNumeroHoja,
  mensajeConfirmacionHojaRuta,
  mensajePedirNumeroHoja,
} from "../lib/hoja-ruta.mjs";

assert.equal(extraerNumeroViajeHoja("605095"), "605095");
assert.equal(extraerNumeroViajeHoja("sí es 605095"), "605095");
assert.equal(extraerNumeroViajeHoja("no, es 99120"), "99120");
assert.equal(extraerNumeroViajeHoja("5492616836663"), null);
assert.equal(extraerNumeroViajeHoja("sí"), null);

const pregunta = mensajeConfirmarNumeroHoja("605095");
assert.match(pregunta, /605095/);
assert.match(pregunta, /SÍ/);
assert.match(pregunta, /NO/);
assert.match(mensajeConfirmarNumeroHoja(null), /no pude leer/i);

assert.equal(interpretarRespuestaNumeroHoja("sí", "confirmar").accion, "aceptar");
assert.equal(interpretarRespuestaNumeroHoja("no", "confirmar").accion, "pedir");
assert.deepEqual(interpretarRespuestaNumeroHoja("no, es 99120", "confirmar"), {
  accion: "guardar",
  numero: "99120",
});
assert.equal(interpretarRespuestaNumeroHoja("hola", "escribir").accion, "repedir");

assert.match(mensajePedirNumeroHoja(), /número de viaje correcto/i);
const listo = mensajeConfirmacionHojaRuta({
  codigo: "HR-0001",
  nro_viaje_delfos: "605095",
  anticipo_monto: null,
});
assert.match(listo, /605095/);
assert.match(listo, /Delfos/);
assert.match(listo, /listo/i);

console.log("OK verify-hoja-numero");
