import { Card, SectionTitle, Pill, CritBadge } from "./ui";
import { RemitosPanel } from "./RemitosPanel";
import { DataTable, type Column } from "./DataTable";
import { EtaLine, ViajesArea, SlaBars, IncidenciasDonut } from "./Charts";
import {
  remitos,
  trips,
  incidencias,
  reclamos,
  rendiciones,
  etas,
  viajesPorDia,
  slaPorZona,
  incidenciasPorTipo,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  type Remito,
  type Incidencia,
  type Reclamo,
  type Rendicion,
  type EtaItem,
  type Trip,
} from "@/lib/data";

const money = (n: number) => "$" + n.toLocaleString("es-AR");

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

const destinosRows = [
  { id: "PD-9921", cliente: "Coca-Cola Andina", direccion: "Av. Mitre 2540, Avellaneda", estado: "Validado", correccion: "Sí", chofer: "M. Ojeda" },
  { id: "PD-9924", cliente: "Distribuidora del Sur", direccion: "Calle 50 N° 1240, La Plata", estado: "Validado", correccion: "No", chofer: "P. Cardozo" },
  { id: "PD-9927", cliente: "La Serenísima", direccion: "Ruta 8 km 60, Pilar", estado: "En revisión", correccion: "Sí", chofer: "—" },
  { id: "PD-9930", cliente: "Arcor S.A.", direccion: "Parque Ind. Ferreyra, Córdoba", estado: "Validado", correccion: "No", chofer: "C. Páez" },
  { id: "PD-9933", cliente: "Quilmes", direccion: "Av. Luro 3300, Mar del Plata", estado: "Pendiente", correccion: "—", chofer: "—" },
  { id: "PD-9938", cliente: "Mercado Libre Full", direccion: "Centro de distribución Pilar, módulo 4", estado: "Validado", correccion: "Sí", chofer: "M. Aguirre" },
  { id: "PD-9940", cliente: "Toyota Argentina", direccion: "Planta Zárate, acceso proveedores 2", estado: "Validado", correccion: "No", chofer: "F. Ledesma" },
  { id: "PD-9943", cliente: "Newsan", direccion: "Parque Industrial Posadas, nave 7", estado: "Validado", correccion: "Sí", chofer: "L. Cabrera" },
  { id: "PD-9948", cliente: "Sinteplast", direccion: "Ruta 3 km 695, Bahía Blanca", estado: "En revisión", correccion: "Sí", chofer: "R. Varela" },
  { id: "PD-9951", cliente: "Andreani Logística", direccion: "Av. Circunvalación 5800, Rosario", estado: "Validado", correccion: "No", chofer: "G. Leiva" },
  { id: "PD-9954", cliente: "Grupo Logístico Patagónico", direccion: "Puerto Comodoro, depósito fiscal 3", estado: "Pendiente", correccion: "—", chofer: "N. Peralta" },
];

export function AgentData({ slug }: { slug: string }) {
  if (slug === "remitos") {
    return <RemitosPanel />;
  }

  if (slug === "viajes") {
    const cols: Column<Trip>[] = [
      { key: "id", header: "Viaje", render: (t) => <span className="font-medium text-white">{t.id}</span> },
      { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
      { key: "ruta", header: "Ruta", render: (t) => <span className="text-[var(--text-dim)]">{t.origen} → {t.destino}</span> },
      { key: "carga", header: "Carga", className: "text-[var(--text-dim)]" },
      { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]" },
      { key: "patente", header: "Unidad", className: "text-[var(--text-dim)]" },
      {
        key: "estado",
        header: "Estado",
        render: (t) => (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ color: TRIP_STATUS_COLOR[t.estado], background: `${TRIP_STATUS_COLOR[t.estado]}1a` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TRIP_STATUS_COLOR[t.estado] }} />
            {TRIP_STATUS_LABEL[t.estado]}
          </span>
        ),
      },
    ];
    return (
      <Card>
        <SectionTitle>Viajes coordinados</SectionTitle>
        <DataTable columns={cols} rows={trips} minWidth={920} />
      </Card>
    );
  }

  if (slug === "destinos") {
    type D = (typeof destinosRows)[number];
    const cols: Column<D>[] = [
      { key: "id", header: "Pedido", render: (r) => <span className="font-medium text-white">{r.id}</span> },
      { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
      { key: "direccion", header: "Dirección", className: "text-[var(--text-dim)]" },
      { key: "correccion", header: "Corregido", render: (r) => <span className="text-[var(--text-dim)]">{r.correccion}</span> },
      { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]" },
      { key: "estado", header: "Estado", render: (r) => estadoPill(r.estado) },
    ];
    return (
      <Card>
        <SectionTitle>Destinos en validación</SectionTitle>
        <DataTable columns={cols} rows={destinosRows} minWidth={820} />
      </Card>
    );
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
    const cols: Column<Rendicion>[] = [
      { key: "id", header: "Rendición", render: (r) => <span className="font-medium text-white">{r.id}</span> },
      { key: "viaje", header: "Viaje", className: "text-[var(--text-dim)]" },
      { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]" },
      { key: "combustible", header: "Combustible", render: (r) => <span className="tabular text-[var(--text-dim)]">{money(r.combustible)}</span> },
      { key: "peajes", header: "Peajes", render: (r) => <span className="tabular text-[var(--text-dim)]">{money(r.peajes)}</span> },
      { key: "viaticos", header: "Viáticos", render: (r) => <span className="tabular text-[var(--text-dim)]">{money(r.viaticos)}</span> },
      {
        key: "total",
        header: "Total",
        render: (r) => (
          <span className="tabular font-medium text-white">
            {money(r.combustible + r.peajes + r.viaticos + r.otros)}
          </span>
        ),
      },
      { key: "comprobantes", header: "Comprob.", render: (r) => <span className="tabular text-[var(--text-dim)]">{r.comprobantes}</span> },
      { key: "estado", header: "Estado", render: (r) => estadoPill(r.estado) },
    ];
    return (
      <Card>
        <SectionTitle>Rendiciones de viajes</SectionTitle>
        <DataTable columns={cols} rows={rendiciones} minWidth={940} />
      </Card>
    );
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
