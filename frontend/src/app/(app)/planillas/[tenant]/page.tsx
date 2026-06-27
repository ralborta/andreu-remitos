import { notFound } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import { PlanillasTsbPanel } from "@/components/PlanillasTsbPanel";
import { getTenant, isTenantSlug } from "@/lib/tenants";

export function generateStaticParams() {
  return [{ tenant: "tsb" }];
}

export default async function PlanillasTenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!isTenantSlug(slug) || slug !== "tsb") notFound();
  const tenant = getTenant(slug)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Planillas ${tenant.name}`}
        subtitle="Generación y exportación de planillas — vista previa tipo Excel. Operación de remitos sigue en Remitos TSB."
        icon={<FileSpreadsheet size={24} />}
        badge={<Pill color={tenant.color}>{tenant.short}</Pill>}
      />
      <PlanillasTsbPanel />
    </div>
  );
}
