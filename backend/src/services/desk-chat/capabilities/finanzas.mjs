/**
 * Pack Finanzas — read-only desk chat (CxP / CxC / gestión / conciliación).
 */
import { listFacturas } from "../../../db/finanzas-facturas-store.mjs";
import { listCobros } from "../../../db/finanzas-cobros-store.mjs";
import { ensureFinanzasDemo, resumenFinanzas } from "../../finanzas-gestion.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, norm, compactEntityRefs } from "./_shared.mjs";

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

function saldoDe(f) {
  return Math.max(0, Number(f.monto || 0) - Number(f.monto_aplicado || 0));
}

function compactFactura(r) {
  return {
    id: r.id,
    tipo: r.tipo,
    numero: r.numero,
    razon_social: r.razon_social,
    cuit: r.cuit_emisor || r.cuit,
    monto: money(r.monto),
    saldo: money(saldoDe(r)),
    estado: r.estado,
    fecha: r.fecha,
    fecha_vto: r.fecha_vto,
    origen: r.origen,
  };
}

export function registerFinanzasCapabilities() {
  registerCapability({
    name: "finanzas.resumen",
    agentId: "finanzas",
    domain: "finanzas",
    description: "Resumen del dashboard de Finanzas: cartera, vencidas, cobrado, conteos CxP/CxC.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const resumen = await resumenFinanzas();
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        ...resumen,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "facturas.resumen_pagar",
    agentId: "facturas",
    domain: "facturas",
    description:
      "Resumen de Facturas de pago (CxP): totales, pendientes de confirmar, confirmadas. Flujo: email/WA/repo/upload → OCR → sistema → ERP.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const rows = await listFacturas({ tipo: "pagar", limit: 500 });
      const pendientes = rows.filter((r) => String(r.estado || "") !== "confirmada");
      const confirmadas = rows.filter((r) => String(r.estado || "") === "confirmada");
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: rows.length,
        pendientes: pendientes.length,
        confirmadas: confirmadas.length,
        monto_total: money(rows.reduce((s, r) => s + Number(r.monto || 0), 0)),
        flujo: "email/WhatsApp/repo/upload → OCR → sistema → ERP",
        entityType: "facturas_pagar",
        entityIds: rows.slice(0, 40).map((r) => r.id),
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "facturas.list_pagar",
    agentId: "facturas",
    domain: "facturas",
    description: "Lista facturas a pagar (CxP). Filtros: estado, q, limit.",
    argsSchema: {
      type: "object",
      properties: {
        estado: { type: "string", minLength: 2, maxLength: 40 },
        q: { type: "string", minLength: 1, maxLength: 80 },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute(args) {
      await ensureFinanzasDemo();
      const limit = args.limit ?? 20;
      let rows = await listFacturas({ tipo: "pagar", limit: 300 });
      if (args.estado) {
        const e = norm(args.estado);
        rows = rows.filter((r) => norm(r.estado).includes(e));
      }
      if (args.q) {
        const q = norm(args.q);
        rows = rows.filter((r) =>
          norm([r.numero, r.razon_social, r.cuit_emisor, r.id].filter(Boolean).join(" ")).includes(q),
        );
      }
      rows = rows.slice(0, limit);
      const refs = compactEntityRefs(rows, compactFactura);
      return {
        count: rows.length,
        items: refs,
        entityType: "facturas_pagar",
        entityIds: refs.map((r) => r.id),
        refs,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "facturas.resumen_cobrar",
    agentId: "facturas-cobro",
    domain: "facturas-cobro",
    description:
      "Resumen de Facturas de cobranza (CxC): cartera, vencidas, saldos. Entrada ERP/Excel. Distinto de Gestión de cobranza.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const rows = await listFacturas({ tipo: "cobrar", limit: 500 });
      const today = todayKey();
      const abiertas = rows.filter((r) => saldoDe(r) > 0);
      const vencidas = abiertas.filter((r) => r.fecha_vto && r.fecha_vto < today);
      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: rows.length,
        abiertas: abiertas.length,
        vencidas: vencidas.length,
        cartera: money(abiertas.reduce((s, r) => s + saldoDe(r), 0)),
        entityType: "facturas_cobrar",
        entityIds: rows.slice(0, 40).map((r) => r.id),
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "facturas.list_cobrar",
    agentId: "facturas-cobro",
    domain: "facturas-cobro",
    description: "Lista facturas a cobrar (CxC) con saldo/historial básico. Filtros: q, vencidasOnly, limit.",
    argsSchema: {
      type: "object",
      properties: {
        q: { type: "string", minLength: 1, maxLength: 80 },
        vencidasOnly: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute(args) {
      await ensureFinanzasDemo();
      const limit = args.limit ?? 20;
      const today = todayKey();
      let rows = await listFacturas({ tipo: "cobrar", limit: 300 });
      if (args.vencidasOnly) {
        rows = rows.filter((r) => saldoDe(r) > 0 && r.fecha_vto && r.fecha_vto < today);
      }
      if (args.q) {
        const q = norm(args.q);
        rows = rows.filter((r) =>
          norm([r.numero, r.razon_social, r.cuit_emisor, r.id].filter(Boolean).join(" ")).includes(q),
        );
      }
      rows = rows.slice(0, limit);
      const refs = compactEntityRefs(rows, (r) => ({
        ...compactFactura(r),
        pasos: Array.isArray(r.pasos) ? r.pasos.slice(-3) : [],
      }));
      return {
        count: rows.length,
        items: refs,
        entityType: "facturas_cobrar",
        entityIds: refs.map((r) => r.id),
        refs,
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "cobranzas.resumen",
    agentId: "cobranzas",
    domain: "cobranzas",
    description:
      "Gestión de cobranza operativa: reclamos/WhatsApp/promesas sobre cartera CxC. No es la lista de Facturas de cobranza.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const rows = await listFacturas({ tipo: "cobrar", limit: 500 });
      const conPromesa = rows.filter((r) =>
        Array.isArray(r.pasos)
          ? r.pasos.some((p) => /promesa|whatsapp|reclamo|contact/i.test(String(p.label || "")))
          : false,
      );
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        en_seguimiento: rows.filter((r) => saldoDe(r) > 0).length,
        con_gestion_registrada: conPromesa.length,
        nota: "Operativa de cobro (reclamos/WA). Cartera e historial por factura: módulo Facturas de cobranza.",
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "conciliacion.resumen",
    agentId: "conciliacion",
    domain: "conciliacion",
    description: "Resumen de conciliación: cobros de pasarela pendientes vs aplicados.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const cobros = await listCobros({ limit: 500 });
      const pendientes = cobros.filter((c) => c.estado !== "aplicado");
      const aplicados = cobros.filter((c) => c.estado === "aplicado");
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        total: cobros.length,
        pendientes: pendientes.length,
        aplicados: aplicados.length,
        monto_pendiente: money(pendientes.reduce((s, c) => s + Number(c.monto || 0), 0)),
        monto_aplicado: money(aplicados.reduce((s, c) => s + Number(c.monto || 0), 0)),
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "comunicacion.resumen",
    agentId: "comunicacion",
    domain: "comunicacion",
    description:
      "Orientación sobre envío de recordatorios de cobranza. No envía WhatsApp desde el chat; usa datos de cartera CxC.",
    argsSchema: { type: "object", properties: {}, additionalProperties: false },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 8000,
    readOnly: true,
    async execute() {
      await ensureFinanzasDemo();
      const rows = await listFacturas({ tipo: "cobrar", limit: 500 });
      const conTel = rows.filter((r) => r.telefono && saldoDe(r) > 0);
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        candidatos_mensaje: conTel.length,
        nota: "El envío se hace desde la pantalla de Comunicación, no desde este chat.",
        dataSource: "real",
      };
    },
  });

  registerCapability({
    name: "clientes.resumen_finanzas",
    agentId: "clientes",
    domain: "clientes",
    description: "Clientes con saldo en cartera CxC (top deudores).",
    argsSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 10000,
    readOnly: true,
    async execute(args) {
      await ensureFinanzasDemo();
      const limit = args.limit ?? 10;
      const rows = await listFacturas({ tipo: "cobrar", limit: 500 });
      const by = new Map();
      for (const r of rows) {
        const key = String(r.razon_social || r.cuit_emisor || "Sin nombre");
        const cur = by.get(key) || { cliente: key, saldo: 0, facturas: 0 };
        cur.saldo += saldoDe(r);
        cur.facturas += 1;
        by.set(key, cur);
      }
      const top = [...by.values()]
        .filter((c) => c.saldo > 0)
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, limit)
        .map((c) => ({ ...c, saldo: money(c.saldo) }));
      return {
        today: todayKey(),
        timezone: TZ,
        asOf: new Date().toISOString(),
        clientes_con_saldo: top.length,
        top,
        dataSource: "real",
      };
    },
  });
}
