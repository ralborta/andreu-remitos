/**
 * Pack Destinos — read-only (confirmación de destinos).
 */
import * as destinosStore from "../../../db/destinos-store.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, norm, workingIds, compactEntityRefs } from "./_shared.mjs";

export function registerDestinosCapabilities() {
  registerCapability({
    name: "destinos.resumen",
    agentId: "destinos",
    domain: "destinos",
    description: "Resumen de destinos: totales y por estado.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      const rows = await destinosStore.listDestinos({ limit: 500 });
      const byEstado = {};
      for (const r of rows) {
        const e = String(r.estado || "desconocido");
        byEstado[e] = (byEstado[e] || 0) + 1;
      }
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: rows.length,
        byEstado,
        entityType: "destinos",
        entityIds: rows.slice(0, 40).map((r) => r.id),
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "destinos.list",
    agentId: "destinos",
    domain: "destinos",
    description:
      "Lista destinos. Filtros: estado, q (texto libre), ids, workingSetOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        estado: { type: "string", minLength: 2, maxLength: 40 },
        q: { type: "string", minLength: 1, maxLength: 80 },
        ids: { type: "array", items: { type: "string" } },
        workingSetOnly: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute(args, ctx) {
      const limit = args.limit ?? 20;
      let rows = await destinosStore.listDestinos({
        limit: 300,
        estado: args.estado || undefined,
      });
      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const ids = new Set(args.ids.map(String));
        rows = rows.filter((r) => ids.has(r.id));
      }
      if (args.q) {
        const q = norm(args.q);
        rows = rows.filter((r) => {
          const blob = norm(
            [r.id, r.cliente, r.direccion, r.telefono, r.chofer, r.estado, r.viaje]
              .filter(Boolean)
              .join(" "),
          );
          return blob.includes(q);
        });
      }
      rows = rows.slice(0, limit);
      const refs = compactEntityRefs(rows, (r) => ({
        id: r.id,
        estado: r.estado,
        cliente: r.cliente,
        direccion: r.direccion,
      }));
      return {
        count: rows.length,
        items: rows,
        entityType: "destinos",
        entityIds: refs.map((r) => r.id),
        refs,
        dataSource: "real",
      };
    },
  });
}
