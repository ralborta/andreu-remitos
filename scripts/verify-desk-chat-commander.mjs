/**
 * Protocolo funcional — Chat Central Commander (desk-chat).
 * Acceso a todos los packs; LLM-first; cero rules_fallback.
 *
 *   node scripts/verify-desk-chat-commander.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "desk-cmd-"));
process.env.DATA_DIR = tmp;

const { ensureDeskChatCapabilities, resetDeskChatBootstrapForTests } = await import(
  "../backend/src/services/desk-chat/index.mjs"
);
const {
  _resetRegistryForTests,
  listCapabilities,
  executeCapability,
  allowedCapabilityNames,
} = await import("../backend/src/services/desk-chat/capability-registry.mjs");
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
    destino: "Córdoba Capital",
    chofer: "Perez",
    tractor: "AB123CD",
    created_at: now,
    updated_at: now,
  },
  {
    id: "vj2",
    codigo: "VJ-200",
    estado: "cerrado",
    destino: "Rosario",
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
    viaje_ref: "VJ-100",
    causa: "Tráfico",
    created_at: now,
    updated_at: now,
  },
]);

writeJson("pod-casos.json", [
  {
    id: "pod1",
    codigo: "POD-0001",
    estado: "pendiente",
    viaje_ref: "VJ-100",
    chofer_nombre: "Perez",
    created_at: now,
    updated_at: now,
  },
  {
    id: "pod2",
    codigo: "POD-0002",
    estado: "ok",
    viaje_ref: "VJ-200",
    created_at: now,
    updated_at: now,
  },
]);
writeJson("remitos.json", []);
writeJson("eta-notificaciones.json", []);
writeJson("destinos.json", []);
writeJson("destinos-pendientes.json", []);
writeJson("rendicion-gastos.json", []);

// Commander ve todas las capabilities
const cmdCaps = allowedCapabilityNames("commander");
assert.ok(cmdCaps.has("viajes.resumen"));
assert.ok(cmdCaps.has("incidencias.list"));
assert.ok(cmdCaps.has("pod.get"));
assert.ok(cmdCaps.has("remitos.resumen"));
assert.ok(cmdCaps.has("eta.cola"));
assert.ok(cmdCaps.has("rendicion.get"));
assert.equal(listCapabilities({ agentId: "commander" }).length, listCapabilities().length);
console.log("✓ catalog_completo_commander");

// Especialista sigue restringido
const viaCaps = allowedCapabilityNames("viajes");
assert.ok(viaCaps.has("viajes.list"));
assert.ok(!viaCaps.has("incidencias.list"));
const forbidden = await executeCapability(
  "incidencias.list",
  { abiertas: true },
  { agentId: "viajes", user },
);
assert.equal(forbidden.error, "capability_fuera_de_dominio");
console.log("✓ especialista_no_cruza_dominio");

// Cross-domain plan
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "resumen: viajes activos e incidencias abiertas",
    user,
    planOverride: {
      type: "query",
      goal: "resumen transversal",
      queries: [
        { capability: "viajes.resumen", args: {} },
        { capability: "incidencias.list", args: { abiertas: true } },
      ],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "1 viaje activo; 1 incidencia abierta (demora).",
      entityIds: ["inc1"],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.notEqual(turn.engine, "rules_fallback");
  assert.deepEqual(
    turn.capabilityResults.map((r) => r.capability),
    ["viajes.resumen", "incidencias.list"],
  );
  assert.ok(turn.capabilityResults.every((r) => r.ok));
  assert.match(turn.reply, /1 viaje|incidencia/i);
  console.log("✓ cross_domain_plan");
}

// Follow-up workingSet (viajes → filtrar Córdoba)
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿y de esos cuáles van a Córdoba?",
    user,
    workingSet: { entityType: "viajes", entityIds: ["vj1"], label: "activos" },
    planOverride: {
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
    answerOverride: { reply: "VJ-100 a Córdoba Capital.", entityIds: ["vj1"] },
  });
  assert.equal(turn.engine, "llm");
  assert.deepEqual(turn.workingSet.entityIds, ["vj1"]);
  assert.equal(turn.workingSet.entityType, "viajes");
  console.log("✓ followup_workingSet");
}

// Demora vía incidencias (no estado inventado en viajes)
{
  const bad = await executeCapability(
    "viajes.list",
    { demorado: true },
    { agentId: "commander", user },
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "args_invalidos");

  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿hay demoras?",
    user,
    planOverride: {
      type: "query",
      goal: "demoras",
      queries: [{ capability: "incidencias.list", args: { tipo: "demora" } }],
      workingSetOp: "replace",
    },
    answerOverride: { reply: "INC-0001 demora — Tráfico.", entityIds: ["inc1"] },
  });
  assert.equal(turn.engine, "llm");
  assert.ok(turn.capabilityResults[0].ok);
  console.log("✓ demora_via_incidencias");
}

// LLM error sin fallback
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "hola",
    user,
    llmCaller: async () => ({ ok: false, error: "down", parsed: null }),
  });
  assert.equal(turn.engine, "llm_error");
  assert.notEqual(turn.engine, "rules_fallback");
  console.log("✓ no_heuristic_fallback");
}

// Saludo / charla: chitchat humano (nunca “fuera de dominio”)
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "hola",
    user,
    planOverride: {
      type: "chitchat",
      goal: "saludo",
      queries: [],
      workingSetOp: "keep",
    },
    answerOverride: {
      reply: "¡Hola! Acá estoy. ¿En qué te ayudo?",
      entityIds: [],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.equal(turn.plan.type, "chitchat");
  assert.match(turn.reply, /hola|ayud/i);
  assert.doesNotMatch(turn.reply, /fuera del (alcance|dominio)|no conoc/i);
  console.log("✓ chitchat_humano");
}

// out_of_domain mal clasificado: Pass2 igual puede responder humano
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "hola",
    user,
    planOverride: {
      type: "out_of_domain",
      goal: "saludo mal tipado",
      queries: [],
      workingSetOp: "keep",
    },
    answerOverride: {
      reply: "¡Buenas! Contame qué necesitás mirar.",
      entityIds: [],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.match(turn.reply, /Buenas|necesitás|hola/i);
  assert.doesNotMatch(turn.reply, /fuera del alcance del Chat Central/i);
  console.log("✓ out_of_domain_saludo_suave");
}

// Resumen operativo multiagente en paralelo
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Cómo viene la operación hoy?",
    user,
    planOverride: {
      type: "query",
      goal: "resumen operativo",
      queries: [
        { capability: "viajes.resumen", args: {} },
        { capability: "eta.resumen", args: {} },
        { capability: "incidencias.resumen", args: {} },
        { capability: "pod.resumen", args: {} },
        { capability: "remitos.resumen", args: {} },
      ],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "Viajes: 2. Incidencias abiertas: 1. Remitos: 0. POD/ETA según stores.",
      entityIds: [],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.equal(turn.capabilityResults.length, 5);
  assert.ok(turn.capabilityResults.every((r) => r.ok));
  console.log("✓ operacion_hoy_multi_resumen");
}

// Resultados parciales: una capability falla, las otras responden
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "resumen viajes e incidencias",
    user,
    planOverride: {
      type: "query",
      goal: "parcial",
      queries: [
        { capability: "viajes.resumen", args: {} },
        { capability: "incidencias.list", args: { abiertas: true, demorado: true } },
      ],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "Viajes OK (2). Incidencias no disponible (args inválidos).",
      entityIds: [],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.equal(turn.capabilityResults[0].ok, true);
  assert.equal(turn.capabilityResults[1].ok, false);
  assert.match(turn.reply, /Viajes|Incidencias/i);
  console.log("✓ resultados_parciales");
}

// workingSetOnly sin entityIds se sanitiza (no vacía el listado por error)
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿cuáles están activos?",
    user,
    workingSet: { entityType: "viajes", entityIds: [], label: "vacio" },
    planOverride: {
      type: "query",
      goal: "activos",
      queries: [{ capability: "viajes.list", args: { activos: true, workingSetOnly: true } }],
      workingSetOp: "replace",
    },
    answerOverride: { reply: "1 activo: VJ-100.", entityIds: ["vj1"] },
  });
  assert.equal(turn.engine, "llm");
  assert.equal(turn.plan.queries[0].args.workingSetOnly, undefined);
  assert.equal(turn.capabilityResults[0].ok, true);
  assert.equal(turn.capabilityResults[0].result.count, 1);
  console.log("✓ sanitize_workingSetOnly_vacio");
}

// WorkingSet multi-dominio tras resumen
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Cómo viene la operación hoy?",
    user,
    planOverride: {
      type: "query",
      goal: "resumen operativo",
      queries: [
        { capability: "viajes.resumen", args: {} },
        { capability: "incidencias.resumen", args: {} },
        { capability: "pod.resumen", args: {} },
      ],
      workingSetOp: "replace",
    },
    answerOverride: { reply: "Resumen OK.", entityIds: [] },
  });
  assert.ok(turn.workingSet.domains.viajes?.entityIds?.includes("vj1"));
  assert.ok(turn.workingSet.domains.incidencias?.entityIds?.length >= 1);
  assert.equal(turn.workingSet.domains.viajes.capability, "viajes.resumen");
  assert.equal(turn.workingSet.agentId, "commander");
  console.log("✓ workingSet_multi_dominio_tras_resumen");
}

// Join determinístico viaje↔incidencias
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Qué viajes tienen incidencias?",
    user,
    planOverride: {
      type: "query",
      goal: "viajes con incidencias",
      queries: [
        {
          capability: "commander.relacionar_viajes",
          args: { con: "incidencias", soloConRelacion: true, incidenciaAbiertas: true },
        },
      ],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "VJ-100 tiene 1 incidencia abierta (INC-0001).",
      entityIds: ["vj1"],
    },
  });
  const r = turn.capabilityResults[0];
  assert.equal(r.ok, true);
  assert.equal(r.result.relationAvailable, true);
  assert.equal(r.result.relationField, "viaje_ref");
  assert.ok(r.result.pairs.some((p) => p.viaje.codigo === "VJ-100" && p.relatedCount === 1));
  assert.ok(turn.workingSet.relations.some((x) => x.verified && x.fromCodigo === "VJ-100"));
  console.log("✓ join_viajes_incidencias");
}

// Conteos por viaje (misma cap)
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Cuántas incidencias tiene cada viaje?",
    user,
    planOverride: {
      type: "query",
      goal: "conteo por viaje",
      queries: [
        {
          capability: "commander.relacionar_viajes",
          args: { con: "incidencias", incidenciaAbiertas: true },
        },
      ],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "VJ-100: 1. VJ-200: 0 (sin referencia verificable).",
      entityIds: ["vj1", "vj2"],
    },
  });
  const pairs = turn.capabilityResults[0].result.pairs;
  const vj1 = pairs.find((p) => p.viaje.codigo === "VJ-100");
  const vj2 = pairs.find((p) => p.viaje.codigo === "VJ-200");
  assert.equal(vj1.relatedCount, 1);
  assert.equal(vj2.hasRelation, false);
  console.log("✓ conteo_incidencias_por_viaje");
}

// Demora verificada
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Cuáles de esos tienen demora?",
    user,
    workingSet: {
      entityType: "viajes",
      entityIds: ["vj1"],
      domains: { viajes: { entityIds: ["vj1"], agentId: "viajes", capability: "viajes.list" } },
    },
    planOverride: {
      type: "query",
      goal: "demoras",
      queries: [
        {
          capability: "commander.relacionar_viajes",
          args: {
            con: "incidencias",
            workingSetOnly: true,
            soloConRelacion: true,
            incidenciaTipo: "demora",
            incidenciaAbiertas: true,
          },
        },
      ],
      workingSetOp: "filter",
    },
    answerOverride: { reply: "VJ-100 tiene demora INC-0001.", entityIds: ["vj1"] },
  });
  assert.equal(turn.capabilityResults[0].result.pairs[0].relatedCount, 1);
  console.log("✓ demora_verificada_por_ref");
}

// POD pendiente verificado
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿Y cuáles tienen POD pendiente?",
    user,
    planOverride: {
      type: "query",
      goal: "pod pendiente",
      queries: [
        {
          capability: "commander.relacionar_viajes",
          args: { con: "pod", soloConRelacion: true, podPendiente: true },
        },
      ],
      workingSetOp: "replace",
    },
    answerOverride: { reply: "VJ-100 tiene POD-0001 pendiente.", entityIds: ["vj1"] },
  });
  assert.ok(turn.capabilityResults[0].result.pairs.some((p) => p.viaje.codigo === "VJ-100"));
  console.log("✓ pod_pendiente_verificado");
}

// Relación no verificable (remitos)
{
  const turn = await runDeskChatTurn({
    agentId: "commander",
    message: "¿qué viajes tienen remitos?",
    user,
    planOverride: {
      type: "query",
      goal: "remitos por viaje",
      queries: [{ capability: "commander.relacionar_viajes", args: { con: "remitos" } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply:
        "Los datos no permiten establecer la relación viaje↔remito: no hay viaje_ref en remitos persistidos.",
      entityIds: [],
    },
  });
  assert.equal(turn.capabilityResults[0].result.relationAvailable, false);
  assert.match(turn.reply, /no permiten|no hay|no se puede/i);
  console.log("✓ relacion_no_verificable_remitos");
}

console.log("\nverify-desk-chat-commander: OK");
console.log(
  JSON.stringify(
    {
      tmp,
      capabilitiesCommander: listCapabilities({ agentId: "commander" }).length,
    },
    null,
    2,
  ),
);
