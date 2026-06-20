import { Database } from "lucide-react";
import { PageHeader, Card, SectionTitle, KpiCard } from "@/components/ui";
import { ViajesArea, SlaBars, IncidenciasDonut } from "@/components/Charts";
import { AgentData } from "@/components/AgentData";
import { viajesPorDia, slaPorZona, incidenciasPorTipo } from "@/lib/data";

const categorias = [
  {
    titulo: "Estados de viaje",
    valor: "26",
    sub: "en gestión",
    chips: ["pendiente", "en curso", "detenido", "entregado", "cerrado"],
  },
  {
    titulo: "Documentación",
    valor: "412",
    sub: "remitos hoy",
    chips: ["recibidos", "legibilidad", "diferencias", "faltantes"],
  },
  {
    titulo: "Incidencias",
    valor: "52",
    sub: "eventos",
    chips: ["paradas", "desvíos", "demoras", "criticidad", "causa"],
  },
  {
    titulo: "Rendición",
    valor: "486",
    sub: "del mes",
    chips: ["gastos", "comprobantes", "aprobación", "liquidación"],
  },
  {
    titulo: "Experiencia",
    valor: "618",
    sub: "notificaciones",
    chips: ["reclamos", "respuesta", "resolución"],
  },
  {
    titulo: "Performance",
    valor: "95,1%",
    sub: "SLA",
    chips: ["cumplimiento", "productividad", "alertas", "reportes"],
  },
];

export default function BackofficePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Backoffice y métricas operativas"
        subtitle="Cada agente deja evidencia, estados y datos medibles para la operación"
        icon={<Database size={24} />}
      />

      {/* categorías */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((c) => (
          <div key={c.titulo} className="panel panel-hover p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-[var(--violet-2)]">{c.titulo}</h3>
              <span className="tabular font-[var(--font-display)] text-xl font-bold text-white">
                {c.valor}
                <span className="ml-1 text-xs font-normal text-[var(--text-faint)]">
                  {c.sub}
                </span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-[var(--text-dim)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Productividad operativa" value="+41%" trend="+41%" hint="vs. base manual" />
        <KpiCard label="Carga manual evitada" value="-68%" trend="-68%" />
        <KpiCard label="Tiempo de resolución" value="5,8 h" trend="-42%" />
        <KpiCard label="Cumplimiento documental" value="98,7%" trend="+4,6%" />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Viajes por día</SectionTitle>
          <ViajesArea data={viajesPorDia} />
        </Card>
        <Card>
          <SectionTitle>SLA por zona</SectionTitle>
          <SlaBars data={slaPorZona} />
        </Card>
        <Card>
          <SectionTitle>Incidencias por tipo</SectionTitle>
          <IncidenciasDonut data={incidenciasPorTipo} />
        </Card>
      </div>

      {/* tablas consolidadas */}
      <AgentData slug="viajes" />
      <AgentData slug="incidencias" />
      <AgentData slug="reclamos" />
    </div>
  );
}
