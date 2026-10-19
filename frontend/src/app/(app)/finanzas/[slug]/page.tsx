import { notFound } from "next/navigation";
import { financeAgents, getFinanceAgent } from "@/lib/finance-agents";
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
  if (!getFinanceAgent(slug)) notFound();

  if (slug === "facturas") return <FacturasFinanzasPanel />;
  if (slug === "cobranzas") return <CobranzasFinanzasPanel />;
  if (slug === "conciliacion") return <ConciliacionFinanzasPanel />;
  if (slug === "comunicacion") return <ComunicacionFinanzasPanel />;
  notFound();
}
