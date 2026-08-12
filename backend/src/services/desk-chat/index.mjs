/**
 * Bootstrap desk-chat capabilities (idempotente).
 */
import { registerPodCapabilities } from "./capabilities/pod.mjs";
import { listCapabilities } from "./capability-registry.mjs";

let booted = false;

export function ensureDeskChatCapabilities() {
  if (booted && listCapabilities().some((c) => c.name.startsWith("pod."))) return;
  registerPodCapabilities();
  booted = true;
}

export function resetDeskChatBootstrapForTests() {
  booted = false;
}
