#!/usr/bin/env node
/**
 * UX remitos: Corina saludo, copy de bloqueo, Semi/Remolque vs gasto.
 * Uso: node scripts/verify-remito-ux-fixes.mjs
 */
import assert from "node:assert/strict";
import {
  esSaludoSimple,
  mensajeCorinaRepedirCliente,
  mensajeEsperandoCorreccion,
  pieMensajeBloqueado,
} from "../lib/builderbot-webhook.mjs";
import { pareceRendicionGasto } from "../lib/rendicion-wa.mjs";
import { parseCorreccionChofer, parseTodasCorreccionesChofer } from "../lib/correcciones-chofer.mjs";

assert.equal(esSaludoSimple("Hola"), true);
assert.equal(esSaludoSimple("buenas tardes"), true);
assert.equal(esSaludoSimple("Cervecería"), false);

const repedir = mensajeCorinaRepedirCliente();
assert.match(repedir, /Cervecería/);
assert.match(repedir, /Eco/);
assert.doesNotMatch(repedir, /Soy el asistente/);

const noEntendi = mensajeCorinaRepedirCliente({ noEntendido: true });
assert.match(noEntendi, /No reconocí/);

const soloHoras = pieMensajeBloqueado({
  errores: ["Descarga fin (09/11/2026 20:05) es anterior a Descarga inicio — revisar mezcla carga/descarga"],
  faltantes: [],
});
assert.match(soloHoras, /problema con las horas/i);
assert.match(soloHoras, /salida carga/);

const soloDestino = pieMensajeBloqueado({
  errores: ['Destino "Tron 25 Laje" no está en la base de localidades — corregir antes de procesar'],
  faltantes: [],
});
assert.match(soloDestino, /problema con el destino/i);
assert.doesNotMatch(soloDestino, /problema con las horas/i);

const soloPatente = pieMensajeBloqueado({
  errores: ['Semi / remolque: "AH318WC" no está en la base de unidades — corregir antes de procesar'],
  faltantes: [],
});
assert.match(soloPatente, /patentes\/unidades/i);

const esperando = mensajeEsperandoCorreccion({
  estado: "bloqueado",
  validacion: {
    errores: ['Destino "X" no está en la base de localidades — corregir antes de procesar'],
  },
});
assert.match(esperando, /Entendido/);
assert.match(esperando, /destino/i);
assert.doesNotMatch(esperando, /tema con las horas/);

const texto = "Semi/ Remolque:AH318WC Destino: Tron 25 Laje";
assert.equal(pareceRendicionGasto(texto), false);
const una = parseCorreccionChofer(texto);
assert.equal(una?.campo, "patente_acoplado");
assert.match(String(una?.valor ?? ""), /AH318WC/i);
const todas = parseTodasCorreccionesChofer(texto);
assert.ok(todas.some((c) => c.campo === "patente_acoplado"));
assert.ok(todas.some((c) => c.campo === "destino" || /destino/i.test(c.etiqueta ?? "")));

console.log("OK verify-remito-ux-fixes");
