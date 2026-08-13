/**
 * Pack Remitos — read-only estricto vía file-store (sin OCR / sin remitos.mjs).
 */
import * as fileStore from "../../../db/file-store.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, dayKey, norm, workingIds, compactEntityRefs } from "./_shared.mjs";

const ESTADOS = [
  "pendiente_revision",
  "incompleto",
  "bloqueado",
  "confirmado",
  "error_lectura",
];

const TENANTS = ["tsb", "beraldi", "corina", "mye"];

function nroFromDatos(d = {}) {
  return d.nro_guia || d.nro_remito || d.remito_cliente || null;
}

function mapRemito(row) {
  const d = row.datos || {};
  return {
    id: row.id,
    tenant: row.tenant || null,
    estado: row.estado,
    telefonoChofer: row.telefono_chofer || null,
    nro: nroFromDatos(d),
    fecha: d.fecha_guia || d.fecha_remito || d.fecha || null,
    conductor: d.conductor || d.chofer || null,
    destino: d.destino || d.destino_nombre || d.destino_locacion || null,
    origen: d.origen || d.procedencia || null,
    tractor: d.tractor || d.chasis || d.patente_chasis || null,
    semi: d.semi || d.acoplado || d.patente_acoplado || null,
    pesoKg: d.peso_kg ?? d.peso ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "real",
  };
}

export function registerRemitosCapabilities() {
  registerCapability({
    name: "remitos.resumen",
    agentId: "remitos",
    domain: "remitos",
    description:
      "Conteos de remitos persistidos por estado/tenant y creados hoy. Solo lectura file-store (sin OCR).",
    argsSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", enum: [...TENANTS] },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute(args) {
      const today = todayKey();
      const rows = await fileStore.listRemitos({
        tenant: args.tenant,
        limit: 2000,
        includeOcr: false,
      });
      const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
      const porTenant = {};
      let creadosHoy = 0;
      for (const r of rows) {
        if (porEstado[r.estado] != null) porEstado[r.estado] += 1;
        const t = r.tenant || "sin_tenant";
        porTenant[t] = (porTenant[t] || 0) + 1;
        if (dayKey(r.created_at) === today) creadosHoy += 1;
      }
      const mapped = rows.map(mapRemito);
      const refs = compactEntityRefs(mapped, (r) => ({ id: r.id, estado: r.estado, tenant: r.tenant }));
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: rows.length,
        creadosHoy,
        porEstado,
        porTenant,
        tenantFiltro: args.tenant ?? null,
        entityType: "remitos",
        entityIds: refs.map((r) => r.id),
        refs,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "remitos.list",
    agentId: "remitos",
    domain: "remitos",
    description:
      "Lista remitos persistidos: tenant, estado, creadosHoy, destinoContains, ids, workingSetOnly, limit. Sin OCR.",
    argsSchema: {
      type: "object",
      properties: {
        tenant: { type: "string", enum: [...TENANTS] },
        estado: { type: "string", enum: [...ESTADOS] },
        creadosHoy: { type: "boolean" },
        destinoContains: { type: "string", minLength: 2, maxLength: 80 },
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
      const today = todayKey();
      let rows = (
        await fileStore.listRemitos({
          tenant: args.tenant,
          estado: args.estado,
          limit: 2000,
          includeOcr: false,
        })
      ).map(mapRemito);

      if (args.workingSetOnly) {
        const ids = new Set(workingIds(ctx));
        rows = rows.filter((r) => ids.has(r.id) || (r.nro && ids.has(String(r.nro))));
      }
      if (Array.isArray(args.ids) && args.ids.length) {
        const want = new Set(args.ids.map(String));
        rows = rows.filter((r) => want.has(r.id) || (r.nro && want.has(String(r.nro))));
      }
      if (args.creadosHoy === true) rows = rows.filter((r) => dayKey(r.createdAt) === today);
      if (args.destinoContains) {
        const n = norm(args.destinoContains);
        rows = rows.filter((r) => norm(r.destino).includes(n));
      }

      const items = rows.slice(0, limit);
      return {
        today,
        timezone: TZ,
        count: items.length,
        totalMatched: rows.length,
        filters: { ...args, limit },
        entityType: "remitos",
        entityIds: items.map((i) => i.id),
        items,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "remitos.get",
    agentId: "remitos",
    domain: "remitos",
    description: "Detalle resumido de un remito por id (sin texto OCR).",
    argsSchema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 4, maxLength: 80 },
      },
      required: ["id"],
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 5000,
    readOnly: true,
    async execute(args) {
      const row = await fileStore.getRemito(args.id);
      if (!row) return { found: false, id: args.id, dataSource: "real" };
      const { texto_ocr, ...rest } = row;
      const item = mapRemito(rest);
      return { found: true, entityType: "remitos", entityIds: [item.id], item, dataSource: "real" };
    },
  });
}
