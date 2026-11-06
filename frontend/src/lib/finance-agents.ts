import type { Agent } from "./agents";

export const financeAgents: Agent[] = [
  {
    id: 101,
    slug: "facturas",
    name: "Facturas de pago (CxP)",
    short: "Facturas de pago",
    subtitle: "Digitalizar y empujar al ERP",
    status: "pruebas",
    icon: "ReceiptText",
    what: "Cuentas por pagar: entra por email, WhatsApp, repositorio o upload. OCR digitaliza, queda en el sistema y se transfiere al ERP. Simple: digitalizar y empujar al ERP.",
    flow: [
      "Entra por email / WhatsApp / repo / upload",
      "OCR digitaliza la factura",
      "Queda registrada en el sistema",
      "Se transfiere al ERP",
    ],
    benefits: [
      "Sin carga manual de campos",
      "CxP separado de CxC",
      "Listo para empujar al ERP",
    ],
    channels: ["Email", "WhatsApp", "Repositorio", "Upload", "OCR"],
    kpis: [
      { label: "A pagar (OCR)", value: "0", trend: "" },
      { label: "Pendientes ERP", value: "0", trend: "" },
      { label: "Confirmadas", value: "0", trend: "" },
    ],
    collaboratesWith: ["cobranzas", "conciliacion"],
  },
  {
    id: 102,
    slug: "cobranzas",
    name: "Facturas de cobranza (CxC)",
    short: "Facturas de cobranza",
    subtitle: "Cartera, historial por factura, comunicación y conciliación",
    status: "beta",
    icon: "Banknote",
    what: "Cuentas por cobrar: entra desde ERP / Excel (o alta manual). Cartera por cobrar con historial de contactos y gestiones por factura, más comunicación y conciliación de cobros — lo que un sistema solo de cobranzas suele no tener bien.",
    flow: [
      "Entra desde ERP / Excel (o alta manual)",
      "Arma la cartera por cobrar",
      "Historial de contactos y gestiones por factura",
      "Comunicación de cobro",
      "Conciliación de cobros",
    ],
    benefits: [
      "Historial por factura (no solo cartera)",
      "CxC separado de CxP",
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
