/** HTML literal del proyecto Stitch «Empliados Logistics Platform Redesign». */
export const STITCH_REDESIGN: Record<string, { src: string; title: string }> = {
  "/": { src: "/stitch/redesign/torre.html", title: "Torre de Control" },
  "/monitor": { src: "/stitch/redesign/monitor.html", title: "Monitor de servicios" },
  "/contactos": { src: "/stitch/redesign/whatsapp.html", title: "WhatsApp" },
  "/backoffice": { src: "/stitch/redesign/metricas.html", title: "Métricas" },
  "/agentes/viajes": { src: "/stitch/redesign/viajes.html", title: "Gestión de Viajes" },
  "/agentes/tracking": { src: "/stitch/redesign/tracking.html", title: "Tracking Express" },
  "/agentes/remitos": { src: "/stitch/redesign/remitos.html", title: "Remitos" },
  "/agentes/destinos": { src: "/stitch/redesign/destinos.html", title: "Destinos" },
  "/agentes/incidencias": { src: "/stitch/redesign/incidencias.html", title: "Incidencias" },
  "/agentes/eta": { src: "/stitch/redesign/eta.html", title: "ETA" },
  "/agentes/rendicion": { src: "/stitch/redesign/rendicion.html", title: "Rendición" },
  "/agentes/pod": { src: "/stitch/redesign/pod.html", title: "POP/POD" },
  "/agentes/reclamos": { src: "/stitch/redesign/reclamos.html", title: "Reclamos" },
  "/agentes/analitica": { src: "/stitch/redesign/analitica.html", title: "Analítica" },
  "/finanzas": { src: "/stitch/redesign/finanzas.html", title: "Finanzas" },
  "/finanzas/clientes": { src: "/stitch/redesign/finanzas-clientes.html", title: "Finanzas · Clientes" },
  "/finanzas/facturas/pagos": { src: "/stitch/redesign/finanzas-facturas.html", title: "Finanzas · Facturas de pago (CxP)" },
  "/finanzas/facturas/cobro": { src: "/stitch/redesign/finanzas-facturas-cobro.html", title: "Finanzas · Facturas de cobranza (CxC)" },
  "/finanzas/facturas/cobranzas": { src: "/stitch/redesign/finanzas-cobranza.html", title: "Finanzas · Gestión de cobranza" },
  "/finanzas/conciliacion": { src: "/stitch/redesign/finanzas-conciliacion.html", title: "Finanzas · Conciliación" },
  "/finanzas/comunicacion": { src: "/stitch/redesign/finanzas-comunicacion.html", title: "Finanzas · Enviar mensaje" },
  "/marketing": { src: "/stitch/redesign/marketing.html", title: "Marketing" },
  "/marketing/estrategia": { src: "/stitch/redesign/marketing-estrategia.html", title: "Marketing · Planificador" },
  "/marketing/email": { src: "/stitch/redesign/marketing-email.html", title: "Marketing · Email" },
  "/marketing/contenidos": { src: "/stitch/redesign/marketing-contenidos.html", title: "Marketing · Contenidos" },
  "/marketing/ofertas": { src: "/stitch/redesign/marketing-ofertas.html", title: "Marketing · Promociones" },
  "/marketing/visibilidad": { src: "/stitch/redesign/marketing-visibilidad.html", title: "Marketing · Rankear" },
  "/marketing/difusion": { src: "/stitch/redesign/marketing-difusion.html", title: "Marketing · Menciones" },
  "/marketing/resultados": { src: "/stitch/redesign/marketing-resultados.html", title: "Marketing · Analítica" },
};

export function stitchRedesignFor(pathname: string) {
  return STITCH_REDESIGN[pathname] ?? null;
}

export function isStitchRedesignPath(pathname: string) {
  return Boolean(STITCH_REDESIGN[pathname]);
}
