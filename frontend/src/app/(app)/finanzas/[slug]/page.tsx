import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ArrowLeftRight, ArrowLeft } from "lucide-react";
import { financeAgents, getFinanceAgent } from "@/lib/finance-agents";
import { AgentIcon } from "@/components/Icon";
import { PageHeader, StatusBadge, Card, SectionTitle, KpiCard, Pill } from "@/components/ui";
import { FlowSteps } from "@/components/FlowSteps";
import { FacturasFinanzasPanel } from "@/components/FacturasFinanzasPanel";
import { CobranzasFinanzasPanel } from "@/components/CobranzasFinanzasPanel";
import { ConciliacionFinanzasPanel } from "@/components/ConciliacionFinanzasPanel";
import { ComunicacionFinanzasPanel } from "@/components/ComunicacionFinanzasPanel";

export function generateStaticParams() {
  return financeAgents.map((a) => ({ slug: a.slug }));
}

export default async function FinanzasAgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getFinanceAgent(slug);
  if (!agent) notFound();

  const peers = (agent.collaboratesWith || [])
    .map((s) => getFinanceAgent(s))
    .filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.name}
        subtitle={agent.subtitle}
        icon={<AgentIcon name={agent.icon} size={24} />}
        badge={<StatusBadge status={agent.status} />}
        actions={
          <Link
            href="/finanzas"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] hover:text-white"
          >
            <ArrowLeft size={14} />
            Módulo de Finanzas
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {agent.kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} trend={k.trend} />
        ))}
      </div>

      {slug === "facturas" && <FacturasFinanzasPanel />}
      {slug === "cobranzas" && <CobranzasFinanzasPanel />}
      {slug === "conciliacion" && <ConciliacionFinanzasPanel />}
      {slug === "comunicacion" && <ComunicacionFinanzasPanel />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Qué hace</SectionTitle>
          <p className="text-[15px] leading-relaxed text-[var(--text-dim)]">{agent.what}</p>
        </Card>
        <Card>
          <SectionTitle>Beneficios</SectionTitle>
          <ul className="space-y-2.5">
            {agent.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--text)]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--green)]/15 text-[var(--green)]">
                  <Check size={13} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionTitle>Flujo del agente</SectionTitle>
        <FlowSteps steps={agent.flow} />
        {agent.channels.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Canales e integraciones
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agent.channels.map((c) => (
                <Pill key={c} color="#a78bfa">
                  {c}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </Card>

      {peers.length > 0 && (
        <Card>
          <SectionTitle
            right={
              <span className="flex items-center gap-1.5 text-xs text-[var(--violet-2)]">
                <ArrowLeftRight size={13} /> Agentes del módulo
              </span>
            }
          >
            Se comunica con
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {peers.map((p) => (
              <Link
                key={p.slug}
                href={`/finanzas/${p.slug}`}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:border-[var(--violet)]/50 hover:bg-[var(--violet)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--violet)]/20 text-[var(--violet-2)]">
                  <AgentIcon name={p.icon} size={14} />
                </span>
                {p.short}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
