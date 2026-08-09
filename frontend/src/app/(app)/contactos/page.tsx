import { Suspense } from "react";
import { ContactosInbox } from "@/components/ContactosInbox";

export default function ContactosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-dim)]">Cargando…</p>}>
      <ContactosInbox />
    </Suspense>
  );
}
