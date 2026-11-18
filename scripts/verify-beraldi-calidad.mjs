#!/usr/bin/env node
/**
 * Tests de calidad Beraldi: fecha, OT, peso, km, aliases, OK WhatsApp, gates de proceso.
 */
import assert from "node:assert/strict";
import { normalizarPeso, extraerBeraldi } from "../lib/extract-cold.mjs";
import {
  enriquecerBeraldiDesdeTexto,
  extraerOtBeraldi,
  normalizarAliasLugarBeraldi,
} from "../lib/enriquecer-beraldi-ocr.mjs";
import {
  sanearFechaRespectoRecepcion,
  validarKmBeraldi,
  validarPesoBeraldi,
  validarCalidadBeraldi,
  otBeraldiValida,
} from "../lib/validacion-calidad-beraldi.mjs";
import { findLocalidad, puntajeLocalidad } from "../lib/planilla-common.mjs";
import { mergeValidacionRemito } from "../lib/validacion-maestros.mjs";
import { evaluarProcesable } from "../lib/remito-procesable.mjs";
import { esPalabraConfirmacion } from "../lib/sanitizar-campos-remito.mjs";
import { pieMensajeBloqueado } from "../lib/builderbot-webhook.mjs";
import { normalizarDatosRemito } from "../lib/normalizar-remito.mjs";
import { findUnidad } from "../lib/maestros-match.mjs";

// ——— Peso: toneladas vs kg ———
assert.equal(normalizarPeso("31,34"), 31340, "31,34 tn → kg");
assert.equal(normalizarPeso("32.06"), 32060, "32.06 tn → kg");
assert.equal(normalizarPeso("32.06 tn"), 32060);
assert.equal(normalizarPeso("3206"), 32060, "3206 truncado → *10");
assert.equal(normalizarPeso("31500"), 31500);
assert.equal(normalizarPeso("31.500"), 31500);

// ——— OT ———
assert.equal(extraerOtBeraldi("CLIENTE YPF S.A. OT-354070"), "354070");
assert.equal(extraerOtBeraldi("OT 353896\nCHOFER Jonathan"), "353896");
assert.equal(extraerOtBeraldi("Not: 351633"), "351633");
// dígito de más 3351633 → 351633
assert.equal(extraerOtBeraldi("OT 3351633"), "351633");
assert.equal(otBeraldiValida("").ok, false);
assert.equal(otBeraldiValida("354070").ok, true);
assert.equal(otBeraldiValida("123").ok, false);

const enriqOt = enriquecerBeraldiDesdeTexto({ ot: null }, "CLIENTE: YPF S.A.  OT-354070\nCHOFER CAMARGO");
assert.equal(enriqOt.ot, "354070");

const enriqOtLargo = enriquecerBeraldiDesdeTexto({ ot: "3351633" }, "OT 351633");
assert.equal(enriqOtLargo.ot, "351633");

// ——— Fecha invertida / mes mal leído ———
const recepcion = new Date("2026-11-17T15:00:00");
const fechaDic = sanearFechaRespectoRecepcion("2026-12-17", recepcion);
assert.equal(fechaDic.iso, "2026-11-17", "17/12 → 17/11 cerca de recepción");
assert.equal(fechaDic.sospechosa, false);

const fechaOk = sanearFechaRespectoRecepcion("2026-11-17", recepcion);
assert.equal(fechaOk.iso, "2026-11-17");

const fechaLejos = sanearFechaRespectoRecepcion("2026-01-05", recepcion);
assert.equal(fechaLejos.sospechosa, true);

// ——— Km ———
const kmMal = validarKmBeraldi("149037", "147037");
assert.equal(kmMal.ok, false);
assert.match(kmMal.errores[0], /menor/i);

const kmOk = validarKmBeraldi("146309", "146761");
assert.equal(kmOk.ok, true);

const kmSalto = validarKmBeraldi("100000", "110000");
assert.equal(kmSalto.ok, false);

