import { DestinosPanel } from "./DestinosPanel";
import { ViajesGestionPanel } from "./ViajesGestionPanel";
import { RendicionPanel } from "./RendicionPanel";
import { ReclamosPanel } from "./ReclamosPanel";
import { IncidenciasPanel } from "./IncidenciasPanel";
import { EtaPanel } from "./EtaPanel";
import { Card, SectionTitle, Pill, CritBadge } from "./ui";
import { RemitosPanel } from "./RemitosPanel";
import { DataTable, type Column } from "./DataTable";
import { ViajesArea, SlaBars, IncidenciasDonut } from "./Charts";
import {
  viajesPorDia,
  slaPorZona,
  incidenciasPorTipo,
} from "@/lib/data";

function estadoPill(estado: string) {
  const map: Record<string, string> = {
    Validado: "#22c55e",
    Leído: "#38bdf8",
    "En revisión": "#f59e0b",
    Pendiente: "#a79fc9",
    Aprobada: "#22c55e",
    Liquidada: "#a78bfa",
    "En aprobación": "#f59e0b",
    Borrador: "#a79fc9",
    Resuelto: "#22c55e",
    Resuelta: "#22c55e",
    "En proceso": "#38bdf8",
    "En gestión": "#38bdf8",
    Escalado: "#f59e0b",
    Nuevo: "#d946ef",
    Abierta: "#ef4444",
    "En horario": "#22c55e",
    "Demora leve": "#f59e0b",
    Demora: "#ef4444",
    Adelantado: "#38bdf8",
  };
  return <Pill color={map[estado] ?? "#a79fc9"}>{estado}</Pill>;
}

function ConfBar({ v }: { v: number }) {
  if (v === 0) return <span className="text-xs text-[var(--text-faint)]">—</span>;
  const color = v >= 90 ? "#22c55e" : v >= 80 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="tabular text-xs text-[var(--text-dim)]">{v}%</span>
    </div>
  );
}

export function AgentData({ slug }: { slug: string }) {
  if (slug === "remitos") {
    return <RemitosPanel />;
  }

  if (slug === "viajes") {
    return <ViajesGestionPanel />;
  }

  if (slug === "destinos") {
    return <DestinosPanel />;
  }

  if (slug === "incidencias") {
    return <IncidenciasPanel />;
  }

  if (slug === "rendicion") {
    return <RendicionPanel />;
  }

  if (slug === "eta") {
    return <EtaPanel />;
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
