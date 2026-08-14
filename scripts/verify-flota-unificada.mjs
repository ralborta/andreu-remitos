#!/usr/bin/env node
/**
 * Verifica unificación de identidad flota Viajes ↔ Parámetros (master-data).
 * Usa DATA_DIR temporal; sin tocar data de producción.
 *
 *   node scripts/verify-flota-unificada.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flota-unificada-"));
process.env.DATA_DIR = tmp;
process.env.FLOTA_IDENTIDAD_TENANT = "tsb";
process.env.VIAJES_FLOTA_SKIP_SEED = "true";

const flota = await import("../backend/src/db/flota-unificada.mjs");
const master = await import("../backend/src/db/master-data-store.mjs");
const viajesStore = await import("../backend/src/db/viajes-flota-store.mjs");

console.log("1) Crear chofer en flota → aparece en master por teléfono");
const chFlota = await flota.crearChoferFlotaConSync({
  nombre: "Ana Test",
  telefono: "54911-8888-0001",
  dias_semana: [1, 2, 3, 4, 5],
  horarios: ["09:00", "14:00"],
});
assert.equal(chFlota.nombre, "Ana Test");
const mastersCh = await master.listCollection("choferes", { tenant: "tsb" });
const matchCh = mastersCh.find((c) => master.normalizePhone(c.telefono) === "5491188880001");
assert.ok(matchCh, "chofer debe existir en parametros/master");
assert.equal(matchCh.nombre, "Ana Test");

console.log("2) Crear camión en flota → aparece unidad tractor en master por patente");
const camFlota = await flota.crearCamionFlotaConSync({
  tractor: "ZZ 100 AA",
  semi: "YY 200 BB",
  tipo: "sider",
  capacidad_t: 24,
});
assert.equal(camFlota.tractor, "ZZ 100 AA");
const mastersUn = await master.listCollection("unidades", { tenant: "tsb" });
const matchUn = mastersUn.find(
  (u) => master.normalizePatente(u.patente) === "ZZ 100 AA" && u.tipo === "tractor",
);
assert.ok(matchUn, "unidad tractor debe existir en master");
assert.equal(master.normalizePatente(matchUn.semi_patente), "YY 200 BB");

console.log("3) Crear en master (mismo teléfono) → list flota no duplica identidad");
const beforeList = await flota.listChoferesFlotaEnriquecidos();
const nBefore = beforeList.length;
const phonesBefore = beforeList.map((c) => master.normalizePhone(c.telefono));
assert.equal(new Set(phonesBefore).size, phonesBefore.length, "teléfonos únicos en flota");

await flota.createChoferParametrosSinDuplicar({
  tenant: "tsb",
  nombre: "Ana Actualizada Master",
  telefono: "5491188880001",
});
const afterMaster = await master.listCollection("choferes", { tenant: "tsb" });
const anaRows = afterMaster.filter((c) => master.normalizePhone(c.telefono) === "5491188880001");
assert.equal(anaRows.length, 1, "no duplicar chofer en master");
assert.equal(anaRows[0].nombre, "Ana Actualizada Master");

const afterList = await flota.listChoferesFlotaEnriquecidos();
assert.equal(afterList.length, nBefore, "list flota no agrega filas por upsert master");
const anaEnriquecida = afterList.find((c) => master.normalizePhone(c.telefono) === "5491188880001");
assert.ok(anaEnriquecida);
assert.equal(anaEnriquecida.nombre, "Ana Actualizada Master", "enriquece nombre desde master");
assert.equal(anaEnriquecida.identidad_fuente, "master+viajes");
assert.ok(anaEnriquecida.master_id);

console.log("4) Crear unidad en master (misma patente) → no duplica; enriquece flota");
await flota.createUnidadParametrosSinDuplicar({
  tenant: "tsb",
  tipo: "tractor",
  patente: "ZZ 100 AA",
  semi_patente: "YY 200 BB",
  unidad_interna: "T-99",
});
const unAfter = await master.listCollection("unidades", { tenant: "tsb" });
const zzRows = unAfter.filter((u) => master.normalizePatente(u.patente) === "ZZ 100 AA");
assert.equal(zzRows.length, 1, "no duplicar unidad por patente");
assert.equal(zzRows[0].unidad_interna, "T-99");

const cams = await flota.listCamionesFlotaEnriquecidos();
const camEnr = cams.find((c) => master.normalizePatente(c.tractor) === "ZZ 100 AA");
assert.ok(camEnr);
assert.equal(camEnr.unidad_interna, "T-99");
assert.equal(camEnr.identidad_fuente, "master+viajes");

console.log("5) Horarios Viajes intactos tras sync de identidad");
const raw = viajesStore.listChoferesViajes().find((c) => c.id === chFlota.id);
assert.deepEqual(raw.horarios, ["09:00", "14:00"]);
assert.deepEqual(raw.dias_semana, [1, 2, 3, 4, 5]);

console.log("\nOK verify-flota-unificada");
console.log(`DATA_DIR=${tmp}`);
