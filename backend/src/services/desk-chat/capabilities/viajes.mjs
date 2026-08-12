/**
 * Pack Viajes — Data Capabilities read-only.
 * Estados reales: solicitado|confirmado|asignado|en_curso|entregado|cerrado|cancelado.
 * "activos" = no terminales (no inventa estado demorado).
 */
import * as viajesStore from "../../../db/viajes-store.mjs";
import { VIAJE_ESTADOS, VIAJE_ESTADO_LABEL } from "../../../../../lib/viajes.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, dayKey, norm, workingIds } from "./_shared.mjs";

const ACTIVOS = new Set(["solicitado", "confirmado", "asignado", "en_curso"]);

function mapViaje(row) {
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: VIAJE_ESTADO_LABEL[row.estado] || row.estado,
    tenant: row.tenant || null,
    cliente: row.cliente || null,
    origen: row.origen || null,
    destino: row.destino || null,
    chofer: row.chofer || null,
    telefonoChofer: row.telefono_chofer || null,
    tractor: row.tractor || null,
    semi: row.semi || null,
    fecha: row.fecha || null,
    hora: row.hora || null,
    tipoCarga: row.tipo_carga || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "real",
  };
}

export function registerViajesCapabilities() {
  registerCapability({
    name: "viajes.resumen",
    agentId: "viajes",
    domain: "viajes",
    description:
      "Conteos de viajes por estado + activos (solicitado/confirmado/asignado/en_curso) + creados hoy. Sin estado demorado.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 6000,
    readOnly: true,
    async execute() {
      const today = todayKey();
      const rows = (await viajesStore.listViajes({ limit: 500 })).map(mapViaje);
      const byEstado = Object.fromEntries(VIAJE_ESTADOS.map((e) => [e, 0]));
      for (const r of rows) if (byEstado[r.estado] != null) byEstado[r.estado] += 1;
      const activos = rows.filter((r) => ACTIVOS.has(r.estado));
      const creadosHoy = rows.filter((r) => dayKey(r.createdAt) === today);
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: rows.length,
        activos: activos.length,
        creadosHoy: creadosHoy.length,
        porEstado: byEstado,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "viajes.list",
    agentId: "viajes",
    domain: "viajes",
    description:
      "Lista viajes con filtros: estado, activos, destinoContains, choferContains, creadosHoy, ids, workingSetOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: [...VIAJE_ESTADOS] },
        activos: { type: "boolean" },
        destinoContains: { type: "string", minLength: 2, maxLength: 80 },
        choferContains: { type: "string", minLength: 2, maxLength: 80 },
        creadosHoy: { type: "boolean" },
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
      let rows = (await viajesStore.listViajes({ limit: 500 })).map(mapViaje);

      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id) || ids.has(r.codigo));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        rows = rows.filter((r) => want.has(r.id) || want.has(r.codigo));
      }
      if (args.estado) rows = rows.filter((r) => r.estado === args.estado);
      if (args.activos === true) rows = rows.filter((r) => ACTIVOS.has(r.estado));
      if (args.creadosHoy === true) rows = rows.filter((r) => dayKey(r.createdAt) === today);
      if (args.destinoContains) {
        const n = norm(args.destinoContains);
        rows = rows.filter((r) => norm(r.destino).includes(n));
      }
      if (args.choferContains) {
        const n = norm(args.choferContains);
        rows = rows.filter((r) => norm(r.chofer).includes(n));
      }

      const items = rows.slice(0, limit);
      return {
        today,
        timezone: TZ,
        count: items.length,
        totalMatched: rows.length,
        filters: {
          estado: args.estado ?? null,
          activos: args.activos === true,
          destinoContains: args.destinoContains ?? null,
          choferContains: args.choferContains ?? null,
          creadosHoy: args.creadosHoy === true,
          workingSetOnly: args.workingSetOnly === true,
          limit,
        },
        entityType: "viajes",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "viajes.get",
    agentId: "viajes",
    domain: "viajes",
    description: "Detalle de un viaje por id o codigo (chofer, tractor, semi, destino, estado).",
    argsSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 2, maxLength: 64 },
        codigo: { type: "string", minLength: 2, maxLength: 64 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 5000,
    readOnly: true,
    async execute(args) {
      const key = args.id || args.codigo;
      if (!key) return { found: false, error: "id_o_codigo_requerido", dataSource: "real" };
      const row = await viajesStore.getViaje(key);
      if (!row) return { found: false, id: key, dataSource: "real" };
      const item = mapViaje(row);
      return { found: true, entityType: "viajes", entityIds: [item.id], item, dataSource: "real" };
    },
  });
}
