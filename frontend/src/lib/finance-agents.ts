import type { Agent } from "./agents";

export const financeAgents: Agent[] = [
  {
    id: 101,
    slug: "facturas",
    name: "Agente de Facturas",
    short: "Facturas",
    subtitle: "Una lista: a pagar (PDF) y a cobrar (solo sistema)",
    status: "pruebas",
    icon: "ReceiptText",
    what: "Lee facturas de proveedor en PDF, extrae CUIT, número, monto y vencimiento, y las deja en la misma lista que las facturas a cobrar. Las a cobrar entran solo por sistema: no hay alta en blanco ni carga Excel. No registra pagos salientes y no se mezcla con la rendición de choferes.",
    flow: [
      "Mesa sube el PDF de proveedor",
      "IA extrae los datos fiscales",
      "Se revisa y confirma la lectura",
      "Queda como factura a pagar",
      "Las a cobrar llegan por sistema",
    ],
    benefits: [
      "Sin carga manual de campos",
      "Cuentas por pagar separadas de rendición",
      "Misma bandeja para pagar y cobrar",
    ],
    channels: ["PDF", "OCR / Visión IA", "ERP (a cobrar)"],
    kpis: [
      { label: "A pagar (PDF)", value: "0", trend: "" },
      { label: "A cobrar (sistema)", value: "3", trend: "" },
      { label: "Cartera TSB+Beraldi+MYE", value: "$ 2,68 M", trend: "" },
    ],
    collaboratesWith: ["cobranzas", "conciliacion"],
  },
  {
    id: 102,
    slug: "cobranzas",
    name: "Agente de Cobranzas",
    short: "Cobranzas",
    subtitle: "Gestiona solo facturas a cobrar",
    status: "beta",
    icon: "Banknote",
    what: "Sigue el cobro de lo que el cliente debe. No gestiona facturas a pagar. El dinero entra por la pasarela (API); más adelante se podrán subir extractos. Cada factura muestra los pasos: emitida, contactado, cobrada, conciliada.",
    flow: [
      "Factura a cobrar entra por sistema",
      "IA arma la gestión de cobro",
      "Se registran pasos y promesas",
      "La pasarela avisa el cobro",
      "Pasa a conciliación",
    ],
    benefits: [
      "Solo cuentas por cobrar",
      "Pasos visibles factura por factura",
      "Sin carga manual de cobros",
    ],
    channels: ["ERP", "Pasarela API", "Backoffice"],
    kpis: [
      { label: "Cartera abierta", value: "$ 2.684.900", trend: "" },
      { label: "Vencidas", value: "2", trend: "TSB y MYE" },
      { label: "Promesas vigentes", value: "1", trend: "TSB hoy" },
    ],
    collaboratesWith: ["facturas", "conciliacion", "comunicacion"],
  },
  {
    id: 103,
    slug: "conciliacion",
    name: "Agente de Conciliación",
    short: "Conciliación",
    subtitle: "Empareja cobros de la pasarela con facturas a cobrar",
    status: "beta",
    icon: "Scale",
    what: "Mata ingresos de la pasarela contra facturas a cobrar. De entrada solo API de la pasarela. Después se podrán subir extractos bancarios. Las facturas a pagar no se concilian acá.",
    flow: [
      "La pasarela informa un cobro",
      "IA propone el match con la factura",
      "Queda conciliada o en revisión",
      "Más adelante: extracto bancario",
    ],
    benefits: [
      "Visibilidad del cobro sin planilla",
      "Match automático cuando hay referencia",
      "Extractos como segundo riel, no ahora",
    ],
    channels: ["Pasarela API", "Extracto (después)", "Backoffice"],
    kpis: [
      { label: "Aviso pasarela", value: "$ 312.400", trend: "MYE" },
      { label: "Pendiente de imputar", value: "1", trend: "PAS-MYE-4410" },
      { label: "Conciliados", value: "0", trend: "" },
    ],
    collaboratesWith: ["facturas", "cobranzas"],
  },
  {
    id: 104,
    slug: "comunicacion",
    name: "Agente de Comunicación",
    short: "Comunicación",
    subtitle: "Contacta al cliente para cobrar",
    status: "beta",
    icon: "Megaphone",
    what: "Escribe y llama al cliente sobre facturas a cobrar: recordatorio, vencido, seguimiento. Cada contacto queda como un paso en la factura. No contacta proveedores de cuentas por pagar.",
    flow: [
      "Hay factura a cobrar vencida o por vencer",
      "IA arma el mensaje",
      "WhatsApp, email o llamada",
      "Se registra el paso en la factura",
    ],
    benefits: [
      "Cobranza con rastro de cada contacto",
      "Menos seguimiento manual",
      "Misma línea de tiempo que cobranzas",
    ],
    channels: ["WhatsApp", "Email", "Llamada"],
    kpis: [
      { label: "WhatsApp enviado", value: "1", trend: "TSB" },
      { label: "Por contactar", value: "2", trend: "Beraldi y MYE" },
      { label: "Promesas", value: "1", trend: "TSB" },
    ],
    collaboratesWith: ["cobranzas", "facturas"],
  },
];

export function getFinanceAgent(slug: string): Agent | undefined {
  return financeAgents.find((a) => a.slug === slug);
}
