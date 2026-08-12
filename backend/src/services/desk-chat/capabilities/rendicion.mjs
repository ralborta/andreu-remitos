/**
 * Pack Rendición (gastos) — read-only.
 * Estados: borrador|pendiente_aprobacion|aprobado|rechazado.
 */
import * as rendicionStore from "../../../db/rendicion-store.mjs";
import {
  GASTO_ESTADOS,
  GASTO_ESTADO_LABEL,
  RENDICION_CATEGORIAS,
} from "../../../../../lib/rendicion.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, dayKey, norm, workingIds } from "./_shared.mjs";

function mapGasto(row) {
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: GASTO_ESTADO_LABEL[row.estado] || row.estado,
    categoria: row.categoria || null,
    monto: row.monto ?? null,
    moneda: row.moneda || "ARS",
    proveedor: row.proveedor || null,
    viaje: row.viaje_ref || null,
    chofer: row.chofer_nombre || null,
    telefono: row.telefono || null,
    fechaComprobante: row.fecha_comprobante || null,
    descripcion: row.descripcion || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "real",
  };
}

export function registerRendicionCapabilities() {
  registerCapability({
    name: "rendicion.resumen",
    agentId: "rendicion",
    domain: "rendicion",
    description: "Resumen de gastos: pendientes/aprobados/rechazados y montos si existen en store.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 6000,
    readOnly: true,
    async execute() {
      const today = todayKey();
      const base = await rendicionStore.resumenGastos();
      const rows = (await rendicionStore.listGastos({ limit: 300 })).map(mapGasto);
      const creadosHoy = rows.filter((r) => dayKey(r.createdAt) === today).length;
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        ...base,
        creadosHoy,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "rendicion.list",
    agentId: "rendicion",
    domain: "rendicion",
    description:
      "Lista gastos: estado, categoria, viajeContains, choferContains, creadosHoy, ids, workingSetOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: [...GASTO_ESTADOS] },
        categoria: { type: "string", enum: [...RENDICION_CATEGORIAS] },
        viajeContains: { type: "string", minLength: 2, maxLength: 80 },
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
      let rows = (await rendicionStore.listGastos({ limit: 300 })).map(mapGasto);

      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id) || ids.has(r.codigo));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        rows = rows.filter((r) => want.has(r.id) || want.has(r.codigo));
      }
      if (args.estado) rows = rows.filter((r) => r.estado === args.estado);
      if (args.categoria) rows = rows.filter((r) => r.categoria === args.categoria);
      if (args.creadosHoy === true) rows = rows.filter((r) => dayKey(r.createdAt) === today);
      if (args.viajeContains) {
        const n = norm(args.viajeContains);
        rows = rows.filter((r) => norm(r.viaje).includes(n));
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
        filters: { ...args, limit },
        entityType: "rendicion",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "rendicion.get",
    agentId: "rendicion",
    domain: "rendicion",
    description: "Detalle de un gasto por id/codigo.",
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
      const row = await rendicionStore.getGasto(key);
      if (!row) return { found: false, id: key, dataSource: "real" };
      const item = mapGasto(row);
      return { found: true, entityType: "rendicion", entityIds: [item.id], item, dataSource: "real" };
    },
  });
}
