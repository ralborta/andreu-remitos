/**
 * Pack POD — Data Capabilities read-only para desk chat.
 */
import * as podStore from "../../../db/pod-store.mjs";
import { labelEstadoPod, POD_ESTADOS_DIALOG } from "../../../../../lib/pod.mjs";
import { registerCapability } from "../capability-registry.mjs";

const TZ = "America/Argentina/Buenos_Aires";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayKey(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

function mapPod(row) {
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: labelEstadoPod(row.estado),
    chofer: row.chofer_nombre || null,
    receptor: row.receptor_nombre || null,
    viaje: row.viaje_ref || null,
    destino: row.destino || null,
    notaChofer: row.nota_chofer || null,
    notaBackoffice: row.nota_backoffice || null,
    aprobadoPor: row.aprobado_por || null,
    historial: Array.isArray(row.historial) ? row.historial.slice(-8) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "real",
  };
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

async function loadMesaPods(limit = 200) {
  const all = await podStore.listPods({ limit });
  return all.filter((r) => !POD_ESTADOS_DIALOG.has(r.estado)).map(mapPod);
}

export function registerPodCapabilities() {
  registerCapability({
    name: "pod.resumen",
    agentId: "pod",
    domain: "pod",
    description:
      "Resumen de conteos POD de mesa (total, pendientes, ok, rechazados, recibidos hoy). Read-only.",
    argsSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    resultSchema: {
      type: "object",
      properties: {
        today: { type: "string" },
        timezone: { type: "string" },
        total: { type: "integer" },
        pendientes: { type: "integer" },
        ok: { type: "integer" },
        rechazados: { type: "integer" },
        recibidosHoy: { type: "integer" },
        dataSource: { type: "string" },
      },
    },
    requiredPermissions: ["desk:read"],
    timeoutMs: 5000,
    readOnly: true,
    async execute() {
      const today = todayKey();
      const pods = await loadMesaPods(200);
      const resumen = await podStore.resumenPods();
      const recibidosHoy = pods.filter((p) => dayKey(p.createdAt) === today).length;
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: resumen.total,
        pendientes: resumen.pendientes,
        ok: resumen.ok,
        rechazados: resumen.rechazados,
        recibidosHoy,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "pod.list",
    agentId: "pod",
    domain: "pod",
    description:
      "Lista POD de mesa con filtros estrictos: estado, destinoContains, recibidosHoy, ids, workingSetOnly, limit. Devuelve items + entityIds.",
    argsSchema: {
      type: "object",
      properties: {
        estado: {
          type: "string",
          enum: ["pendiente", "ok", "rechazado"],
        },
        destinoContains: { type: "string", minLength: 2, maxLength: 80 },
        recibidosHoy: { type: "boolean" },
        ids: { type: "array", items: { type: "string" } },
        workingSetOnly: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute(args, ctx) {
      const limit = args.limit ?? 20;
      const today = todayKey();
      let pods = await loadMesaPods(200);

      if (args.workingSetOnly) {
        const ids = new Set(
          (ctx.workingSet?.entityIds?.length
            ? ctx.workingSet.entityIds
            : ctx.workingSet?.podIds || []
          ).map(String),
        );
        pods = pods.filter((p) => ids.has(p.id) || ids.has(p.codigo));
      }

      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        pods = pods.filter((p) => want.has(p.id) || want.has(p.codigo));
      }

      if (args.estado) {
        pods = pods.filter((p) => p.estado === args.estado);
      }

      if (args.recibidosHoy === true) {
        pods = pods.filter((p) => dayKey(p.createdAt) === today);
      }

      if (args.destinoContains) {
        const needle = norm(args.destinoContains);
        pods = pods.filter((p) => norm(p.destino).includes(needle));
      }

      const items = pods.slice(0, limit).map((p) => ({
        id: p.id,
        codigo: p.codigo,
        estado: p.estado,
        estadoLabel: p.estadoLabel,
        destino: p.destino,
        viaje: p.viaje,
        receptor: p.receptor,
        chofer: p.chofer,
        createdAt: p.createdAt,
        dataSource: "real",
      }));

      return {
        today,
        timezone: TZ,
        count: items.length,
        totalMatched: pods.length,
        filters: {
          estado: args.estado ?? null,
          destinoContains: args.destinoContains ?? null,
          recibidosHoy: args.recibidosHoy === true,
          workingSetOnly: args.workingSetOnly === true,
          ids: args.ids ?? null,
          limit,
        },
        entityType: "pod",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "pod.get",
    agentId: "pod",
    domain: "pod",
    description:
      "Obtiene un POD por id o codigo (detalle: notas, historial, viaje, destino). Read-only.",
    argsSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 3, maxLength: 64 },
        codigo: { type: "string", minLength: 3, maxLength: 64 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 5000,
    readOnly: true,
    async execute(args) {
      const key = args.id || args.codigo;
      if (!key) {
        return { found: false, error: "id_o_codigo_requerido", dataSource: "real" };
      }
      const row = await podStore.getPod(key);
      if (!row || POD_ESTADOS_DIALOG.has(row.estado)) {
        return { found: false, id: key, dataSource: "real" };
      }
      const item = mapPod(row);
      return {
        found: true,
        entityType: "pod",
        entityIds: [item.id],
        item,
        dataSource: "real",
      };
    },
  });
}

export const POD_CAPABILITY_NAMES = ["pod.resumen", "pod.list", "pod.get"];
