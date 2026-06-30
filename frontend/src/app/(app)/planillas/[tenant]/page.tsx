import { notFound } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import { PlanillasPanel } from "@/components/PlanillasPanel";
import { getTenant, isTenantSlug } from "@/lib/tenants";

export function generateStaticParams() {
  return [{ tenant: "tsb" }, { tenant: "beraldi" }, { tenant: "corina" }];
}

export default async function PlanillasTenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!isTenantSlug(slug)) notFound();
  const tenant = getTenant(slug)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Planillas ${tenant.name}`}
        subtitle={`Generación y exportación de planillas ${tenant.short} — vista previa tipo Excel. La mesa de remitos sigue en Remitos ${tenant.short}.`}
        icon={<FileSpreadsheet size={24} />}
        badge={<Pill color={tenant.color}>{tenant.short}</Pill>}
      />
      <PlanillasPanel tenant={slug} />
    </div>
  );
}
