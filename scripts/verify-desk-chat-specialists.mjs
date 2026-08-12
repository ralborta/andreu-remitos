/**
 * Protocolo funcional desk-chat — Viajes / Incidencias / Rendición / ETA / Remitos.
 * Usa planOverride/answerOverride (sin OpenAI) + stores temporales.
 * Verifica cero rules_fallback en path productivo.
 *
 *   node scripts/verify-desk-chat-specialists.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "desk-specs-"));
process.env.DATA_DIR = tmp;

const { ensureDeskChatCapabilities, resetDeskChatBootstrapForTests } = await import(
  "../backend/src/services/desk-chat/index.mjs"
);
const { _resetRegistryForTests, listCapabilities, executeCapability } = await import(
  "../backend/src/services/desk-chat/capability-registry.mjs"
);
const { runDeskChatTurn } = await import("../backend/src/services/desk-chat/runtime.mjs");

_resetRegistryForTests();
resetDeskChatBootstrapForTests();
ensureDeskChatCapabilities();

const user = { id: "test", permissions: ["desk:read"] };
const now = new Date().toISOString();

function writeJson(name, rows) {
  fs.writeFileSync(path.join(tmp, name), JSON.stringify(rows, null, 2));
}

writeJson("viajes.json", [
  {
    id: "vj1",
    codigo: "VJ-100",
    estado: "en_curso",
    tenant: "tsb",
    cliente: "Cli A",
    origen: "CABA",
    destino: "Córdoba Capital",
    chofer: "Perez",
    telefono_chofer: "54911",
    tractor: "AB123CD",
    semi: "XY999ZZ",
    created_at: now,
    updated_at: now,
  },
  {
    id: "vj2",
    codigo: "VJ-200",
    estado: "cerrado",
    tenant: "tsb",
    destino: "Rosario",
    chofer: "Gomez",
    tractor: "CD456EF",
    created_at: "2020-01-01T12:00:00.000Z",
    updated_at: "2020-01-01T12:00:00.000Z",
  },
]);

writeJson("incidencias.json", [
  {
    id: "inc1",
    codigo: "INC-0001",
    estado: "nueva",
    tipo: "demora",
    criticidad: "alta",
    chofer_nombre: "Perez",
    viaje_ref: "VJ-100",
    causa: "Tráfico",
    created_at: now,
    updated_at: now,
  },
  {
    id: "inc2",
    codigo: "INC-0002",
    estado: "resuelta",
    tipo: "pinchazo",
    viaje_ref: "VJ-200",
    created_at: "2020-01-01T12:00:00.000Z",
    updated_at: "2020-01-01T12:00:00.000Z",
  },
]);

writeJson("rendicion-gastos.json", [
  {
    id: "g1",
    codigo: "GST-0001",
    estado: "pendiente_aprobacion",
    categoria: "combustible",
    monto: 15000,
    moneda: "ARS",
    viaje_ref: "VJ-100",
    chofer_nombre: "Perez",
    created_at: now,
    updated_at: now,
  },
  {
    id: "g2",
    codigo: "GST-0002",
    estado: "aprobado",
    categoria: "peaje",
    monto: 2000,
    moneda: "ARS",
    created_at: now,
    updated_at: now,
  },
]);

writeJson("eta-notificaciones.json", []);
writeJson("destinos.json", [
  {
    id: "d1",
    estado: "en_ruta",
    telefono_cliente: "54911999",
    cliente: "Cliente ETA",
    formatted_address: "Córdoba",
    chofer_nombre: "Perez",
    viaje_ref: "VJ-100",
    eta_texto: "45 min",
    eta_minutos: 45,
    created_at: now,
    updated_at: now,
  },
]);

writeJson("remitos.json", [
  {
    id: "rem1",
    tenant: "tsb",
    estado: "confirmado",
    telefono_chofer: "54911",
    datos: {
      nro_guia: "001",
      destino: "Córdoba",
      conductor: "Perez",
      chasis: "AB123CD",
      fecha_guia: "2026-08-12",
    },
    created_at: now,
    updated_at: now,
  },
  {
    id: "rem2",
    tenant: "mye",
    estado: "pendiente_revision",
    datos: { nro_guia: "002", destino: "Rosario" },
    created_at: "2020-01-01T12:00:00.000Z",
    updated_at: "2020-01-01T12:00:00.000Z",
  },
]);

const names = listCapabilities()
  .map((c) => c.name)
  .sort();
assert.ok(names.includes("viajes.resumen"));
assert.ok(names.includes("incidencias.list"));
assert.ok(names.includes("rendicion.get"));
assert.ok(names.includes("eta.cola"));
assert.ok(names.includes("remitos.resumen"));
assert.ok(names.includes("pod.resumen"));

const report = [];

async function caseAgent(agentId, cases) {
  for (const c of cases) {
    const turn = await runDeskChatTurn({
      agentId,
      message: c.message,
      user,
      workingSet: c.workingSet,
      planOverride: c.plan,
      answerOverride: c.answer,
    });
    assert.equal(turn.engine, "llm", `${agentId}:${c.name} engine`);
    assert.notEqual(turn.engine, "rules_fallback");
    if (c.expectCaps) {
      assert.deepEqual(
        (turn.capabilityResults || []).map((r) => r.capability),
        c.expectCaps,
      );
      assert.ok((turn.capabilityResults || []).every((r) => r.ok));
    }
    if (c.assertReply) c.assertReply(turn);
    report.push({ agentId, name: c.name, engine: turn.engine, ok: true });
    console.log(`✓ ${agentId}.${c.name}`);
  }
}

// —— Viajes ——
{
  const resumen = await executeCapability("viajes.resumen", {}, { agentId: "viajes", user });
  assert.equal(resumen.result.total, 2);
  assert.equal(resumen.result.activos, 1);

  await caseAgent("viajes", [
    {
      name: "simple_total",
      message: "¿cuántos viajes tenemos?",
      plan: {
        type: "query",
        goal: "total viajes",
        queries: [{ capability: "viajes.resumen", args: {} }],
        workingSetOp: "replace",
      },
      answer: { reply: `Hay ${resumen.result.total} viajes.`, entityIds: [] },
      expectCaps: ["viajes.resumen"],
    },
    {
      name: "activos_list",
      message: "¿cuáles están activos?",
      plan: {
        type: "query",
        goal: "activos",
        queries: [{ capability: "viajes.list", args: { activos: true } }],
        workingSetOp: "replace",
      },
      answer: { reply: "Hay 1 activo: VJ-100.", entityIds: ["vj1"] },
      expectCaps: ["viajes.list"],
      assertReply: (t) => assert.deepEqual(t.workingSet.entityIds, ["vj1"]),
    },
    {
      name: "followup_cordoba",
      message: "¿y de esos cuáles van a Córdoba?",
      workingSet: { entityType: "viajes", entityIds: ["vj1"], label: "activos" },
      plan: {
        type: "query",
        goal: "filtrar Córdoba",
        queries: [
          {
            capability: "viajes.list",
            args: { workingSetOnly: true, destinoContains: "Córdoba" },
          },
        ],
        workingSetOp: "filter",
      },
      answer: { reply: "VJ-100 va a Córdoba Capital.", entityIds: ["vj1"] },
      expectCaps: ["viajes.list"],
    },
    {
      name: "get_vehiculo",
      message: "¿qué tractor tiene VJ-100?",
      plan: {
        type: "query",
        goal: "detalle",
        queries: [{ capability: "viajes.get", args: { codigo: "VJ-100" } }],
        workingSetOp: "replace",
      },
      answer: { reply: "Tractor AB123CD, chofer Perez.", entityIds: ["vj1"] },
      expectCaps: ["viajes.get"],
    },
  ]);
}

// —— Incidencias ——
{
  await caseAgent("incidencias", [
    {
      name: "abiertas",
      message: "¿cuántas abiertas?",
      plan: {
        type: "query",
        goal: "abiertas",
        queries: [{ capability: "incidencias.list", args: { abiertas: true } }],
        workingSetOp: "replace",
      },
      answer: { reply: "1 abierta (demora).", entityIds: ["inc1"] },
      expectCaps: ["incidencias.list"],
    },
    {
      name: "demoras",
      message: "¿cuáles son demoras?",
      plan: {
        type: "query",
        goal: "tipo demora",
        queries: [{ capability: "incidencias.list", args: { tipo: "demora" } }],
        workingSetOp: "replace",
      },
      answer: { reply: "INC-0001 demora — Tráfico.", entityIds: ["inc1"] },
      expectCaps: ["incidencias.list"],
    },
    {
      name: "get_causa",
      message: "detalle INC-0001",
      plan: {
        type: "query",
        goal: "get",
        queries: [{ capability: "incidencias.get", args: { codigo: "INC-0001" } }],
        workingSetOp: "replace",
      },
      answer: { reply: "Causa: Tráfico.", entityIds: ["inc1"] },
      expectCaps: ["incidencias.get"],
    },
  ]);
}

// —— Rendición ——
{
  const r = await executeCapability("rendicion.resumen", {}, { agentId: "rendicion", user });
  assert.ok(r.result.pendientes >= 1);
  await caseAgent("rendicion", [
    {
      name: "pendientes",
      message: "¿cuántos pendientes?",
      plan: {
        type: "query",
        goal: "resumen",
        queries: [{ capability: "rendicion.resumen", args: {} }],
        workingSetOp: "replace",
      },
      answer: { reply: `Pendientes: ${r.result.pendientes}.`, entityIds: [] },
      expectCaps: ["rendicion.resumen"],
    },
    {
      name: "list_hoy",
      message: "últimos gastos de hoy",
      plan: {
        type: "query",
        goal: "list hoy",
        queries: [{ capability: "rendicion.list", args: { creadosHoy: true, limit: 10 } }],
        workingSetOp: "replace",
      },
      answer: { reply: "2 gastos de hoy.", entityIds: ["g1", "g2"] },
      expectCaps: ["rendicion.list"],
    },
  ]);
}

// —— ETA ——
{
  await caseAgent("eta", [
    {
      name: "resumen",
      message: "¿cómo está la cola?",
      plan: {
        type: "query",
        goal: "resumen eta",
        queries: [{ capability: "eta.resumen", args: {} }],
        workingSetOp: "replace",
      },
      answer: { reply: "Cola ETA con demoras abiertas según store.", entityIds: [] },
      expectCaps: ["eta.resumen"],
    },
    {
      name: "cola",
      message: "mostrame la cola",
      plan: {
        type: "query",
        goal: "cola",
        queries: [{ capability: "eta.cola", args: { limit: 20 } }],
        workingSetOp: "replace",
      },
      answer: { reply: "Cola listada.", entityIds: [] },
      expectCaps: ["eta.cola"],
      assertReply: (t) => assert.ok(t.capabilityResults[0].ok),
    },
  ]);
}

// —— Remitos ——
{
  const r = await executeCapability("remitos.resumen", {}, { agentId: "remitos", user });
  assert.equal(r.result.total, 2);
  await caseAgent("remitos", [
    {
      name: "resumen",
      message: "¿cuántos remitos?",
      plan: {
        type: "query",
        goal: "resumen",
        queries: [{ capability: "remitos.resumen", args: {} }],
        workingSetOp: "replace",
      },
      answer: { reply: `Hay ${r.result.total} remitos.`, entityIds: [] },
      expectCaps: ["remitos.resumen"],
    },
    {
      name: "confirmados",
      message: "¿cuántos confirmados?",
      plan: {
        type: "query",
        goal: "list confirmado",
        queries: [{ capability: "remitos.list", args: { estado: "confirmado" } }],
        workingSetOp: "replace",
      },
      answer: { reply: "1 confirmado.", entityIds: ["rem1"] },
      expectCaps: ["remitos.list"],
    },
    {
      name: "get",
      message: "detalle rem1",
      plan: {
        type: "query",
        goal: "get",
        queries: [{ capability: "remitos.get", args: { id: "rem1" } }],
        workingSetOp: "replace",
      },
      answer: { reply: "Remito 001 a Córdoba.", entityIds: ["rem1"] },
      expectCaps: ["remitos.get"],
    },
  ]);
}

// —— Sin fallback heurístico ——
{
  const turn = await runDeskChatTurn({
    agentId: "viajes",
    message: "hola",
    user,
    llmCaller: async () => ({ ok: false, error: "down", parsed: null }),
  });
  assert.equal(turn.engine, "llm_error");
  assert.notEqual(turn.engine, "rules_fallback");
  console.log("✓ no_heuristic_fallback_on_llm_error");
  report.push({ agentId: "*", name: "llm_error", engine: turn.engine, ok: true });
}

// args inventados rechazados
{
  const bad = await executeCapability(
    "viajes.list",
    { estado: "en_curso", demorado: true },
    { agentId: "viajes", user },
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "args_invalidos");
  console.log("✓ args_invalidos_rechazados");
}

const runtimeSrc = fs.readFileSync(
  path.join(process.cwd(), "backend/src/services/desk-chat/runtime.mjs"),
  "utf8",
);
assert.ok(!runtimeSrc.includes("rules_fallback"));
assert.ok(!runtimeSrc.includes("answerPodFromFactsRules"));

console.log("\nverify-desk-chat-specialists: OK");
console.log(JSON.stringify({ tmp, cases: report.length, capabilities: names.length }, null, 2));
fs.rmSync(tmp, { recursive: true, force: true });
