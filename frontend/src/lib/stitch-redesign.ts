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
  "/agentes/rendicion": { src: "/stitch/redesign/rendicion.html", title: "Rendición" },
};

export function stitchRedesignFor(pathname: string) {
  return STITCH_REDESIGN[pathname] ?? null;
}

export function isStitchRedesignPath(pathname: string) {
  return Boolean(STITCH_REDESIGN[pathname]);
}
