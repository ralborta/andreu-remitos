import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { RemitoUpload } from "@/components/RemitoUpload";
import { Upload } from "lucide-react";

export default function SubirPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subir remito"
        subtitle="Foto → Document AI → validación de horarios"
        icon={<Upload size={24} />}
      />
      <Suspense fallback={<p className="text-sm text-[var(--text-dim)]">Cargando…</p>}>
        <RemitoUpload />
      </Suspense>
    </div>
  );
}
