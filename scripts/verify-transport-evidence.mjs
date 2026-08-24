#!/usr/bin/env node
/**
 * Tests mínimos — Evidencias de Transporte POP/POD.
 * Uso: node scripts/verify-transport-evidence.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sol-evidence-"));
process.env.DATA_DIR = tmp;

const evidenceStore = await import("../backend/src/db/evidence-store.mjs");
const podStore = await import("../backend/src/db/pod-store.mjs");
const {
  compareQuantities,
  comparePopPod,
  syncMilestonesForTrip,
  getTripEvidenceSummary,
} = await import("../backend/src/services/evidence-service.mjs");
const { getEvidenceConfig, __resetEvidenceConfigCache } = await import("../lib/evidence-config.mjs");

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  failed += 1;
  console.error(`  ✗ ${name}:`, err?.message || err);
}

try {
  console.log("\n=== Evidencias POP/POD ===\n");

  // POP create
  const pop = evidenceStore.createEvidence({
    telefono: "5491112345678",
    type: "POP",
    chofer_nombre: "Test Chofer",
    trip_id: "viaje_test1",
    viaje_ref: "VJ-TEST-001",
    estado: "pendiente",
    reported_quantities: { pallets: 20, cajas: 1000 },
    expected_quantities: { pallets: 20, cajas: 1000 },
    tenant_id: "tsb",
  });
  if (pop.type === "POP" && pop.codigo?.startsWith("POP-")) ok("creación POP");
  else fail("creación POP", "type/codigo");

  // POD via pod-store compat
  const pod = await podStore.crearPod({
    telefono: "5491112345678",
    chofer_nombre: "Test Chofer",
    trip_id: "viaje_test1",
    viaje_ref: "VJ-TEST-001",
    receptor_nombre: "María",
    estado: "pendiente",
    reported_quantities: { pallets: 20, cajas: 998 },
  });
  if (pod.type === "POD" || !pod.type) ok("creación POD compat");
  else fail("creación POD compat");

  // Attachments
  const withAtt = evidenceStore.updateEvidence(pop.id, {
    attachment: { url: "/api/media/x.jpg", mimeType: "image/jpeg" },
  });
  if ((withAtt.attachments || []).length >= 1) ok("adjuntos múltiples");
  else fail("adjuntos múltiples");

  // Compare
  const cmp = comparePopPod(
    { reported_quantities: { cajas: 1000 } },
    { reported_quantities: { cajas: 998 } },
  );
  if (cmp.hasDifference && cmp.diffs[0]?.delta === -2) ok("comparación POP vs POD");
  else fail("comparación POP vs POD", cmp);

  const plan = compareQuantities({ cajas: 1000 }, { cajas: 950 });
  if (plan.hasDifference) ok("comparación plan vs POP");

  // Milestones
  await syncMilestonesForTrip("viaje_test1");
  const ms = evidenceStore.getTripMilestones("viaje_test1");
  if (ms.pop?.status === "received") ok("milestone POP received");

  // Decide POP
  evidenceStore.decideEvidence(pop.id, { estado: "ok", aprobado_por: "mesa" });
  await syncMilestonesForTrip("viaje_test1");
  const ms2 = evidenceStore.getTripMilestones("viaje_test1");
  if (ms2.pop?.status === "approved") ok("aprobación POP → milestone");

  // Summary
  const summary = await getTripEvidenceSummary("viaje_test1");
  if (summary.pop && summary.pod) ok("resumen por viaje");

  // Tenant config
  __resetEvidenceConfigCache();
  process.env.SOL_EVIDENCE_CONFIG_JSON = JSON.stringify({ tsb: { require_pop: true } });
  __resetEvidenceConfigCache();
  if (getEvidenceConfig("tsb").require_pop === true) ok("config tenant require_pop");

  // Migration legacy
  const legacyPath = path.join(tmp, "pod-casos.json");
  fs.writeFileSync(
    legacyPath,
    JSON.stringify([
      {
        id: "POD-LEGACY1",
        estado: "ok",
        telefono: "5491199999999",
        codigo: "POD-0009",
        imagen_url: "/old.jpg",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        historial: [],
      },
    ]),
  );
  fs.unlinkSync(path.join(tmp, "transport-evidence.json"));
  evidenceStore.__dangerousResetEvidenceForTests();
  const migrated = evidenceStore.listEvidence({ limit: 10 });
  if (migrated.some((r) => r.id === "POD-LEGACY1" && r.type === "POD")) ok("migración POD histórico");
  else fail("migración POD histórico");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
