import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import { getTenant, isTenantSlug } from "@/lib/tenants";
import { RemitosPanel } from "@/components/RemitosPanel";

export function generateStaticParams() {
  return [{ tenant: "tsb" }, { tenant: "beraldi" }];
}

export default async function RemitosTenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  if (!isTenantSlug(slug)) notFound();
  const tenant = getTenant(slug)!;

  return (
    <div className="space-y-6">
      <Link
        href="/remitos"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-dim)] hover:text-white"
      >
        <ChevronLeft size={16} /> Todos los remitos
      </Link>
      <PageHeader
        title={`Remitos ${tenant.name}`}
        subtitle={tenant.description}
        icon={<FileText size={24} />}
        badge={<Pill color={tenant.color}>{tenant.short}</Pill>}
      />
      <RemitosPanel tenant={slug} />
    </div>
  );
}
