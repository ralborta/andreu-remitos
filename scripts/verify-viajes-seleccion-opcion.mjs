#!/usr/bin/env node
/**
 * Regresión: selección numerada de propuestas de viajes (demo SOL).
 * Caso Gonzalo: "2" debe ser 13:00, no 16:00.
 *
 * Uso: node scripts/verify-viajes-seleccion-opcion.mjs
 */
import {
  indiceOpcion,
  parseSeleccionOpcion,
  resolverSlotPropuesta,
} from "../lib/viajes-agente.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const opciones = [
  { fecha: "2026-08-21", hora: "16:00" },
  { fecha: "2026-08-21", hora: "13:00" },
  { fecha: "2026-08-21", hora: "10:00" },
];

// Parser 1-based
assert(parseSeleccionOpcion("2") === 2, 'parse "2" → 2');
assert(parseSeleccionOpcion("1") === 1, 'parse "1" → 1');
assert(parseSeleccionOpcion("opción 2") === 2, 'parse opción 2');
assert(parseSeleccionOpcion("la 3") === 3, "parse la 3");
assert(parseSeleccionOpcion("sí") == null, "sí no es número");
assert(indiceOpcion(2, 3) === 1, "índice de 2 → 1");

// Caso demo: cliente elige 2 → 13:00
const r2 = resolverSlotPropuesta({ opciones, texto: "2" });
assert(r2.slot?.hora === "13:00", `esperado 13:00, got ${r2.slot?.hora}`);
assert(r2.motivo === "numero", "motivo numero");

// Opción 1 → 16:00
const r1 = resolverSlotPropuesta({ opciones, texto: "1" });
assert(r1.slot?.hora === "16:00", "opción 1 → 16:00");

// "sí" con varias → pedir número (NO asumir la 1)
const rsi = resolverSlotPropuesta({ opciones, texto: "sí" });
assert(rsi.slot == null && rsi.motivo === "pedir_numero", "sí multi → pedir_numero");

// "sí" con una sola → ok
const rUnica = resolverSlotPropuesta({
  opciones: [opciones[1]],
  texto: "dale",
});
assert(rUnica.slot?.hora === "13:00" && rUnica.motivo === "unica", "sí única ok");

// LLM manda seleccion 2 y texto vacío de sistema
const rLlm = resolverSlotPropuesta({ opciones, seleccion: 2, texto: "ok genérico" });
assert(rLlm.slot?.hora === "13:00", "seleccion LLM 2 → 13:00");

// Texto "2" gana aunque LLM diga 1 (bug Gonzalo)
const rOverride = resolverSlotPropuesta({ opciones, seleccion: 1, texto: "2" });
assert(rOverride.slot?.hora === "13:00", 'texto "2" gana sobre LLM=1');

// Selección fuera de rango
assert(resolverSlotPropuesta({ opciones, texto: "9" }).slot == null, "9 inválido");

console.log("OK verify-viajes-seleccion-opcion");
