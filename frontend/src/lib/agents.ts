export type AgentStatus = "operativo" | "pruebas" | "beta";

export interface Agent {
  id: number;
  slug: string;
  name: string;
  short: string;
  subtitle: string;
  status: AgentStatus;
  icon: string; // lucide icon name
  what: string;
  flow: string[];
  benefits: string[];
  channels: string[];
  kpis: { label: string; value: string; trend?: string }[];
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  operativo: "Operativo",
  pruebas: "En pruebas",
  beta: "Beta",
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  operativo: "#22c55e",
  pruebas: "#f59e0b",
  beta: "#38bdf8",
};

export const agents: Agent[] = [
  {
    id: 1,
    slug: "remitos",
    name: "Agente de Remitos",
    short: "Remitos",
    subtitle: "Captura, lectura y trazabilidad documental del viaje",
    status: "operativo",
    icon: "FileText",
    what: "Se comunica con los choferes por WhatsApp para recibir remitos en dos momentos: al salir del recinto y al llegar a destino. Lee remitos impresos o manuscritos, estructura la información y la muestra en backoffice antes de enviarla al TMS del cliente.",
    flow: [
      "Chofer sale del recinto",
      "Envía remito por WhatsApp",
      "IA lee y estructura datos",
      "Backoffice muestra estados y validaciones",
      "Chofer llega y envía segundo remito",
      "Consolidación y envío al TMS",
    ],
    benefits: [
      "Menos carga manual",
      "Remitos manuscritos digitalizados",
      "Trazabilidad documental completa",
    ],
    channels: ["WhatsApp", "OCR / Visión IA", "TMS"],
    kpis: [
      { label: "Remitos procesados hoy", value: "412", trend: "+18%" },
      { label: "Lectura automática", value: "97,1%", trend: "+2,1%" },
      { label: "Tiempo medio de carga", value: "16 s", trend: "-76%" },
    ],
  },
  {
    id: 2,
    slug: "viajes",
    name: "Agente de Gestión de Viajes",
    short: "Gestión de Viajes",
    subtitle: "Recepción, programación, asignación y coordinación operativa",
    status: "operativo",
    icon: "Route",
    what: "Recibe solicitudes de transporte por distintos canales, principalmente email y WhatsApp. Valida la información, consulta disponibilidad de camiones y capacidad, confirma el viaje, lo registra en el TMS y coordina con el chofer asignado.",
    flow: [
      "Solicitud por email o WhatsApp",
      "Interpretación y validación de datos",
      "Consulta de agenda, disponibilidad y capacidad",
      "Confirmación del viaje",
      "Registro en el TMS",
      "Asignación del chofer",
      "Coordinación y seguimiento",
    ],
    benefits: [
      "Menos coordinación manual",
      "Mejor uso de flota",
      "Carga ordenada en el TMS",
    ],
    channels: ["Email", "WhatsApp", "TMS"],
    kpis: [
      { label: "Viajes coordinados hoy", value: "97", trend: "+14%" },
      { label: "Uso de flota", value: "91%", trend: "+8 pts" },
      { label: "Tiempo de asignación", value: "3,6 min", trend: "-63%" },
    ],
  },
  {
    id: 3,
    slug: "destinos",
    name: "Confirmación de Destinos",
    short: "Destinos",
    subtitle: "Validación de direcciones y coordinación para entregas cortas",
    status: "pruebas",
    icon: "MapPin",
    what: "Para viajes cortos o entregas tipo delivery, recibe una dirección o coordenadas, valida la ubicación con Google Maps, confirma el destino con el cliente y luego envía la ubicación final al chofer.",
    flow: [
      "Pedido o viaje corto",
      "Recepción de dirección o coordenadas",
      "Validación en Google Maps",
      "Confirmación del destino con el cliente",
      "Generación de punto final y link",
      "Envío al chofer y actualización del sistema",
    ],
    benefits: [
      "Menos errores de entrega",
      "Menos llamadas manuales",
      "Destino validado y geolocalizado",
    ],
    channels: ["Google Maps", "WhatsApp", "TMS"],
    kpis: [
      { label: "Destinos validados hoy", value: "138", trend: "+19%" },
      { label: "Direcciones corregidas", value: "24", trend: "" },
      { label: "Precisión de geocodeo", value: "98,6%", trend: "+0,9%" },
    ],
  },
  {
    id: 4,
    slug: "incidencias",
    name: "Gestión de Incidencias",
    short: "Incidencias",
    subtitle: "Detección, consulta y clasificación de eventos en ruta",
    status: "pruebas",
    icon: "TriangleAlert",
    what: "Cuando el sistema detecta una parada, un desvío o una anomalía del viaje, envía la información al agente. El agente se comunica con el chofer por WhatsApp, solicita la causa del evento y actualiza el sistema o genera una alerta según la criticidad.",
    flow: [
      "Sistema detecta parada o desvío",
      "Envía coordenadas al agente",
      "Contacto con el chofer por WhatsApp",
      "Chofer informa la causa",
      "IA clasifica el evento",
      "Actualización del sistema o alerta",
    ],
    benefits: [
      "Reacción más rápida",
      "Trazabilidad de incidencias",
      "Mejor control operativo",
    ],
    channels: ["Tracking GPS", "WhatsApp", "Alertas"],
    kpis: [
      { label: "Eventos detectados hoy", value: "52", trend: "" },
      { label: "Causa declarada", value: "94%", trend: "+13 pts" },
      { label: "Tiempo de respuesta", value: "2,8 min", trend: "-68%" },
    ],
  },
  {
    id: 5,
    slug: "rendicion",
    name: "Rendición de Viajes",
    short: "Rendición",
    subtitle: "Gastos, comprobantes y liquidación de viajes",
    status: "pruebas",
    icon: "ReceiptText",
    what: "El chofer envía gastos y comprobantes del viaje (combustible, peajes, viáticos). El agente los lee, los clasifica, valida contra el presupuesto del viaje y arma la rendición lista para aprobación y liquidación.",
    flow: [
      "Chofer envía comprobantes",
      "IA lee y clasifica gastos",
      "Validación contra presupuesto",
      "Armado de la rendición",
      "Aprobación del backoffice",
      "Liquidación al chofer",
    ],
    benefits: [
      "Rendiciones sin planillas",
      "Comprobantes digitalizados",
      "Liquidación más rápida",
    ],
    channels: ["WhatsApp", "OCR / Visión IA", "Backoffice"],
    kpis: [
      { label: "Rendiciones del mes", value: "486", trend: "+11%" },
      { label: "Comprobantes leídos", value: "3.124", trend: "+17%" },
      { label: "Tiempo de liquidación", value: "0,9 días", trend: "-52%" },
    ],
  },
  {
    id: 6,
    slug: "eta",
    name: "ETA y Notificación Proactiva",
    short: "ETA",
    subtitle: "Avisos automáticos de llegada, demoras y cambios de estado",
    status: "beta",
    icon: "Clock",
    what: "Usa datos del viaje, ubicación y ruta para estimar horarios de llegada y comunicar de forma proactiva al cliente, destinatario o equipo interno. Reduce consultas manuales y mejora la visibilidad del proceso.",
    flow: [
      "Tracking o TMS actualiza ubicación",
      "IA estima ETA con ruta y estado del viaje",
      "Valida ventana horaria o compromiso",
      "Notifica al cliente o destinatario",
      "Informa demoras o cambios",
      "Registra comunicación y estado",
    ],
    benefits: [
      "Menos consultas",
      "Mejor experiencia del cliente",
      "Visibilidad de llegada",
    ],
    channels: ["Tracking GPS", "Google Maps", "WhatsApp", "Email"],
    kpis: [
      { label: "Notificaciones enviadas hoy", value: "618", trend: "+22%" },
      { label: "Precisión de ETA (±15 min)", value: "92,4%", trend: "+3,6%" },
      { label: "Consultas evitadas", value: "-47%", trend: "" },
    ],
  },
  {
    id: 7,
    slug: "reclamos",
    name: "Reclamos Logísticos",
    short: "Reclamos",
    subtitle: "Clasificación, trazabilidad y resolución asistida de reclamos",
    status: "beta",
    icon: "MessageSquareWarning",
    what: "Recibe reclamos por WhatsApp, email o web, identifica el viaje relacionado, consulta información del TMS, remitos y tracking, clasifica el caso y genera seguimiento o escalamiento según reglas definidas.",
    flow: [
      "Cliente reporta reclamo",
      "IA identifica viaje, pedido o remito",
      "Clasifica motivo y criticidad",
      "Consulta TMS, remitos y tracking",
      "Genera ticket o caso",
      "Responde, escala o da seguimiento",
    ],
    benefits: [
      "Atención ordenada",
      "Trazabilidad completa",
      "Menor tiempo de resolución",
    ],
    channels: ["WhatsApp", "Email", "Web", "TMS"],
    kpis: [
      { label: "Reclamos abiertos", value: "23", trend: "" },
      { label: "Resueltos en SLA", value: "89%", trend: "+10 pts" },
      { label: "Tiempo de resolución", value: "5,8 h", trend: "-42%" },
    ],
  },
  {
    id: 8,
    slug: "analitica",
    name: "Analítica de Performance",
    short: "Analítica",
    subtitle: "Datos consolidados, KPIs operativos y alertas inteligentes",
    status: "beta",
    icon: "ChartColumnBig",
    what: "Consolida la información generada por viajes, remitos, incidencias, reclamos y rendiciones. Permite detectar patrones, medir desempeño y alimentar dashboards ejecutivos u operativos en BigQuery y Looker.",
    flow: [
      "Captura datos de viajes e interacciones",
      "Consolida información en BigQuery",
      "IA detecta patrones y desvíos",
      "Genera KPIs y alertas",
      "Publica dashboards en Looker / backoffice",
      "Envía reporte ejecutivo periódico",
    ],
    benefits: [
      "Decisiones con datos",
      "Detección de cuellos de botella",
      "Mejora continua",
    ],
    channels: ["BigQuery", "Looker", "Backoffice"],
    kpis: [
      { label: "Viajes analizados (30d)", value: "6.918", trend: "+16%" },
      { label: "SLA de entrega", value: "95,1%", trend: "+2,9%" },
      { label: "Alertas generadas", value: "64", trend: "" },
    ],
  },
];

export function getAgent(slug: string): Agent | undefined {
  return agents.find((a) => a.slug === slug);
}
