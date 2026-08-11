import { registerAgent, resetAgentRegistry } from "./agent-registry.mjs";

let bootstrapped = false;

/** Registro estático equivalente a la tabla mental de enrutarPorIntencion + binds sticky. */
export function bootstrapAgentRegistry() {
  if (bootstrapped) return;
  resetAgentRegistry();

  registerAgent({
    id: "viajes",
    label: "Gestión de Viajes",
    intents: ["viaje"],
    ownsProcessTypes: ["viaje_solicitud"],
    requires: {},
    executorKey: "viajes",
  });
  registerAgent({
    id: "reclamos",
    label: "Reclamos",
    intents: ["reclamo"],
    ownsProcessTypes: ["reclamo"],
    requires: {},
    executorKey: "reclamos",
  });
  registerAgent({
    id: "incidencias",
    label: "Incidencias",
    intents: ["incidencia"],
    ownsProcessTypes: ["incidencia"],
    requires: { choferOperativo: true },
    executorKey: "incidencias",
  });
  registerAgent({
    id: "rendicion",
    label: "Rendición",
    intents: ["rendicion"],
    ownsProcessTypes: ["rendicion_gasto"],
    requires: { choferOperativo: true },
    executorKey: "rendicion",
  });
  registerAgent({
    id: "pod",
    label: "POD",
    intents: ["pod"],
    ownsProcessTypes: ["pod_caso"],
    requires: { choferOperativo: true },
    executorKey: "pod",
  });
  registerAgent({
    id: "remitos",
    label: "Remitos",
    intents: ["remito", "continue_process"],
    ownsProcessTypes: ["remito_revision"],
    requires: {},
    executorKey: "remitos",
  });
  registerAgent({
    id: "destinos",
    label: "Destinos",
    intents: [],
    ownsProcessTypes: ["destino_confirmacion", "destino_eta_chofer"],
    requires: {},
    executorKey: "destinos",
  });
  registerAgent({
    id: "router",
    label: "Router / clarificación",
    intents: ["chat", "desconocido"],
    ownsProcessTypes: [],
    requires: {},
    executorKey: "clarify",
  });

  bootstrapped = true;
}
