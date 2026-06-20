import Link from "next/link";
import {
  Activity,
  Truck,
  PackageCheck,
  FileText,
  TriangleAlert,
  Gauge,
  ChevronRight,
} from "lucide-react";
import { PageHeader, Card, SectionTitle, StatusBadge } from "@/components/ui";
import { FleetMap } from "@/components/FleetMap";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ViajesArea, IncidenciasDonut, SlaBars } from "@/components/Charts";
import { LiveCounter } from "@/components/LiveCounter";
import { AgentIcon } from "@/components/Icon";
import {
  trips,
  incidencias,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  viajesPorDia,
  incidenciasPorTipo,
  slaPorZona,
} from "@/lib/data";
import { agents } from "@/lib/agents";

export default function DashboardPage() {
  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const incidenciasAbiertas = incidencias.filter((i) => i.estado !== "Resuelta").length;
  const incidenciasAltas = incidencias.filter(
    (i) => i.estado !== "Resuelta" && i.criticidad === "Alta",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Torre de Control"
        subtitle="Operación logística en tiempo real · agentes, flota, documentación y SLA"
        icon={<Activity size={24} />}
        actions={
          <div className="hidden items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1.5 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
            </span>
            <span className="text-xs font-semibold text-[var(--green)]">
              8 agentes en línea
            </span>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="panel panel-hover p-4">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-[var(--text-dim)]">Viajes activos</p>
            <Truck size={16} className="text-[var(--text-faint)]" />
          </div>
          <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
            {activos}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-faint)]">de {trips.length} en gestión</p>
        </div>

        <div className="panel panel-hover p-4">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-[var(--text-dim)]">Entregas hoy</p>
            <PackageCheck size={16} className="text-[var(--text-faint)]" />
          </div>
          <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
            <LiveCounter start={241} stepMax={2} intervalMs={8000} />
          </p>
          <p className="mt-1.5 text-xs text-[var(--green)]">+16% vs. ayer</p>
        </div>

        <div className="panel panel-hover p-4">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-[var(--text-dim)]">Remitos procesados</p>
            <FileText size={16} className="text-[var(--text-faint)]" />
          </div>
          <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
            <LiveCounter start={412} stepMax={3} intervalMs={5000} />
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-faint)]">97,1% lectura auto</p>
        </div>

        <div className="panel panel-hover p-4">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-[var(--text-dim)]">SLA de entrega</p>
            <Gauge size={16} className="text-[var(--text-faint)]" />
          </div>
          <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
            94,2%
          </p>
          <p className="mt-1.5 text-xs text-[var(--green)]">+2,4 pts</p>
        </div>

        <div className="panel panel-hover col-span-2 p-4 lg:col-span-1">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-[var(--text-dim)]">Incidencias abiertas</p>
            <TriangleAlert size={16} className="text-[var(--text-faint)]" />
          </div>
          <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
            {incidenciasAbiertas}
          </p>
          <p className="mt-1.5 text-xs text-[var(--amber)]">
            {incidenciasAltas} de criticidad alta
          </p>
        </div>
      </div>

      {/* Mapa + Actividad */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle>Flota en tiempo real</SectionTitle>
          <FleetMap />
        </Card>

        <Card>
          <SectionTitle
            right={
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                <span className="relative flex h-2 w-2">
                  <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                </span>
                En vivo
              </span>
            }
          >
            Actividad de agentes
          </SectionTitle>
          <div className="-mx-2 max-h-[460px] overflow-y-auto scroll-thin">
            <ActivityFeed />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Viajes por día</SectionTitle>
          <ViajesArea data={viajesPorDia} />
        </Card>
        <Card>
          <SectionTitle>Incidencias por tipo</SectionTitle>
          <IncidenciasDonut data={incidenciasPorTipo} />
        </Card>
        <Card>
          <SectionTitle>SLA por zona</SectionTitle>
          <SlaBars data={slaPorZona} />
        </Card>
      </div>

      {/* Viajes en curso */}
      <Card>
        <SectionTitle
          right={
            <Link
              href="/backoffice"
              className="text-xs font-medium text-[var(--violet-2)] hover:underline"
            >
              Ver todos
            </Link>
          }
        >
          Viajes en gestión
        </SectionTitle>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-3 py-2 font-medium">Viaje</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Ruta</th>
                <th className="px-3 py-2 font-medium">Chofer</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Avance</th>
                <th className="px-3 py-2 font-medium">ETA</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-[var(--border-soft)] transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-3 font-medium text-white">{t.id}</td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">{t.cliente}</td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">
                    {t.origen} → {t.destino}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">{t.chofer}</td>
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: TRIP_STATUS_COLOR[t.estado],
                        background: `${TRIP_STATUS_COLOR[t.estado]}1a`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: TRIP_STATUS_COLOR[t.estado] }}
                      />
                      {TRIP_STATUS_LABEL[t.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${t.progreso}%`,
                            background:
                              "linear-gradient(90deg,#8b5cf6,#d946ef)",
                          }}
                        />
                      </div>
                      <span className="tabular text-xs text-[var(--text-faint)]">
                        {t.progreso}%
                      </span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-3 text-[var(--text-dim)]">{t.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Agentes */}
      <div>
        <SectionTitle>Agentes de la suite</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((a) => (
            <Link
              key={a.slug}
              href={`/agentes/${a.slug}`}
              className="panel panel-hover group flex flex-col p-4"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--violet)]/15 text-[var(--violet-2)]">
                  <AgentIcon name={a.icon} size={18} />
                </span>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-3 font-semibold text-white">{a.name}</p>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-[var(--text-dim)]">
                {a.subtitle}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--violet-2)] opacity-0 transition-opacity group-hover:opacity-100">
                Abrir agente <ChevronRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
