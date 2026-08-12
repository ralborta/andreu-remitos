/**
 * Pack Incidencias — read-only.
 * Estados: esperando_causa|nueva|en_gestion|resuelta.
 * Demora = tipo "demora", no un estado.
 */
import * as incidenciasStore from "../../../db/incidencias-store.mjs";
import {
  INCIDENCIA_ESTADOS,
  INCIDENCIA_ESTADO_LABEL,
  INCIDENCIA_TIPOS,
  INCIDENCIA_TIPO_LABEL,
} from "../../../../../lib/incidencias.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, dayKey, norm, workingIds } from "./_shared.mjs";

const ABIERTAS = new Set(["esperando_causa", "nueva", "en_gestion"]);

function mapInc(row) {
  return {
    id: row.id,
    codigo: row.codigo || row.id,
    estado: row.estado,
    estadoLabel: INCIDENCIA_ESTADO_LABEL[row.estado] || row.estado,
    tipo: row.tipo || null,
    tipoLabel: INCIDENCIA_TIPO_LABEL[row.tipo] || row.tipo || null,
    criticidad: row.criticidad || null,
    chofer: row.chofer_nombre || null,
    telefono: row.telefono || null,
    viaje: row.viaje_ref || null,
    causa: row.causa || null,
    resumen: row.resumen || null,
    destinoId: row.destino_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "real",
  };
}

export function registerIncidenciasCapabilities() {
  registerCapability({
    name: "incidencias.resumen",
    agentId: "incidencias",
    domain: "incidencias",
    description: "Resumen de incidencias (abiertas, por estado, demoras abiertas, creadas hoy).",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 6000,
    readOnly: true,
    async execute() {
      const today = todayKey();
      const base = await incidenciasStore.resumenIncidencias();
      const rows = (await incidenciasStore.listIncidencias({ limit: 300 })).map(mapInc);
      const demorasAbiertas = rows.filter((r) => r.tipo === "demora" && ABIERTAS.has(r.estado)).length;
      const creadasHoy = rows.filter((r) => dayKey(r.createdAt) === today).length;
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        ...base,
        demorasAbiertas,
        creadasHoy,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "incidencias.list",
    agentId: "incidencias",
    domain: "incidencias",
    description:
      "Lista incidencias: estado, abiertas, tipo (incl. demora), viajeContains, unidad/choferContains, creadasHoy, ids, workingSetOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: [...INCIDENCIA_ESTADOS] },
        abiertas: { type: "boolean" },
        tipo: { type: "string", enum: [...INCIDENCIA_TIPOS] },
        viajeContains: { type: "string", minLength: 2, maxLength: 80 },
        choferContains: { type: "string", minLength: 2, maxLength: 80 },
        creadasHoy: { type: "boolean" },
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
      let rows = (await incidenciasStore.listIncidencias({ limit: 300 })).map(mapInc);

      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id) || ids.has(r.codigo));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        rows = rows.filter((r) => want.has(r.id) || want.has(r.codigo));
      }
      if (args.estado) rows = rows.filter((r) => r.estado === args.estado);
      if (args.abiertas === true) rows = rows.filter((r) => ABIERTAS.has(r.estado));
      if (args.tipo) rows = rows.filter((r) => r.tipo === args.tipo);
      if (args.creadasHoy === true) rows = rows.filter((r) => dayKey(r.createdAt) === today);
      if (args.viajeContains) {
        const n = norm(args.viajeContains);
        rows = rows.filter((r) => norm(r.viaje).includes(n));
      }
      if (args.choferContains) {
        const n = norm(args.choferContains);
        rows = rows.filter((r) => norm(r.chofer).includes(n) || norm(r.telefono).includes(n));
      }

      const items = rows.slice(0, limit);
      return {
        today,
        timezone: TZ,
        count: items.length,
        totalMatched: rows.length,
        filters: { ...args, limit },
        entityType: "incidencias",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "incidencias.get",
    agentId: "incidencias",
    domain: "incidencias",
    description: "Detalle de incidencia por id/codigo (causa, tipo, viaje, estado).",
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
      const row = await incidenciasStore.getIncidencia(key);
      if (!row) return { found: false, id: key, dataSource: "real" };
      const item = mapInc(row);
      return { found: true, entityType: "incidencias", entityIds: [item.id], item, dataSource: "real" };
    },
  });
}
