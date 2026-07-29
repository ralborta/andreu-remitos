import { notFound } from "next/navigation";
import { Check, Radio } from "lucide-react";
import { agents, getAgent } from "@/lib/agents";
import { conversationsFor } from "@/lib/data";
import { AgentIcon } from "@/components/Icon";
import { PageHeader, StatusBadge, Card, SectionTitle, KpiCard, Pill } from "@/components/ui";
import { FlowSteps } from "@/components/FlowSteps";
import { WhatsAppChat } from "@/components/WhatsAppChat";
import { AgentData } from "@/components/AgentData";

export function generateStaticParams() {
  return agents.map((a) => ({ slug: a.slug }));
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const convos = conversationsFor(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.name}
        subtitle={agent.subtitle}
        icon={<AgentIcon name={agent.icon} size={24} />}
        badge={<StatusBadge status={agent.status} />}
        actions={
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            {agent.channels.map((c) => (
              <Pill key={c} color="#a78bfa">
                {c}
              </Pill>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {agent.kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} trend={k.trend} />
        ))}
      </div>

      {/* Qué hace + Beneficios */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            right={
              <span className="flex items-center gap-1.5 text-xs text-[var(--green)]">
                <Radio size={13} /> Agente activo
              </span>
            }
          >
            Qué hace
          </SectionTitle>
          <p className="text-[15px] leading-relaxed text-[var(--text-dim)]">
            {agent.what}
          </p>
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

      {/* Flujo operativo */}
      <Card>
        <SectionTitle>Flujo operativo</SectionTitle>
        <FlowSteps steps={agent.flow} />
      </Card>

      {/* Datos + Conversación (remitos usa tabla+foto a ancho completo) */}
      {slug === "remitos" || slug === "destinos" ? (
        <div className="min-w-0">
          <AgentData slug={slug} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <AgentData slug={slug} />
          </div>
          <div className="min-w-0 space-y-4">
            <SectionTitle>
              {convos[0]?.channel === "Email" ? "Bandeja del agente" : "Conversación del agente"}
            </SectionTitle>
            {convos.length > 0 ? (
              convos.map((c) => <WhatsAppChat key={c.id} conversation={c} />)
            ) : (
              <Card>
                <p className="text-sm text-[var(--text-dim)]">
                  Sin conversaciones activas en este momento.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