// ——— Peso validación ———
assert.equal(validarPesoBeraldi(31340).ok, true);
assert.equal(validarPesoBeraldi(3206).ok, false);
assert.equal(validarPesoBeraldi(31500, { estimado: true }).ok, false);

const normPeso = normalizarDatosRemito({ nro_remito: "00190128-4" }, "beraldi");
assert.equal(normPeso.peso_kg, 31500);
assert.equal(normPeso._peso_estimado, true);

// Corregir peso limpia el flag estimado (Codex P1).
const pesoCorregido = normalizarDatosRemito(
  { nro_remito: "00190128-4", peso_kg: 31340, _peso_estimado: true, _editado_manual: true },
  "beraldi",
);
assert.equal(pesoCorregido.peso_kg, 31340);
assert.equal(pesoCorregido._peso_estimado, undefined);
assert.equal(validarPesoBeraldi(pesoCorregido.peso_kg, { estimado: pesoCorregido._peso_estimado === true }).ok, true);

// Enrich con created_at fijo no reescribe fecha al “hoy” futuro (Codex P1).
const fechaEstable = enriquecerBeraldiDesdeTexto(
  { fecha_remito: "2026-11-17" },
  "FECHA: 17-11-26 CLIENTE YPF",
  { referenciaFecha: "2026-11-17T18:00:00.000Z" },
);
assert.equal(fechaEstable.fecha_remito, "2026-11-17");
const fechaNoTocarManual = enriquecerBeraldiDesdeTexto(
  { fecha_remito: "2026-11-17", _editado_manual: true },
  "FECHA: 17-12-26",
  { referenciaFecha: "2026-12-18T12:00:00.000Z" },
);
assert.equal(fechaNoTocarManual.fecha_remito, "2026-11-17");

// ——— Aliases lugar ———
assert.match(normalizarAliasLugarBeraldi("Iron 22") ?? "", /TRON-22/i);
assert.match(normalizarAliasLugarBeraldi("TQN-22") ?? "", /TRON-22/i);
assert.match(normalizarAliasLugarBeraldi("Ton-22") ?? "", /TRON-22/i);
assert.match(normalizarAliasLugarBeraldi("coma campana") ?? "", /LOMA CAMPANA/i);

const locs = [
  { id: "1", nombre: "TRON-22", codigo: "TRON22", activo: true },
  { id: "2", nombre: "LOMA CAMPANA", codigo: "LC", activo: true },
  { id: "3", nombre: "CIMSA", codigo: "CIMSA", activo: true },
  { id: "4", nombre: "TRON-15", codigo: "TRON15", activo: true },
];
assert.equal(findLocalidad(locs, "Iron 22")?.nombre, "TRON-22");
assert.equal(findLocalidad(locs, "coma campana")?.nombre, "LOMA CAMPANA");
assert.ok(puntajeLocalidad(locs[0], "TQN-22") >= 80);

// ——— Patentes: fuzzy no inventa con umbral alto ———
const unidades = [
  { id: "u1", patente: "AH860KG", tipo: "tractor", activo: true },
  { id: "u2", patente: "AH318WC", tipo: "acoplado", activo: true },
];
assert.equal(findUnidad(unidades, "AH860KG", "tractor")?.patente, "AH860KG");
assert.equal(findUnidad(unidades, "AH860KI", "tractor")?.patente, "AH860KG"); // dist 1 único
assert.equal(findUnidad(unidades, "UN100AD", "tractor"), null, "no inventar UN100AD");
assert.equal(findUnidad(unidades, "SE610IO", "tractor"), null);
// Ambiguo entre dos tractores cercanos → no adivinar
assert.equal(
  findUnidad(
    [
      ...unidades,
      { id: "u3", patente: "AH860KH", tipo: "tractor", activo: true },
    ],
    "AH860KI",
    "tractor",
  ),
  null,
);

