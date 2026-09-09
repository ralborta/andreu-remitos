export type DemoAgent = {
  slug: string;
  name: string;
  short: string;
  subtitle: string;
  blurb: string;
  what: string;
  flow: string[];
};

/** Especialistas + copy alineado a frontend/src/lib/agents.ts */
export const DEMO_AGENTS: DemoAgent[] = [
  {
    slug: "viajes",
    name: "Gestión de Viajes",
    short: "Viajes",
    subtitle: "Configura y administra los horarios y disponibilidad de tu flota",
    blurb: "Pedidos, asignación de flota/chofer y carga en el TMS.",
    what: "Recibe solicitudes por email y WhatsApp, valida, asigna flota/chofer y registra en el TMS. Coordina con ETA e Incidencias.",
    flow: [
      "Solicitud por email o WhatsApp",
      "Interpretación y validación",
      "Disponibilidad y capacidad",
      "Confirmación y registro TMS",
      "Asignación de chofer",
      "Aviso a ETA y seguimiento",
    ],
  },
  {
    slug: "tracking",
    name: "Tracking Express",
    short: "Tracking",
    subtitle: "Seguimiento del viaje desde el celular del chofer (sin app)",
    blurb: "Seguimiento del viaje por link WhatsApp (sin instalar app).",
    what: "Link temporal por WhatsApp; posiciones desde el navegador del chofer hacia la Torre.",
    flow: [
      "Mesa genera enlace",
      "Chofer abre webapp por WhatsApp",
      "Consentimiento + GPS",
      "Torre ve ubicación e incidencias",
      "POD al cierre",
    ],
  },
  {
    slug: "remitos",
    name: "Remitos",
    short: "Remitos",
    subtitle: "Captura, lectura y trazabilidad documental del viaje",
    blurb: "Foto del remito → lectura IA → listo para backoffice/TMS.",
    what: "Remitos por WhatsApp (salida y destino), lectura IA y carga a backoffice/TMS.",
    flow: [
      "Salida del recinto → foto remito",
      "IA lee y estructura",
      "Validación en backoffice",
      "Segundo remito en destino",
      "Envío al TMS",
    ],
  },
  {
    slug: "destinos",
    name: "Destinos",
    short: "Destinos",
    subtitle: "Validación de direcciones y coordinación para entregas cortas",
    blurb: "Valida direcciones, confirma con el cliente y manda el punto al chofer.",
    what: "Valida dirección/coords con Maps, confirma con el cliente y envía el punto al chofer.",
    flow: [
      "Pedido corto",
      "Dirección o coordenadas",
      "Validación Maps",
      "Confirmación con cliente",
      "Link al chofer",
    ],
  },
  {
    slug: "incidencias",
    name: "Incidencias",
    short: "Incidencias",
    subtitle: "Detección, consulta y clasificación de eventos en ruta",
    blurb: "Paradas y eventos en ruta: clasifica la causa y abre el caso.",
    what: "Detecta parada, pregunta al chofer por WhatsApp, clasifica y abre caso; avisa a ETA si hay demora.",
    flow: [
      "Detección de parada",
      "Pregunta al chofer",
      "Clasificación IA",
      "Caso INC-…",
      "Aviso a ETA",
    ],
  },
  {
    slug: "rendicion",
    name: "Rendición",
    short: "Rendición",
    subtitle: "Gastos, comprobantes y liquidación de viajes",
    blurb: "Gastos y comprobantes por WhatsApp, con aprobación humana.",
    what: "Tickets por WhatsApp → lectura/clasificación → aprobación humana.",
    flow: [
      "Chofer envía comprobante",
      "IA clasifica",
      "Pendiente de aprobación",
      "Backoffice decide",
      "Aviso al chofer",
    ],
  },
  {
    slug: "eta",
    name: "ETA",
    short: "ETA",
    subtitle: "Avisos automáticos de llegada, demoras y cambios de estado",
    blurb: "Estima llegada y avisa demoras o cambios.",
    what: "Estima ETA desde Viajes/Tracking; recalcula ante incidencias y notifica al cliente.",
    flow: [
      "Viajes entrega compromiso",
      "Tracking actualiza ubicación",
      "IA estima ETA",
      "Notifica cliente",
      "Recalcula si hay demora",
    ],
  },
  {
    slug: "pod",
    name: "POP/POD",
    short: "Evidencias",
    subtitle: "Proof of Pickup y Proof of Delivery por WhatsApp",
    blurb: "Prueba de retiro y entrega; compara origen vs destino.",
    what: "POP en origen y POD en destino; compara cantidades y cierra cadena de custodia.",
    flow: [
      "POP en origen",
      "Aprobación mesa → tránsito",
      "POD en destino",
      "Comparación POP vs POD",
      "Confirmación de entrega",
    ],
  },
  {
    slug: "reclamos",
    name: "Reclamos",
    short: "Reclamos",
    subtitle: "Clasificación, trazabilidad y resolución asistida",
    blurb: "Reclamos por WhatsApp, clasificación y ticket trazable.",
    what: "Diálogo IA por WhatsApp, clasificación y ticket; backoffice resuelve.",
    flow: [
      "Cliente reporta por WhatsApp",
      "IA entiende el caso",
      "Clasifica motivo/criticidad",
      "Abre ticket",
      "Resolución con aviso",
    ],
  },
  {
    slug: "analitica",
    name: "Analítica",
    short: "Analítica",
    subtitle: "KPIs, patrones y alertas de toda la operación",
    blurb: "KPIs, patrones y alertas a partir de toda la operación.",
    what: "Consolida datos de agentes → KPIs, alertas y dashboards.",
    flow: [
      "Captura de eventos",
      "Consolidación",
      "Detección de patrones",
      "KPIs y alertas",
      "Dashboards / reporte",
    ],
  },
];

export const FAQ_INTRO =
  "SOL es un sistema de agentes de inteligencia artificial para empresas de transporte que observa la operación, entiende qué está pasando y actúa automáticamente ante tareas, eventos y excepciones.";

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Qué es SOL?",
    a: "Un ecosistema de agentes de IA para operación logística. Varios agentes trabajan coordinados y una mesa de control permite supervisar lo que hacen.",
  },
  {
    q: "¿Reemplaza mi TMS / ERP?",
    a: "No. Se conecta a tu stack actual y automatiza tareas y excepciones alrededor de esos sistemas.",
  },
  {
    q: "¿El chofer necesita una app?",
    a: "No. La asistencia en ruta y la captura documental corren por WhatsApp. La mesa es para tráfico y operaciones.",
  },
  {
    q: "¿SOL decide solo?",
    a: "Automatiza lo rutinario y escala a un humano cuando hay excepción, duda o aprobación requerida.",
  },
  {
    q: "¿Cómo lo pruebo?",
    a: "Esta sala es una demo completa del backoffice (datos ficticios). Agendá una reunión para llevarlo a tu operación real.",
  },
];
