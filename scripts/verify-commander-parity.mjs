/**
 * Parity / smoke tests SOL Commander v1 (sin OpenAI obligatorio).
 * Compara decisiones estructurales y orden de LegacyProcessPolicy.
 *
 * Usage: node scripts/verify-commander-parity.mjs
 */
import assert from "node:assert/strict";
import {
  decide,
  buildInboundMessage,
  bootstrapAgentRegistry,
  listAgents,
  isCommanderV1Enabled,
  evaluateLegacyProcessPolicy,
} from "../lib/commander/index.mjs";
import { pareceQuiereRemito, clasificarIntencionHeuristica } from "../lib/wa-intent-router.mjs";

bootstrapAgentRegistry();

const actorCliente = {
  isChoferRemitos: false,
  isChoferFlotaViajes: false,
  isChoferOperativo: false,
  choferNombre: null,
};
const actorChofer = {
  isChoferRemitos: true,
  isChoferFlotaViajes: false,
  isChoferOperativo: true,
  choferNombre: "Test",
};

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`✓ ${name}`);
}

// 1. Flag default off
assert.equal(isCommanderV1Enabled(), false);
ok("flag SOL_COMMANDER_V1 default false");

// 2. Registry bootstrapped
const ids = listAgents().map((a) => a.id).sort();
assert.deepEqual(ids, ["destinos", "incidencias", "pod", "reclamos", "remitos", "rendicion", "router", "viajes"].sort());
ok("agent registry manifests");

// 3. H1 intacta
assert.equal(pareceQuiereRemito("quiero enviar mi remito"), true);
assert.equal(pareceQuiereRemito("hola"), false);
ok("H1 pareceQuiereRemito intacta");

// 4. H2 intacta
const h = clasificarIntencionHeuristica("necesito un viaje a neuquen con 30 tn", actorCliente);
assert.equal(h.intent, "viaje");
assert.equal(h.fuente, "heuristica");
ok("H2 clasificarIntencionHeuristica intacta");

// 5. decide: viaje cliente → intent_router viajes
{
  const message = buildInboundMessage({
    subjectId: "5491100000001",
    text: "necesito un viaje de buenos aires a neuquen 28 toneladas",
  });
  const d = await decide({ message, actor: actorCliente, processes: [], log: null });
  assert.equal(d.intent, "viaje");
  assert.equal(d.agentId, "viajes");
  assert.equal(d.executorHints.executorKey, "viajes_force");
  assert.equal(d.trace.branch, "intent_router");
  ok("decide viaje → viajes_force");
}

// 6. decide: chofer pide remito → policy sticky pedir foto (H1 via policy)
{
  const message = buildInboundMessage({
    subjectId: "5491100000002",
    text: "te mando el remito ahora",
  });
  // "te mando el remito" may match pareceQuiereRemito
  const d = await decide({ message, actor: actorChofer, processes: [], log: null });
  if (pareceQuiereRemito(message.text)) {
    assert.equal(d.executorHints.executorKey, "remitos_pedir_foto");
    assert.equal(d.trace.branch, "legacy_process_policy");
    ok("decide remito sticky → remitos_pedir_foto (policy)");
  } else {
    // si no matchea H1, router puede pedir foto igual
    assert.ok(["remitos_pedir_foto", "remitos_texto"].includes(d.executorHints.executorKey));
    ok("decide remito path (router/policy)");
  }
}

// 7. decide: imagen sin sticky → remitos_ingest
{
  const message = buildInboundMessage({
    subjectId: "5491100000003",
    text: null,
    hasMedia: true,
    mediaKind: "image",
  });
  const d = await decide({ message, actor: actorChofer, processes: [], log: null });
  assert.equal(d.executorHints.executorKey, "remitos_ingest");
  assert.equal(d.trace.branch, "legacy_process_policy");
  ok("decide image → remitos_ingest");
}

// 8. Policy no handled → reason
{
  const message = buildInboundMessage({
    subjectId: "5491100000099",
    text: "asdfqwertyunique",
  });
  const p = await evaluateLegacyProcessPolicy({
    message,
    actor: actorCliente,
    log: null,
  });
  assert.equal(p.handled, false);
  ok("policy no sticky → handled false");
}

// 9. Todo mensaje construible para Commander (contrato entrada)
{
  const m = buildInboundMessage({ subjectId: "54911", text: "ok", hasMedia: false });
  assert.ok(m.messageId && m.channel === "whatsapp" && m.subjectId === "54911");
  ok("buildInboundMessage contrato");
}

// 10. v1.0.1 — remito_revision sticky: intent=remito, action=run_agent, processBinding
{
  const message = buildInboundMessage({
    subjectId: "5491100000010",
    text: "ok",
  });
  const p = await evaluateLegacyProcessPolicy({
    message,
    actor: actorChofer,
    conversation: {
      remito_en_revision_id: "remito-test-1",
      ultimo_remito_id: "remito-test-1",
    },
    log: null,
  });
  assert.equal(p.handled, true);
  assert.equal(p.decision.intent, "remito");
  assert.equal(p.decision.agentId, "remitos");
  assert.equal(p.decision.action, "run_agent");
  assert.equal(p.decision.processBinding, true);
  assert.equal(p.decision.processType, "remito_revision");
  assert.equal(p.decision.executorHints.executorKey, "remitos_texto");
  ok("v1.0.1 remito_revision sticky → remito/run_agent/processBinding");
}

console.log(`\nOK ${passed} checks — Commander parity smoke`);
