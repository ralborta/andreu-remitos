/**
 * Verificación local del chat de mesa POD (datos reales + rules engine).
 * No requiere OpenAI ni servidor HTTP.
 *
 *   DATA_DIR=/tmp/pod-desk-test node scripts/verify-pod-desk-chat.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pod-desk-"));
process.env.DATA_DIR = tmp;

const podStore = await import("../backend/src/db/pod-store.mjs");
const chatStore = await import("../backend/src/db/agent-chat-store.mjs");
const {
  buildPodDeskFacts,
  answerPodFromFactsRules,
  resolvePodDeskAnswer,
} = await import("../backend/src/services/pod-desk-chat.mjs");

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
      destino_id: null,
      nota_chofer: null,
      nota_backoffice: null,
      aprobado_por: null,
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

const facts = await buildPodDeskFacts();
assert.equal(facts.resumen.dataSource, "real");
assert.ok(facts.resumen.recibidosHoy >= 3, "al menos 3 creados hoy");
assert.equal(facts.idsPendientes.length, 1);
assert.equal(facts.idsRechazados.length, 2);

// Casos mínimos
const k1 = answerPodFromFactsRules({
  message: "¿cuántos POD recibimos hoy?",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k1.reply, /recibimos \d+ POD/i);
assert.ok(k1.workingSet.podIds.length >= 3);
assert.deepEqual(k1.dataSources, ["real"]);

const k2 = answerPodFromFactsRules({
  message: "¿cuántos están pendientes?",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k2.reply, /1 POD pendientes/);

const k3 = answerPodFromFactsRules({
  message: "¿cuáles fueron rechazados?",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k3.reply, /2 POD rechazados/);
assert.ok(k3.reply.includes("POD-0002"));

const k4 = answerPodFromFactsRules({
  message: "¿por qué se rechazó este POD POD-0002?",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k4.reply, /Foto ilegible/);

const k5 = answerPodFromFactsRules({
  message: "mostrame los últimos 10",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k5.reply, /Últimos/);
assert.ok(k5.workingSet.podIds.length >= 3);

const k6 = answerPodFromFactsRules({
  message: "¿qué viaje corresponde a este POD POD-0001?",
  facts,
  workingSet: { podIds: [], label: null },
});
assert.match(k6.reply, /VJ-100/);

// Follow-up sobre rechazados → Córdoba
const afterRech = answerPodFromFactsRules({
  message: "¿cuáles fueron rechazados?",
  facts,
  workingSet: { podIds: [], label: null },
});
const k7 = answerPodFromFactsRules({
  message: "¿y de esos cuáles son de Córdoba?",
  facts,
  workingSet: afterRech.workingSet,
});
// Rechazados seed: Rosario + Mendoza → 0 Córdoba
assert.match(k7.reply, /no hay POD/i);

// Follow-up sobre últimos → Córdoba
const afterLast = answerPodFromFactsRules({
  message: "mostrame los últimos 10",
  facts,
  workingSet: { podIds: [], label: null },
});
const k7b = answerPodFromFactsRules({
  message: "¿y de esos cuáles son de Córdoba?",
  facts,
  workingSet: afterLast.workingSet,
});
assert.ok(k7b.workingSet.podIds.length >= 1);
assert.match(k7b.reply, /Córdoba/i);

// resolve con forceEngine rules + store de conversación / trazas
const conv = await chatStore.createConversation({
  agentId: "pod",
  tenant: "tsb",
  userId: "u1",
  username: "test",
});
const ans = await resolvePodDeskAnswer({
  message: "¿cuántos están pendientes?",
  workingSet: conv.workingSet,
  forceEngine: "rules",
});
const updated = await chatStore.appendTurn(conv.id, {
  userMessage: { text: "¿cuántos están pendientes?" },
  assistantMessage: { text: ans.reply, meta: { engine: ans.engine } },
  workingSet: ans.workingSet,
  trace: {
    question: "¿cuántos están pendientes?",
    agentId: "pod",
    answer: ans.reply,
    engine: ans.engine,
    citedIds: ans.citedIds,
    dataSources: ans.dataSources,
  },
});
assert.equal(updated.messages.length, 2);
assert.equal(updated.traces.length, 1);
assert.equal(updated.traces[0].agentId, "pod");
assert.ok(!String(JSON.stringify(updated)).includes('"demo"'));

// dataSource real en facts
assert.ok(facts.pods.every((p) => p.dataSource === "real"));

console.log("verify-pod-desk-chat: OK");
console.log(
  JSON.stringify(
    {
      tmp,
      today: todayIso(),
      cases: ["hoy", "pendientes", "rechazados", "motivo", "ultimos10", "viaje", "followup"],
      recibidosHoy: facts.resumen.recibidosHoy,
    },
    null,
    2,
  ),
);

// cleanup hint
fs.rmSync(tmp, { recursive: true, force: true });
