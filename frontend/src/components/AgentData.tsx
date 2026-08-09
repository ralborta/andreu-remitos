import { DestinosPanel } from "./DestinosPanel";
import { ViajesGestionPanel } from "./ViajesGestionPanel";
import { RendicionPanel } from "./RendicionPanel";
import { Card, SectionTitle, Pill, CritBadge } from "./ui";
import { RemitosPanel } from "./RemitosPanel";
import { DataTable, type Column } from "./DataTable";
import { EtaLine, ViajesArea, SlaBars, IncidenciasDonut } from "./Charts";
import {
  remitos,
  incidencias,
  reclamos,
  etas,
  viajesPorDia,
  slaPorZona,
  incidenciasPorTipo,
  type Remito,
  type Incidencia,
  type Reclamo,
  type EtaItem,
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
    const cols: Column<Incidencia>[] = [
      { key: "id", header: "Incidencia", render: (r) => <span className="font-medium text-white">{r.id}</span> },
      { key: "viaje", header: "Viaje", className: "text-[var(--text-dim)]" },
      { key: "tipo", header: "Tipo", className: "text-[var(--text-dim)]" },
      { key: "criticidad", header: "Criticidad", render: (r) => <CritBadge level={r.criticidad} /> },
      { key: "causa", header: "Causa declarada", className: "text-[var(--text-dim)] max-w-[280px]" },
      { key: "estado", header: "Estado", render: (r) => estadoPill(r.estado) },
      { key: "hora", header: "Hora", className: "tabular text-[var(--text-dim)]" },
    ];
    return (
      <Card>
        <SectionTitle>Incidencias del día</SectionTitle>
        <DataTable columns={cols} rows={incidencias} minWidth={900} />
      </Card>
    );
  }

  if (slug === "rendicion") {
    return <RendicionPanel />;
  }

  if (slug === "eta") {
    const cols: Column<EtaItem>[] = [
      { key: "viaje", header: "Viaje", render: (r) => <span className="font-medium text-white">{r.viaje}</span> },
      { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
      { key: "destino", header: "Destino", className: "text-[var(--text-dim)]" },
      { key: "eta", header: "ETA", className: "tabular text-white" },
      { key: "ventana", header: "Ventana", className: "tabular text-[var(--text-dim)]" },
      { key: "estado", header: "Estado", render: (r) => estadoPill(r.estado) },
      {
        key: "notificado",
        header: "Notificado",
        render: (r) =>
          r.notificado ? (
            <Pill color="#22c55e">Sí</Pill>
          ) : (
            <Pill color="#a79fc9">Pendiente</Pill>
          ),
      },
    ];
    return (
      <div className="space-y-6">
        <Card>
          <SectionTitle>Precisión de ETA (hoy)</SectionTitle>
          <EtaLine data={[
            { h: "06h", precision: 88 },
            { h: "08h", precision: 90 },
            { h: "10h", precision: 92 },
            { h: "12h", precision: 91 },
            { h: "14h", precision: 93 },
            { h: "16h", precision: 90 },
            { h: "18h", precision: 92 },
          ]} />
        </Card>
        <Card>
          <SectionTitle>Próximas llegadas</SectionTitle>
          <DataTable columns={cols} rows={etas} minWidth={840} />
        </Card>
      </div>
    );
  }

  if (slug === "reclamos") {
    const cols: Column<Reclamo>[] = [
      { key: "id", header: "Reclamo", render: (r) => <span className="font-medium text-white">{r.id}</span> },
      { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
      { key: "viaje", header: "Viaje", className: "text-[var(--text-dim)]" },
      { key: "motivo", header: "Motivo", className: "text-[var(--text-dim)]" },
      { key: "canal", header: "Canal", render: (r) => <Pill color={r.canal === "WhatsApp" ? "#25d366" : r.canal === "Email" ? "#38bdf8" : "#a78bfa"}>{r.canal}</Pill> },
      { key: "criticidad", header: "Criticidad", render: (r) => <CritBadge level={r.criticidad} /> },
      { key: "estado", header: "Estado", render: (r) => estadoPill(r.estado) },
      { key: "sla", header: "SLA", render: (r) => <span className={r.sla === "Por vencer" ? "text-[var(--amber)]" : "text-[var(--text-dim)]"}>{r.sla}</span> },
    ];
    return (
      <Card>
        <SectionTitle>Reclamos en gestión</SectionTitle>
        <DataTable columns={cols} rows={reclamos} minWidth={920} />
      </Card>
    );
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
