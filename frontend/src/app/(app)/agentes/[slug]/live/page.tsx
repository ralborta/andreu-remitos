import { notFound } from "next/navigation";
import { getAgent } from "@/lib/agents";
import { AgentIcon } from "@/components/Icon";
import { PageHeader, StatusBadge } from "@/components/ui";
import { AgentData } from "@/components/AgentData";

export default async function AgentLivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={agent.name}
        subtitle={agent.subtitle}
        icon={<AgentIcon name={agent.icon} size={24} />}
        badge={<StatusBadge status={agent.status} />}
      />
      <AgentData slug={slug} />
    </div>
  );
}
