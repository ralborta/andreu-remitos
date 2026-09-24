#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  enriquecerBeraldiDesdeTexto,
  extraerKmBeraldi,
} from "../lib/enriquecer-beraldi-ocr.mjs";

const ocrTacker = `
HORA INICIO 14:35 5:50
200794
Km Inicial
8220
Hs. Motor Inicial
HORA FIN 16:00
OT 2402903
Km Final
201072
Hs. Motor Final
8227
`;

const leido = extraerKmBeraldi(ocrTacker);
assert.equal(leido.motor_inicial, "8220");
assert.equal(leido.motor_final, "8227");
assert.equal(leido.km_inicial, "200794");
assert.equal(leido.km_final, "201072");

const vacio = enriquecerBeraldiDesdeTexto({}, ocrTacker);
assert.equal(vacio.km_inicial, "200794");
assert.equal(vacio.km_final, "201072");

const confundido = enriquecerBeraldiDesdeTexto(
  { km_inicial: "8220", km_final: "8227" },
  ocrTacker,
);
assert.equal(confundido.km_inicial, "200794");
assert.equal(confundido.km_final, "201072");

const clasico = extraerKmBeraldi("Km Inicial 89419 Km Final 89477 Hs. Motor Final 3984");
assert.equal(clasico.km_inicial, "89419");
assert.equal(clasico.km_final, "89477");
assert.equal(clasico.motor_final, "3984");

const copia2 = extraerKmBeraldi(
  "201072 Km Inicial 8227 Hs. Motor Inicial 08:15 HORA FIN 201351 Km Final Hs. Motor Final 8242",
);
assert.equal(copia2.km_inicial, "201072");
assert.equal(copia2.km_final, "201351");
assert.equal(copia2.motor_inicial, "8227");
assert.equal(copia2.motor_final, "8242");

const conRuido = extraerKmBeraldi(
  "Km Inicial 2002 140131 Hs. Motor Inicial 8 Km Final 140270 Hs. Motor Final 5167",
);
assert.equal(conRuido.km_inicial, "140131");
assert.equal(conRuido.km_final, "140270");

const yaBien = enriquecerBeraldiDesdeTexto(
  { km_inicial: "140270", km_final: "140550" },
  "Km Inicial 140270 Km Final 140550 Hs. Motor Inicial 8199 Hs. Motor Final 8210",
);
assert.equal(yaBien.km_inicial, "140270");
assert.equal(yaBien.km_final, "140550");

console.log("OK verify-beraldi-km");
