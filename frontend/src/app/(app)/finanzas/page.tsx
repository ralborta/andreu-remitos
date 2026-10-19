import Link from "next/link";
import { Wallet } from "lucide-react";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { AgentIcon } from "@/components/Icon";
import { financeAgents } from "@/lib/finance-agents";

export default function FinanzasHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo de Finanzas"
        subtitle="Cuatro agentes IA. Las a pagar se leen de PDF; las a cobrar se gestionan. Rendición de choferes no entra acá."
        icon={<Wallet size={24} />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {financeAgents.map((a) => (
          <Link key={a.slug} href={`/finanzas/${a.slug}`} className="block">
            <Card className="h-full transition-colors hover:border-[var(--violet)]/40">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--violet)]/15 text-[var(--violet-2)]">
                  <AgentIcon name={a.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-white">{a.name}</h2>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">{a.subtitle}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{a.what}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
