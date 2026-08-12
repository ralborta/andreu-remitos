"use client";

import { DestinosPanel } from "./DestinosPanel";
import { ViajesGestionPanel } from "./ViajesGestionPanel";
import { RendicionPanel } from "./RendicionPanel";
import { ReclamosPanel } from "./ReclamosPanel";
import { IncidenciasPanel } from "./IncidenciasPanel";
import { EtaPanel } from "./EtaPanel";
import { PodModuleWithChat } from "./PodModuleWithChat";
import { ModuleWithChat } from "./ModuleWithChat";
import { Card, SectionTitle } from "./ui";
import { RemitosPanel } from "./RemitosPanel";
import { ViajesArea, SlaBars, IncidenciasDonut } from "./Charts";
import { viajesPorDia, slaPorZona, incidenciasPorTipo } from "@/lib/data";

export function AgentData({ slug }: { slug: string }) {
  if (slug === "remitos") {
    return (
      <ModuleWithChat
        agentId="remitos"
        agentLabel="Remitos"
        suggestions={[
          "¿cuántos remitos tenemos?",
          "¿cuántos están confirmados?",
          "mostrame los últimos 10",
          "¿cuántos se cargaron hoy?",
        ]}
        guideSections={[
          {
            title: "Conteos",
            items: ["¿Cuántos remitos hay?", "¿Cuántos confirmados / pendientes?", "¿Cuántos hoy?"],
          },
          {
            title: "Listados",
            items: ["Mostrame los últimos 10", "Filtrá por tenant o destino"],
          },
          {
            title: "Detalle",
            items: ["¿Qué datos tiene este remito? (pasá el id)"],
          },
        ]}
        emptyHint="Consulto remitos ya persistidos (solo lectura, sin OCR)."
      >
        <RemitosPanel />
      </ModuleWithChat>
    );
  }

  if (slug === "viajes") {
    return (
      <ModuleWithChat
        agentId="viajes"
        agentLabel="Viajes"
        suggestions={[
          "¿cuántos viajes tenemos?",
          "¿cuántos están activos?",
          "¿cuáles van a Córdoba?",
          "mostrame los últimos 10",
        ]}
        guideSections={[
          {
            title: "Conteos",
            items: ["¿Cuántos viajes hay?", "¿Cuántos activos?", "¿Cuántos creados hoy?"],
          },
          {
            title: "Listados",
            items: ["¿Cuáles son?", "¿Qué viajes van a Córdoba?", "Últimos N"],
          },
          {
            title: "Detalle",
            items: ["¿Qué chofer / tractor tiene este viaje?", "Seguimiento: ¿y de esos…?"],
          },
        ]}
        emptyHint="Consulto viajes reales. Demoras se ven en ETA/Incidencias (no hay estado demorado aquí)."
      >
        <ViajesGestionPanel />
      </ModuleWithChat>
    );
  }

  if (slug === "destinos") {
    return <DestinosPanel />;
  }

  if (slug === "incidencias") {
    return (
      <ModuleWithChat
        agentId="incidencias"
        agentLabel="Incidencias"
        suggestions={[
          "¿cuántas incidencias abiertas hay?",
          "¿cuáles son demoras?",
          "mostrame las recientes",
          "¿cuántas se crearon hoy?",
        ]}
        guideSections={[
          {
            title: "Conteos",
            items: ["Abiertas / resueltas", "Demoras abiertas", "Creadas hoy"],
          },
          {
            title: "Listados",
            items: ["Por tipo", "Por viaje", "Por chofer"],
          },
          {
            title: "Detalle",
            items: ["Causa / estado de una incidencia", "Follow-ups sobre el set anterior"],
          },
        ]}
      >
        <IncidenciasPanel />
      </ModuleWithChat>
    );
  }

  if (slug === "rendicion") {
    return (
      <ModuleWithChat
        agentId="rendicion"
        agentLabel="Rendición"
        suggestions={[
          "¿cuántos gastos pendientes hay?",
          "¿cuál es el monto pendiente?",
          "mostrame los últimos gastos",
          "¿cuántos se cargaron hoy?",
        ]}
        guideSections={[
          {
            title: "Conteos y montos",
            items: ["Pendientes / aprobados / rechazados", "Montos del resumen"],
          },
          {
            title: "Listados",
            items: ["Por chofer", "Por viaje", "Últimos registros"],
          },
        ]}
      >
        <RendicionPanel />
      </ModuleWithChat>
    );
  }

  if (slug === "eta") {
    return (
      <ModuleWithChat
        agentId="eta"
        agentLabel="ETA"
        suggestions={[
          "¿cómo está la cola ETA?",
          "¿cuántas demoras abiertas hay?",
          "mostrame la cola",
          "¿cuántos esperan ETA del chofer?",
        ]}
        guideSections={[
          {
            title: "Resumen",
            items: ["Cola ETA", "Demoras abiertas", "Notificaciones hoy"],
          },
          {
            title: "Cola",
            items: ["Ítems en ruta", "Solo demoras", "Por destino / viaje"],
          },
        ]}
        emptyHint="Consulto cola ETA y demoras reales (ETA/Incidencias)."
      >
        <EtaPanel />
      </ModuleWithChat>
    );
  }

  if (slug === "pod") {
    return <PodModuleWithChat />;
  }

  if (slug === "reclamos") {
    return <ReclamosPanel />;
  }

  if (slug === "analitica") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle>Viajes y entregas (7 días)</SectionTitle>
            <ViajesArea data={viajesPorDia} />
          </Card>
          <Card>
            <SectionTitle>SLA por zona</SectionTitle>
            <SlaBars data={slaPorZona} />
          </Card>
        </div>
        <Card>
          <SectionTitle>Incidencias por tipo</SectionTitle>
          <div className="mx-auto max-w-md">
            <IncidenciasDonut data={incidenciasPorTipo} />
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
