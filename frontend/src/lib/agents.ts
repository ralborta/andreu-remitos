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
  /** Otros agentes con los que se comunica (slugs). */
  collaboratesWith?: string[];
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  operativo: "Operativo",
  pruebas: "Operativo",
  beta: "Beta",
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  operativo: "#22c55e",
  pruebas: "#22c55e",
  beta: "#38bdf8",
};

export const agents: Agent[] = [
  {
    id: 0,
    slug: "commander",
    name: "Chat Central Commander",
    short: "Chat Central",
    subtitle: "Consulta transversal read-only entre especialistas de mesa",
    status: "operativo",
    icon: "Radio",
    what: "Chat único de mesa que interpreta en lenguaje natural y consulta los packs read-only de Viajes, Incidencias, Rendición, ETA, POD y Remitos. No envía WhatsApp, no OCR ni mutaciones: solo lectura grounded con el mismo Desk Chat Runtime.",
    flow: [
      "Operador pregunta en lenguaje natural",
      "LLM arma un plan de capabilities",
      "Se ejecutan consultas read-only de los especialistas",
      "LLM sintetiza la respuesta con datos reales",
      "Working set referencial para follow-ups",
    ],
    benefits: [
      "Una sola puerta de consulta",
      "Misma trazabilidad que los especialistas",
      "Sin heurísticas ni keywords",
    ],
    channels: ["Mesa web", "Desk Chat Runtime"],
    kpis: [
      { label: "Dominios", value: "6", trend: "" },
      { label: "Modo", value: "Solo lectura", trend: "" },
      { label: "Motor", value: "LLM-first", trend: "" },
    ],
    collaboratesWith: ["viajes", "incidencias", "rendicion", "eta", "pod", "remitos", "destinos"],
  },
  {
    id: 1,
    slug: "viajes",
    name: "Agente de Gestión de Viajes",
    short: "Gestión de Viajes",
    subtitle: "Configura y administra los horarios y disponibilidad de tu flota",
    status: "operativo",
    icon: "Route",
    what: "Recibe solicitudes de transporte por distintos canales, principalmente email y WhatsApp. Valida la información, consulta disponibilidad de camiones y capacidad, confirma el viaje, lo registra en el TMS y coordina con el chofer asignado. Se comunica con el agente de ETA (compromiso de llegada) y con Incidencias cuando hay eventos en ruta.",
    flow: [
      "Solicitud por email o WhatsApp",
      "Interpretación y validación de datos",
      "Consulta de agenda, disponibilidad y capacidad",
      "Confirmación del viaje",
      "Registro en el TMS",
      "Asignación del chofer",
      "Aviso al agente ETA (compromiso de llegada)",
      "Coordinación y seguimiento",
    ],
    benefits: [
      "Menos coordinación manual",
      "Mejor uso de flota",
      "Carga ordenada en el TMS",
      "ETA alineado con el viaje",
    ],
    channels: ["Email", "WhatsApp", "TMS", "Agente ETA"],
    kpis: [
      { label: "Viajes coordinados hoy", value: "97", trend: "+14%" },
      { label: "Uso de flota", value: "91%", trend: "+8 pts" },
      { label: "Tiempo de asignación", value: "3,6 min", trend: "-63%" },
    ],
    collaboratesWith: ["eta", "incidencias", "pod"],
  },
  {
    id: 2,
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
    collaboratesWith: [],
  },
  {
    id: 3,
    slug: "destinos",
    name: "Confirmación de Destinos",
    short: "Destinos",
    subtitle: "Validación de direcciones y coordinación para entregas cortas",
    status: "operativo",
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
    collaboratesWith: [],
  },
  {
    id: 4,
    slug: "incidencias",
    name: "Gestión de Incidencias",
    short: "Incidencias",
    subtitle: "Detección, consulta y clasificación de eventos en ruta",
    status: "beta",
    icon: "TriangleAlert",
    what: "Lo principal: el agente detecta que el chofer está parado y le pregunta por WhatsApp *por qué*. El chofer responde, la IA clasifica y abre el caso. Como opción secundaria, el chofer también puede reportar solo (pinchazo, control, mecánico…). Las demoras de Destinos quedan registradas acá. Cuando hay demora, se comunica con el agente ETA para recalcular llegada y avisar.",
    flow: [
      "Sistema / operaciones detecta parada en ruta",
      "Agente escribe al chofer: ¿por qué estás parado?",
      "Chofer responde la causa",
      "IA clasifica tipo y criticidad",
      "Caso abierto en el panel (INC-…)",
      "Aviso al agente ETA (recalcular / notificar demora)",
      "Operaciones toma o resuelve (el chofer también puede reportar por su cuenta)",
    ],
    benefits: [
      "Reacción más rápida ante paradas",
      "Trazabilidad de incidencias",
      "El chofer también puede avisar solo",
      "ETA actualizado ante demoras",
    ],
    channels: ["WhatsApp", "Agente ETA", "Destinos", "Backoffice"],
    kpis: [
      { label: "Eventos detectados hoy", value: "52", trend: "" },
      { label: "Causa declarada", value: "94%", trend: "+13 pts" },
      { label: "Tiempo de respuesta", value: "2,8 min", trend: "-68%" },
    ],
    collaboratesWith: ["eta", "viajes"],
  },
  {
    id: 5,
    slug: "rendicion",
    name: "Rendición de Viajes",
    short: "Rendición",
    subtitle: "Gastos, comprobantes y liquidación de viajes",
    status: "operativo",
    icon: "ReceiptText",
    what: "El chofer envía gastos menores del viaje (nafta, peajes, llantas, aceite, remolque, auxilio, arreglos). El agente los lee, los clasifica y los deja pendientes de aprobación humana — casi en línea, como la aprobación de destinos.",
    flow: [
      "Chofer envía ticket/factura por WhatsApp",
      "IA lee y clasifica el gasto",
      "Queda pendiente de aprobación",
      "Backoffice aprueba o rechaza",
      "Aviso al chofer",
    ],
    benefits: [
      "Gastos menores sin planillas",
      "Comprobantes digitalizados",
      "Aprobación humana siempre",
    ],
    channels: ["WhatsApp", "OCR / Visión IA", "Backoffice"],
    kpis: [
      { label: "Rendiciones del mes", value: "486", trend: "+11%" },
      { label: "Comprobantes leídos", value: "3.124", trend: "+17%" },
      { label: "Tiempo de liquidación", value: "0,9 días", trend: "-52%" },
    ],
    collaboratesWith: [],
  },
  {
    id: 6,
    slug: "eta",
    name: "ETA y Notificación Proactiva",
    short: "ETA",
    subtitle: "Avisos automáticos de llegada, demoras y cambios de estado",
    status: "operativo",
    icon: "Clock",
    what: "Agente independiente que estima horarios de llegada y avisa de forma proactiva. Se comunica con Gestión de Viajes (toma el viaje y el compromiso) y con Incidencias (si hay demora, recalcula y notifica). No reemplaza a esos agentes: depende de ellos y les responde con el ETA actualizado.",
    flow: [
      "Recibe del agente Viajes: viaje, chofer y ventana comprometida",
      "Tracking / ruta actualiza ubicación",
      "IA estima ETA",
      "Notifica al cliente o destinatario",
      "Si Incidencias reporta demora → recalcula ETA y reenvía aviso",
      "Devuelve ETA y estado al agente Viajes",
    ],
    benefits: [
      "Menos consultas",
      "Mejor experiencia del cliente",
      "Visibilidad de llegada",
      "Reacciona a demoras vía Incidencias",
    ],
    channels: ["Agente Viajes", "Agente Incidencias", "WhatsApp", "Google Maps"],
    kpis: [
      { label: "Notificaciones enviadas hoy", value: "618", trend: "+22%" },
      { label: "Precisión de ETA (±15 min)", value: "92,4%", trend: "+3,6%" },
      { label: "Consultas evitadas", value: "-47%", trend: "" },
    ],
    collaboratesWith: ["viajes", "incidencias"],
  },
  {
    id: 7,
    slug: "pod",
    name: "Constancia de Entrega (POD)",
    short: "POD",
    subtitle: "Receptor + foto de prueba por WhatsApp, confirmación en mesa",
    status: "operativo",
    icon: "ClipboardCheck",
    what: "Proof of Delivery: el chofer manda la foto del formulario/producto por WhatsApp. Google Document AI hace el OCR; la IA estructura receptor, pedido y destino y conversa si falta algo. Mesa de control confirma o rechaza.",
    flow: [
      "Chofer escribe o manda foto por WhatsApp",
      "IA entiende que es POD",
      "Document AI lee el formulario (OCR)",
      "IA estructura receptor / pedido / destino",
      "Si falta el receptor, lo pide en lenguaje natural",
      "Caso pendiente · backoffice confirma o rechaza",
    ],
    benefits: [
      "Prueba de entrega trazable",
      "Menos ida y vuelta por teléfono",
      "Confirmación humana en mesa",
    ],
    channels: ["WhatsApp", "Document AI", "Backoffice", "Agente Viajes"],
    kpis: [
      { label: "POD pendientes", value: "—", trend: "" },
      { label: "Confirmados", value: "—", trend: "" },
      { label: "En diálogo WA", value: "—", trend: "" },
    ],
    collaboratesWith: ["viajes", "destinos"],
  },
  {
    id: 8,
    slug: "reclamos",
    name: "Reclamos Logísticos",
    short: "Reclamos",
    subtitle: "Clasificación, trazabilidad y resolución asistida de reclamos",
    status: "beta",
    icon: "MessageSquareWarning",
    what: "Recibe reclamos de clientes por WhatsApp con un diálogo 100% IA (humanizado, sin menús ni heurísticas frágiles). Entiende el caso, pide solo lo que falta, clasifica motivo y criticidad, abre el ticket y escala cuando hace falta.",
    flow: [
      "Cliente reporta el reclamo por WhatsApp",
      "IA conversa y entiende qué pasó",
      "Identifica viaje, pedido o remito si lo hay",
      "Clasifica motivo y criticidad",
      "Abre el caso en la cola (y escala si urge)",
      "Backoffice toma, escala o resuelve con aviso al cliente",
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
    collaboratesWith: [],
  },
  {
    id: 9,
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
    collaboratesWith: [],
  },
];

export function getAgent(slug: string): Agent | undefined {
  return agents.find((a) => a.slug === slug);
}
