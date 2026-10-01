#!/usr/bin/env node
/**
 * Remito Beraldi con cliente YPF no debe ir a nafta.
 * Uso: node scripts/verify-documento-andreu-remito.mjs
 */
import assert from "node:assert/strict";
import {
  clasificarDocumentoAndreu,
  pareceDocumentoRemito,
  captionVagoDocumento,
  interpretarRespuestaTipoDocumento,
  mensajePreguntarTipoDocumento,
} from "../lib/documento-andreu.mjs";
import { pareceDocumentoGasto } from "../lib/rendicion-wa.mjs";

const beraldiYpf = `
TRANSPORTES BERALDI S.A.
REMITO N° 00009-00177065-1
CLIENTE: YPF S.A.
N° CONTRATO / OC: 45000 92920
SERVICIO TRANSPORTE: Andreu
UNIDAD: 548
TRACTOR: AG 931 YP
SEMI: AH 318 WB
CHOFER: Pereira Anibal
PRODUCTO: Arena
LLEGADA A LA CARGA
`;

assert.equal(pareceDocumentoGasto(beraldiYpf), false, "YPF cliente de remito ≠ nafta");
assert.equal(pareceDocumentoRemito(beraldiYpf), true, "debe ser remito");
assert.equal(clasificarDocumentoAndreu(beraldiYpf), "remito");

// OCR flojo: sin marca Beraldi ni palabra remito, pero con formulario
const flojo = `
CLIENTE YPF S.A.
TRACTOR AG 931 YP
SEMI AH 318 WB
CHOFER Pereira
PRODUCTO Arena
KM INICIAL 201909
`;
assert.equal(clasificarDocumentoAndreu(flojo), "remito", "formulario logístico = remito");

const ticketYpf = `
YPF ESTACION DE SERVICIO
TICKET
NAFTA SUPER 40 LTS
CUIT 30-54668997-9
TOTAL $ 85000
`;
assert.equal(clasificarDocumentoAndreu(ticketYpf), "gasto", "ticket YPF real = gasto");

assert.equal(captionVagoDocumento("comprobante"), true);
assert.equal(captionVagoDocumento("peaje ruta 7"), false);
assert.equal(interpretarRespuestaTipoDocumento("remito"), "remito");
assert.equal(interpretarRespuestaTipoDocumento("ticket"), "gasto");
assert.match(mensajePreguntarTipoDocumento(), /remito/i);

console.log("OK verify-documento-andreu-remito");
