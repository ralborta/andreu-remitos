/**
 * Bootstrap desk-chat capabilities (idempotente).
 */
import { registerPodCapabilities } from "./capabilities/pod.mjs";
import { registerViajesCapabilities } from "./capabilities/viajes.mjs";
import { registerIncidenciasCapabilities } from "./capabilities/incidencias.mjs";
import { registerRendicionCapabilities } from "./capabilities/rendicion.mjs";
import { registerEtaCapabilities } from "./capabilities/eta.mjs";
import { registerRemitosCapabilities } from "./capabilities/remitos.mjs";
import { registerDestinosCapabilities } from "./capabilities/destinos.mjs";
import { registerCommanderCapabilities } from "./capabilities/commander.mjs";
import { listCapabilities } from "./capability-registry.mjs";

let booted = false;

export function ensureDeskChatCapabilities() {
  if (booted && listCapabilities().some((c) => c.name.startsWith("pod."))) return;
  registerPodCapabilities();
  registerViajesCapabilities();
  registerIncidenciasCapabilities();
  registerRendicionCapabilities();
  registerEtaCapabilities();
  registerRemitosCapabilities();
  registerDestinosCapabilities();
  registerCommanderCapabilities();
  booted = true;
}

export function resetDeskChatBootstrapForTests() {
  booted = false;
}
