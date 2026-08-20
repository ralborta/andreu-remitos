/**
 * Estado operativo en vivo de cada agente (Monitor SOL).
 * Distinto del status de producto (operativo / beta): acá es “qué está haciendo ahora”.
 */

import { agents, type Agent } from "./agents";
import type {
  ResumenEta,
  ResumenIncidencias,
  ResumenPods,
  ResumenReclamos,
  ResumenRendicion,
} from "./api";

export type AgentRuntimeState = "activo" | "en_espera" | "en_hold" | "offline";

export const RUNTIME_LABEL: Record<AgentRuntimeState, string> = {
  activo: "Activo",
  en_espera: "En espera",
  en_hold: "En hold",
  offline: "Offline",
};

export const RUNTIME_COLOR: Record<AgentRuntimeState, string> = {
  activo: "#22c55e",
  en_espera: "#38bdf8",
  en_hold: "#f59e0b",
  offline: "#94a3b8",
};

export const RUNTIME_HINT: Record<AgentRuntimeState, string> = {
  activo: "Procesando o con cola en curso",
  en_espera: "Online, sin trabajo pendiente",
  en_hold: "Esperando respuesta humana o del cliente",
  offline: "No desplegado / sin señal",
};

export type AgentRuntimeSnapshot = {
  slug: string;
  state: AgentRuntimeState;
  detail: string;
  queue: number;
};

export type AgentRuntimeInputs = {
  remitosPendientes?: number;
  destinosEsperandoCliente?: number;
  destinosEnCurso?: number;
  viajesActivos?: number;
  viajesPendientes?: number;
  rendicion?: Pick<ResumenRendicion, "pendientes"> | null;
  incidencias?: Pick<ResumenIncidencias, "abiertas" | "esperando_causa"> | null;
  eta?: Pick<ResumenEta, "enCola" | "esperandoChofer" | "demorasAbiertas"> | null;
  reclamos?: Pick<ResumenReclamos, "abiertos"> | null;
  pods?: Pick<ResumenPods, "pendientes" | "en_dialogo"> | null;
  waConnected?: boolean | null;
};

function pick(
  hold: number,
  activo: number,
  labels: { hold: string; activo: string; idle: string },
): Pick<AgentRuntimeSnapshot, "state" | "detail" | "queue"> {
  if (hold > 0) {
    return { state: "en_hold", detail: labels.hold.replace("{n}", String(hold)), queue: hold };
  }
  if (activo > 0) {
    return { state: "activo", detail: labels.activo.replace("{n}", String(activo)), queue: activo };
  }
  return { state: "en_espera", detail: labels.idle, queue: 0 };
}

export function resolveAgentRuntime(
  agent: Agent,
  inputs: AgentRuntimeInputs,
): AgentRuntimeSnapshot {
  const waDown = inputs.waConnected === false;
  const needsWa = agent.channels.some((c) => /whatsapp/i.test(c));

  if (waDown && needsWa && agent.status !== "beta") {
    return {
      slug: agent.slug,
      state: "offline",
      detail: "WhatsApp desconectado",
      queue: 0,
    };
  }

  switch (agent.slug) {
    case "remitos": {
      const n = inputs.remitosPendientes ?? 0;
      return {
        slug: agent.slug,
        ...pick(0, n, {
          hold: "",
          activo: "{n} remitos en cola",
          idle: "Sin remitos pendientes",
        }),
      };
    }
    case "viajes": {
      const activos = inputs.viajesActivos ?? 0;
      const pend = inputs.viajesPendientes ?? 0;
      return {
        slug: agent.slug,
        ...pick(pend, activos, {
          hold: "{n} viajes pendientes de asignación",
          activo: "{n} viajes en curso",
          idle: "Sin viajes activos",
        }),
      };
    }
    case "destinos": {
      const hold = inputs.destinosEsperandoCliente ?? 0;
      const curso = inputs.destinosEnCurso ?? 0;
      return {
        slug: agent.slug,
        ...pick(hold, curso, {
          hold: "{n} esperando cliente",
          activo: "{n} validaciones en curso",
          idle: "Sin destinos en cola",
        }),
      };
    }
    case "incidencias": {
      const hold = inputs.incidencias?.esperando_causa ?? 0;
      const abiertas = inputs.incidencias?.abiertas ?? 0;
      const activo = Math.max(0, abiertas - hold);
      return {
        slug: agent.slug,
        ...pick(hold, activo || abiertas, {
          hold: "{n} esperando causa del chofer",
          activo: "{n} incidencias abiertas",
          idle: "Sin incidencias abiertas",
        }),
      };
    }
    case "rendicion": {
      const n = inputs.rendicion?.pendientes ?? 0;
      return {
        slug: agent.slug,
        ...pick(n, 0, {
          hold: "{n} gastos por aprobar",
          activo: "",
          idle: "Sin pendientes de aprobación",
        }),
      };
    }
    case "eta": {
      const hold = inputs.eta?.esperandoChofer ?? 0;
      const cola = (inputs.eta?.enCola ?? 0) + (inputs.eta?.demorasAbiertas ?? 0);
      return {
        slug: agent.slug,
        ...pick(hold, cola, {
          hold: "{n} esperando ETA del chofer",
          activo: "{n} en cola / demoras",
          idle: "Cola ETA vacía",
        }),
      };
    }
    case "pod": {
      const hold = inputs.pods?.pendientes ?? 0;
      const dialogo = inputs.pods?.en_dialogo ?? 0;
      return {
        slug: agent.slug,
        ...pick(hold, dialogo, {
          hold: "{n} pendientes de mesa",
          activo: "{n} en diálogo WhatsApp",
          idle: "Sin POD pendientes",
        }),
      };
    }
    case "reclamos": {
      const n = inputs.reclamos?.abiertos ?? 0;
      return {
        slug: agent.slug,
        ...pick(0, n, {
          hold: "",
          activo: "{n} reclamos abiertos",
          idle: "Sin reclamos abiertos",
        }),
      };
    }
    case "commander":
      return {
        slug: agent.slug,
        state: "en_espera",
        detail: "Listo para consultas de mesa",
        queue: 0,
      };
    case "analitica":
      return {
        slug: agent.slug,
        state: agent.status === "beta" ? "en_espera" : "en_espera",
        detail: agent.status === "beta" ? "Beta · sin cola en vivo" : "Consolida KPIs en background",
        queue: 0,
      };
    default:
      return {
        slug: agent.slug,
        state: agent.status === "beta" ? "en_espera" : "en_espera",
        detail: "Sin métrica en vivo",
        queue: 0,
      };
  }
}

export function buildAgentRuntimeBoard(inputs: AgentRuntimeInputs): AgentRuntimeSnapshot[] {
  return agents.map((a) => resolveAgentRuntime(a, inputs));
}

export function runtimeCounts(board: AgentRuntimeSnapshot[]) {
  return board.reduce(
    (acc, row) => {
      acc[row.state] += 1;
      return acc;
    },
    { activo: 0, en_espera: 0, en_hold: 0, offline: 0 } as Record<AgentRuntimeState, number>,
  );
}