// ——— Calidad + merge bloquea procesar ———
const calidad = validarCalidadBeraldi(
  {
    fecha_remito: "2026-12-17",
    ot: "",
    tractor: "UN100AD",
    semi: "AH318WC",
    origen: "Iron 22",
    destino: "TRON-22",
    peso_kg: 31500,
    _peso_estimado: true,
    km_inicial: "149037",
    km_final: "147037",
  },
  { localidades: locs, createdAt: recepcion },
);
assert.equal(calidad.ok, false);
assert.ok(calidad.faltantes.includes("OT") || calidad.errores.some((e) => /OT/i.test(e)));
assert.ok(calidad.errores.some((e) => /[Pp]eso|km/i.test(e)));

const merged = mergeValidacionRemito(
  { valido: true, faltantes: [], errores: [] },
  { ok: true, faltantes: [], errores: [], localidad: locs[0] },
  {
    ok: false,
    errores: ['Tractor: "UN100AD" no está en la base de unidades — corregir antes de procesar'],
    faltantes: [],
  },
  calidad,
);
assert.equal(merged.valido, false);
assert.ok(merged.errores.length >= 2);

const rowBloqueado = {
  tenant: "beraldi",
  estado: "bloqueado",
  datos: { horarios: { horarios: {
    carga_entrada: { hora: "08:00" },
    carga_salida: { hora: "09:00" },
    descarga_llegada: { hora: "10:00" },
    descarga_inicio: { hora: "10:15" },
    descarga_fin: { hora: "11:00" },
  } } },
  validacion: merged,
};
assert.equal(evaluarProcesable(rowBloqueado).ok, false);

const rowOk = {
  tenant: "beraldi",
  estado: "pendiente_revision",
  datos: {
    fecha_remito: "2026-11-17",
    ot: "354070",
    horarios: { horarios: {
      carga_entrada: { hora: "08:00" },
      carga_salida: { hora: "09:00" },
      descarga_llegada: { hora: "10:00" },
      descarga_inicio: { hora: "10:15" },
      descarga_fin: { hora: "11:00" },
    } },
  },
  validacion: { valido: true, faltantes: [], errores: [] },
};
assert.equal(evaluarProcesable(rowOk).ok, true);

// ——— 0k = OK ———
assert.equal(esPalabraConfirmacion("0k"), true);
assert.equal(esPalabraConfirmacion("OK"), true);

// Simula la normalización del webhook
function esConfirmacionOkLocal(texto) {
  const t = String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\b0k\b/g, "ok")
    .replace(/[.!?,¿¡]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(ok|okey|okay|dale|listo|correcto|confirmo|confirmado|perfecto|si|todo bien|esta bien|de acuerdo|claro|joya|genial)$/.test(t);
}
assert.equal(esConfirmacionOkLocal("0k"), true);
assert.equal(esConfirmacionOkLocal("0K!"), true);

// ——— Mensaje bot pide dato concreto ———
const pie = pieMensajeBloqueado({
  errores: ['Tractor: "UN100AD" no está en la base de unidades — corregir antes de procesar'],
  faltantes: ["OT"],
});
assert.match(pie, /patentes|OT|Tractor/i);
assert.match(pie, /OK/);

// ——— Extracción frío del OCR tipo Camargo ———
const ocrCamargo = `
REMITO N° 00009-00190128-4
FECHA: 17-11-26
CLIENTE: YPF S.A. OT-354070
CHOFER CAMARGO MARTIN
ALMACEN: LOMA CAMPANA
DENOMIC: Lote 48
LOCACION: TRON 24
TRACTOR AH860KH
SEMI AD215TD
CANTIDAD 31,34
Km Inicial 146309
Km Final 146761
`;
const frio = extraerBeraldi(ocrCamargo);
assert.equal(frio.ot, "354070");
assert.equal(frio.peso_kg, 31340);
const enriq = enriquecerBeraldiDesdeTexto({}, ocrCamargo);
assert.equal(enriq.ot, "354070");
assert.equal(enriq.fecha_remito, "2026-11-17");

console.log("OK verify-beraldi-calidad");
