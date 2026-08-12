/**
 * Protocolo funcional POD desk-chat runtime (10 casos).
 * Usa planOverride/answerOverride (sin OpenAI) + store real temporal.
 * Verifica que el path productivo NUNCA cae a rules_fallback.
 *
 *   node scripts/verify-pod-desk-chat-runtime.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pod-desk-rt-"));
process.env.DATA_DIR = tmp;

const podStore = await import("../backend/src/db/pod-store.mjs");
const chatStore = await import("../backend/src/db/agent-chat-store.mjs");
const { resolvePodDeskAnswer, answerPodFromFactsRules, buildPodDeskFacts } = await import(
  "../backend/src/services/pod-desk-chat.mjs"
);
const { executeCapability, listCapabilities } = await import(
  "../backend/src/services/desk-chat/capability-registry.mjs"
);
const { ensureDeskChatCapabilities } = await import("../backend/src/services/desk-chat/index.mjs");
const { runDeskChatTurn } = await import("../backend/src/services/desk-chat/runtime.mjs");

ensureDeskChatCapabilities();

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function seed() {
  const today = new Date().toISOString();
  const rows = [
    {
      id: "POD-AAAA1111",
      codigo: "POD-0001",
      estado: "pendiente",
      telefono: "5491100000001",
      chofer_nombre: "Chofer A",
      receptor_nombre: "Receptor 1",
      viaje_ref: "VJ-100",
      destino: "Córdoba Capital",
      nota_backoffice: null,
      historial: [`${today} · Creado`],
      created_at: today,
      updated_at: today,
    },
    {
      id: "POD-BBBB2222",
      codigo: "POD-0002",
      estado: "rechazado",
      telefono: "5491100000002",
      chofer_nombre: "Chofer B",
      receptor_nombre: "Receptor 2",
      viaje_ref: "VJ-200",
      destino: "Rosario",
      nota_backoffice: "Foto ilegible",
      aprobado_por: "mesa",
      historial: [`${today} · Decisión: rechazado — Foto ilegible`],
      created_at: today,
      updated_at: today,
    },
    {
      id: "POD-CCCC3333",
      codigo: "POD-0003",
      estado: "ok",
      telefono: "5491100000003",
      chofer_nombre: "Chofer C",
      receptor_nombre: "Receptor 3",
      viaje_ref: "VJ-300",
      destino: "Córdoba Norte",
      historial: [],
      created_at: today,
      updated_at: today,
    },
    {
      id: "POD-DDDD4444",
      codigo: "POD-0004",
      estado: "rechazado",
      telefono: "5491100000004",
      chofer_nombre: "Chofer D",
      receptor_nombre: "Receptor 4",
      viaje_ref: "VJ-400",
      destino: "Mendoza",
      nota_backoffice: "Firma no coincide",
      historial: [],
      created_at: "2020-01-01T12:00:00.000Z",
      updated_at: "2020-01-01T12:00:00.000Z",
    },
  ];
  fs.writeFileSync(path.join(tmp, "pod-casos.json"), JSON.stringify(rows, null, 2));
}

await seed();

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

const user = { id: "test", permissions: ["desk:read"] };

// ——— Capabilities registradas ———
const caps = listCapabilities({ agentId: "pod" }).map((c) => c.name).sort();
assert.deepEqual(caps, ["pod.get", "pod.list", "pod.resumen"]);

// ========== 1. pregunta simple (resumen hoy) ==========
{
  const exec = await executeCapability("pod.resumen", {}, { agentId: "pod", user });
  assert.equal(exec.ok, true);
  assert.ok(exec.result.recibidosHoy >= 3);
  const turn = await resolvePodDeskAnswer({
    message: "¿cuántos POD recibimos hoy?",
    user,
    planOverride: {
      type: "query",
      goal: "contar POD recibidos hoy",
      queries: [{ capability: "pod.resumen", args: {} }],
      workingSetOp: "replace",
      needsSynthesis: true,
    },
    answerOverride: {
      reply: `Hoy recibimos ${exec.result.recibidosHoy} POD.`,
      entityIds: [],
      citedIds: [],
      label: "recibidos_hoy",
    },
  });
  assert.equal(turn.engine, "llm");
  assert.match(turn.reply, /recibimos \d+ POD/i);
  assert.notEqual(turn.engine, "rules_fallback");
  pass("1.pregunta_simple", `recibidosHoy=${exec.result.recibidosHoy}`);
}

// ========== 2. follow-up ==========
{
  const listPend = await executeCapability(
    "pod.list",
    { estado: "pendiente" },
    { agentId: "pod", user },
  );
  assert.equal(listPend.result.count, 1);
  const t1 = await resolvePodDeskAnswer({
    message: "¿cuántos están pendientes?",
    user,
    planOverride: {
      type: "query",
      goal: "POD pendientes",
      queries: [{ capability: "pod.list", args: { estado: "pendiente" } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: `Hay ${listPend.result.count} POD pendientes.`,
      entityIds: listPend.result.entityIds,
      citedIds: listPend.result.entityIds,
    },
  });
  const t2 = await resolvePodDeskAnswer({
    message: "¿Cuáles?",
    user,
    workingSet: t1.workingSet,
    history: [
      { role: "user", text: "¿cuántos están pendientes?" },
      { role: "assistant", text: t1.reply },
    ],
    planOverride: {
      type: "query",
      goal: "listar el working set de pendientes",
      queries: [{ capability: "pod.list", args: { workingSetOnly: true } }],
      workingSetOp: "keep",
    },
    answerOverride: {
      reply: `El pendiente es POD-0001 (Córdoba Capital).`,
      entityIds: t1.workingSet.entityIds,
      citedIds: t1.workingSet.entityIds,
    },
  });
  assert.equal(t2.engine, "llm");
  assert.match(t2.reply, /POD-0001/);
  pass("2.follow_up", "pendientes → cuáles");
}

// ========== 3. pronombre / referencia “¿y esos?” ==========
{
  const rech = await executeCapability(
    "pod.list",
    { estado: "rechazado" },
    { agentId: "pod", user },
  );
  const t1 = await resolvePodDeskAnswer({
    message: "¿cuáles fueron rechazados?",
    user,
    planOverride: {
      type: "query",
      goal: "listar rechazados",
      queries: [{ capability: "pod.list", args: { estado: "rechazado" } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: `Hay ${rech.result.count} rechazados.`,
      entityIds: rech.result.entityIds,
    },
  });
  const t2 = await resolvePodDeskAnswer({
    message: "¿y esos?",
    user,
    workingSet: t1.workingSet,
    history: [
      { role: "user", text: "¿cuáles fueron rechazados?" },
      { role: "assistant", text: t1.reply },
    ],
    planOverride: {
      type: "query",
      goal: "detallar working set",
      queries: [{ capability: "pod.list", args: { workingSetOnly: true, limit: 20 } }],
      workingSetOp: "keep",
    },
    answerOverride: {
      reply: "Esos son POD-0002 (Rosario) y POD-0004 (Mendoza).",
      entityIds: t1.workingSet.entityIds,
    },
  });
  assert.match(t2.reply, /POD-0002/);
  pass("3.pronombre_y_esos");
}

// ========== 4. cambio de filtro “solo los de hoy” ==========
{
  const turn = await resolvePodDeskAnswer({
    message: "solo los de hoy",
    user,
    workingSet: { entityType: "pod", entityIds: ["POD-AAAA1111", "POD-DDDD4444"], label: "mix" },
    planOverride: {
      type: "query",
      goal: "filtrar recibidos hoy",
      queries: [{ capability: "pod.list", args: { recibidosHoy: true } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "Filtré los recibidos hoy: 3 POD.",
      entityIds: ["POD-AAAA1111", "POD-BBBB2222", "POD-CCCC3333"],
    },
  });
  assert.equal(turn.engine, "llm");
  assert.ok(turn.capabilityResults[0].ok);
  assert.equal(turn.capabilityResults[0].result.filters.recibidosHoy, true);
  pass("4.filtro_solo_hoy");
}

// ========== 5. pregunta no disponible ==========
{
  const turn = await resolvePodDeskAnswer({
    message: "¿cuál es el score NPS de los POD?",
    user,
    planOverride: {
      type: "query",
      goal: "NPS no existe",
      queries: [{ capability: "pod.resumen", args: {} }],
      workingSetOp: "keep",
    },
    answerOverride: {
      reply: "Actualmente no tengo ese dato disponible.",
      entityIds: [],
    },
  });
  assert.match(turn.reply, /no tengo ese dato/i);
  pass("5.dato_no_disponible");
}

// ========== 6. fuera de dominio ==========
{
  const turn = await resolvePodDeskAnswer({
    message: "¿cuántos litros cargó el camión?",
    user,
    planOverride: {
      type: "out_of_domain",
      goal: "fuera de POD",
      queries: [],
      workingSetOp: "keep",
    },
  });
  assert.equal(turn.engine, "llm");
  assert.match(turn.reply, /fuera del dominio|Chat Central/i);
  pass("6.fuera_de_dominio");
}

// ========== 7. restart / contexto limpio ==========
{
  const turn = await resolvePodDeskAnswer({
    message: "empezá de cero: ¿cuántos pendientes?",
    user,
    workingSet: { entityType: "pod", entityIds: ["POD-ZZZZ"], lastGoal: "viejo" },
    planOverride: {
      type: "query",
      goal: "pendientes desde cero",
      queries: [{ capability: "pod.list", args: { estado: "pendiente" } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "Hay 1 pendiente (POD-0001).",
      entityIds: ["POD-AAAA1111"],
    },
  });
  assert.deepEqual(turn.workingSet.entityIds, ["POD-AAAA1111"]);
  assert.notEqual(turn.workingSet.entityIds[0], "POD-ZZZZ");
  pass("7.restart_contexto");
}

// ========== 8. cero datos ==========
{
  // Filtrar destino inexistente
  const exec = await executeCapability(
    "pod.list",
    { destinoContains: "AntártidaXYZ" },
    { agentId: "pod", user },
  );
  assert.equal(exec.result.count, 0);
  const turn = await resolvePodDeskAnswer({
    message: "POD con destino AntártidaXYZ",
    user,
    planOverride: {
      type: "query",
      goal: "destino inexistente",
      queries: [{ capability: "pod.list", args: { destinoContains: "AntártidaXYZ" } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: "No hay POD con ese destino.",
      entityIds: [],
    },
  });
  assert.match(turn.reply, /No hay POD/i);
  pass("8.cero_datos");
}

// ========== 9. datos múltiples ==========
{
  const exec = await executeCapability("pod.list", { limit: 10 }, { agentId: "pod", user });
  assert.ok(exec.result.count >= 3);
  const turn = await resolvePodDeskAnswer({
    message: "mostrame los últimos POD",
    user,
    planOverride: {
      type: "query",
      goal: "listar varios",
      queries: [{ capability: "pod.list", args: { limit: 10 } }],
      workingSetOp: "replace",
    },
    answerOverride: {
      reply: `Hay ${exec.result.count} POD en la muestra.`,
      entityIds: exec.result.entityIds,
    },
  });
  assert.ok(turn.citedIds.length >= 3);
  pass("9.datos_multiples", `n=${exec.result.count}`);
}

// ========== 10. error de backend / LLM sin fallback heurístico ==========
{
  const turn = await runDeskChatTurn({
    agentId: "pod",
    message: "¿cuántos pendientes?",
    user,
    llmCaller: async () => ({ ok: false, error: "simulated_llm_down", parsed: null }),
  });
  assert.equal(turn.engine, "llm_error");
  assert.notEqual(turn.engine, "rules_fallback");
  assert.match(turn.reply, /No pude interpretar|IA/i);
  pass("10.error_llm_sin_fallback_heuristico", turn.engine);
}

// Evidencia: get con motivo rechazo (capability)
{
  const g = await executeCapability("pod.get", { codigo: "POD-0002" }, { agentId: "pod", user });
  assert.equal(g.ok, true);
  assert.equal(g.result.item.notaBackoffice, "Foto ilegible");
  assert.equal(g.result.item.viaje, "VJ-200");
}

// Evidencia: args inventados rechazados
{
  const bad = await executeCapability(
    "pod.list",
    { estado: "pendiente", campoInventado: true },
    { agentId: "pod", user },
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "args_invalidos");
}

// Evidencia: legacy rules SOLO con forceEngine=rules
{
  const legacy = await resolvePodDeskAnswer({
    message: "¿cuántos están pendientes?",
    forceEngine: "rules",
  });
  assert.equal(legacy.engine, "rules_fallback");
}

// Evidencia estática: runtime productivo no llama answerPodFromFactsRules
{
  const require = createRequire(import.meta.url);
  const runtimePath = path.join(
    path.dirname(require.resolve("../backend/src/services/desk-chat/runtime.mjs")),
    "runtime.mjs",
  );
  const src = fs.readFileSync(runtimePath, "utf8");
  assert.ok(!src.includes("answerPodFromFactsRules"));
  assert.ok(!src.includes("rules_fallback"));
  assert.ok(src.includes("llm_error"));
}

// Conversación + traces
{
  const conv = await chatStore.createConversation({
    agentId: "pod",
    tenant: "tsb",
    userId: "u1",
  });
  const ans = await resolvePodDeskAnswer({
    message: "¿pendientes?",
    user,
    workingSet: conv.workingSet,
    planOverride: {
      type: "query",
      goal: "pendientes",
      queries: [{ capability: "pod.list", args: { estado: "pendiente" } }],
      workingSetOp: "replace",
    },
    answerOverride: { reply: "1 pendiente.", entityIds: ["POD-AAAA1111"] },
  });
  const updated = await chatStore.appendTurn(conv.id, {
    userMessage: { text: "¿pendientes?" },
    assistantMessage: { text: ans.reply, meta: { engine: ans.engine } },
    workingSet: ans.workingSet,
    trace: {
      question: "¿pendientes?",
      agentId: "pod",
      engine: ans.engine,
      plan: ans.plan,
      capabilities: ans.trace?.capabilities,
    },
  });
  assert.equal(updated.traces[0].engine, "llm");
  assert.equal(updated.workingSet.entityIds[0], "POD-AAAA1111");
}

console.log("\nverify-pod-desk-chat-runtime: OK");
console.log(
  JSON.stringify(
    {
      tmp,
      today: todayIso(),
      capabilities: caps,
      cases: results.map((r) => r.name),
      productionEnginesSeen: ["llm", "llm_error"],
      legacyOnlyWithForceEngine: "rules_fallback",
    },
    null,
    2,
  ),
);

fs.rmSync(tmp, { recursive: true, force: true });
