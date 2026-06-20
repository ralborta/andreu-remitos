import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RemitoReview } from "@/components/RemitoReview";
import { getTenant, isTenantSlug } from "@/lib/tenants";

export default async function RemitoDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  if (!isTenantSlug(slug)) notFound();
  const tenant = getTenant(slug)!;

  return (
    <div className="space-y-6">
      <Link
        href={`/remitos/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-dim)] hover:text-white"
      >
        <ChevronLeft size={16} /> Volver a {tenant.name}
      </Link>
      <RemitoReview id={id} tenantSlug={slug} />
    </div>
  );
}
