import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { PageHeader, Card, SectionTitle, Pill } from "@/components/ui";
import { REMITO_TENANTS } from "@/lib/tenants";
import { RemitosResumen } from "@/components/RemitosResumen";

export default function RemitosHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Remitos"
        subtitle="Elegí cliente — los choferes mandan fotos por WhatsApp; acá revisás y corregís"
        icon={<FileText size={24} />}
      />

      <RemitosResumen />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REMITO_TENANTS.filter((t) => t.active).map((t) => (
          <Link key={t.slug} href={`/remitos/${t.slug}`}>
            <Card className="group transition-colors hover:bg-white/[0.07]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Pill color={t.color}>{t.short}</Pill>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">{t.description}</p>
                  <p className="mt-2 text-xs text-[var(--text-faint)]">WhatsApp: {t.whatsappHint}</p>
                </div>
                <ChevronRight
                  size={20}
                  className="shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <SectionTitle>Próximos clientes</SectionTitle>
        <p className="text-sm text-[var(--text-dim)]">
          Cuando sumemos otro transporte, aparece acá como sub-opción (mismo flujo: WhatsApp → OCR → revisión).
        </p>
      </Card>
    </div>
  );
}
