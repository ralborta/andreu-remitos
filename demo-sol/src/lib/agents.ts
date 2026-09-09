export type DemoAgent = {
  slug: string;
  name: string;
  short: string;
  blurb: string;
};

/** Los 10 especialistas (Kernel aparte). */
export const DEMO_AGENTS: DemoAgent[] = [
  {
    slug: "viajes",
    name: "Gestión de Viajes",
    short: "Viajes",
    blurb: "Pedidos, asignación de flota/chofer y carga en el TMS.",
  },
  {
    slug: "tracking",
    name: "Tracking Express",
    short: "Tracking",
    blurb: "Seguimiento del viaje por link WhatsApp (sin instalar app).",
  },
  {
    slug: "remitos",
    name: "Remitos",
    short: "Remitos",
    blurb: "Foto del remito → lectura IA → listo para backoffice/TMS.",
  },
  {
    slug: "destinos",
    name: "Destinos",
    short: "Destinos",
    blurb: "Valida direcciones, confirma con el cliente y manda el punto al chofer.",
  },
  {
    slug: "incidencias",
    name: "Incidencias",
    short: "Incidencias",
    blurb: "Paradas y eventos en ruta: clasifica la causa y abre el caso.",
  },
  {
    slug: "rendicion",
    name: "Rendición",
    short: "Rendición",
    blurb: "Gastos y comprobantes por WhatsApp, con aprobación humana.",
  },
  {
    slug: "eta",
    name: "ETA",
    short: "ETA",
    blurb: "Estima llegada y avisa demoras o cambios.",
  },
  {
    slug: "pod",
    name: "POP/POD",
    short: "Evidencias",
    blurb: "Prueba de retiro y entrega; compara origen vs destino.",
  },
  {
    slug: "reclamos",
    name: "Reclamos",
    short: "Reclamos",
    blurb: "Reclamos por WhatsApp, clasificación y ticket trazable.",
  },
  {
    slug: "analitica",
    name: "Analítica",
    short: "Analítica",
    blurb: "KPIs, patrones y alertas a partir de toda la operación.",
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
