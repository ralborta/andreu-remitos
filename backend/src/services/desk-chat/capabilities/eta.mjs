/**
 * Pack ETA — read-only.
 * Usa resumenEta/listarColaEta (cola viva) + notificaciones del store.
 * Demoras = items fuente incidencia tipo demora / notif tipo demora.
 */
import * as etaStore from "../../../db/eta-store.mjs";
import { listarColaEta, resumenEta } from "../../eta-agent.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, norm, workingIds, compactEntityRefs } from "./_shared.mjs";

export function registerEtaCapabilities() {
  registerCapability({
    name: "eta.resumen",
    agentId: "eta",
    domain: "eta",
    description:
      "Resumen operacional ETA: cola, con ETA, esperando chofer, demoras abiertas, notificaciones hoy.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute() {
      const today = todayKey();
      const [resumen, notif, cola] = await Promise.all([
        resumenEta(),
        etaStore.resumenNotificaciones(),
        listarColaEta({ limit: 40 }),
      ]);
      const refs = compactEntityRefs(cola, (r) => ({
        id: r.id,
        refId: r.refId,
        viaje: r.viaje && r.viaje !== "—" ? r.viaje : null,
        fuente: r.fuente,
      }));
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        ...resumen,
        notificaciones: notif,
        entityType: "eta",
        entityIds: refs.map((r) => r.id),
        refs,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "eta.cola",
    agentId: "eta",
    domain: "eta",
    description:
      "Lista cola ETA (destinos + demoras por incidencia). Filtros: soloDemoras, estado, viajeContains, destinoContains, ids, workingSetOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        soloDemoras: { type: "boolean" },
        estado: { type: "string", minLength: 2, maxLength: 40 },
        viajeContains: { type: "string", minLength: 2, maxLength: 80 },
        destinoContains: { type: "string", minLength: 2, maxLength: 80 },
        ids: { type: "array", items: { type: "string" } },
        workingSetOnly: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 12000,
    readOnly: true,
    async execute(args, ctx) {
      const limit = args.limit ?? 20;
      let rows = await listarColaEta({ limit: 120 });

      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id) || ids.has(String(r.refId)));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        rows = rows.filter((r) => want.has(r.id) || want.has(String(r.refId)));
      }
      if (args.soloDemoras === true) {
        rows = rows.filter((r) => r.fuente === "incidencia");
      }
      if (args.estado) rows = rows.filter((r) => r.estado === args.estado);
      if (args.viajeContains) {
        const n = norm(args.viajeContains);
        rows = rows.filter((r) => norm(r.viaje).includes(n));
      }
      if (args.destinoContains) {
        const n = norm(args.destinoContains);
        rows = rows.filter((r) => norm(r.destino).includes(n));
      }

      const items = rows.slice(0, limit).map((r) => ({
        id: r.id,
        fuente: r.fuente,
        refId: r.refId,
        cliente: r.cliente,
        destino: r.destino,
        chofer: r.chofer,
        viaje: r.viaje,
        etaTexto: r.etaTexto,
        etaMinutos: r.etaMinutos ?? null,
        estado: r.estado,
        estadoLabel: r.estadoLabel,
        causa: r.causa || null,
        codigoIncidencia: r.codigoIncidencia || null,
        updatedAt: r.updatedAt,
        dataSource: "real",
      }));

      return {
        today: todayKey(),
        timezone: TZ,
        count: items.length,
        totalMatched: rows.length,
        filters: { ...args, limit },
        entityType: "eta",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "eta.get",
    agentId: "eta",
    domain: "eta",
    description: "Detalle de un ítem de cola ETA por id (destino:… o incidencia:…).",
    argsSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 3, maxLength: 80 },
      },
      required: ["id"],
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute(args) {
      const rows = await listarColaEta({ limit: 120 });
      const row = rows.find((r) => r.id === args.id || String(r.refId) === args.id);
      if (!row) return { found: false, id: args.id, dataSource: "real" };
      return {
        found: true,
        entityType: "eta",
        entityIds: [row.id],
        item: {
          id: row.id,
          fuente: row.fuente,
          refId: row.refId,
          cliente: row.cliente,
          destino: row.destino,
          chofer: row.chofer,
          viaje: row.viaje,
          etaTexto: row.etaTexto,
          etaMinutos: row.etaMinutos ?? null,
          estado: row.estado,
          estadoLabel: row.estadoLabel,
          causa: row.causa || null,
          codigoIncidencia: row.codigoIncidencia || null,
          dataSource: "real",
        },
        dataSource: "real",
      };
    },
  });
}
