"use client";

import { ModuleWithChat } from "@/components/ModuleWithChat";
import { RemitosPanel } from "@/components/RemitosPanel";
import type { TenantSlug } from "@/lib/tenants";

/** Remitos de un tenant + chat del agente (mismo patrón que /agentes/remitos). */
export function RemitosTenantWithChat({ tenant }: { tenant: TenantSlug }) {
  return (
    <ModuleWithChat
      agentId="remitos"
      agentLabel="Remitos"
      suggestions={[
        "¿cuántos remitos tenemos?",
        "¿cuántos están confirmados?",
        "mostrame los últimos 10",
        "¿cuántos se cargaron hoy?",
      ]}
      guideSections={[
        {
          title: "Conteos",
          items: ["¿Cuántos remitos hay?", "¿Cuántos confirmados / pendientes?", "¿Cuántos hoy?"],
        },
        {
          title: "Listados",
          items: ["Mostrame los últimos 10", "Filtrá por tenant o destino"],
        },
        {
          title: "Detalle",
          items: ["¿Qué datos tiene este remito? (pasá el id)"],
        },
      ]}
      emptyHint="Consulto remitos ya persistidos (solo lectura, sin OCR)."
    >
      <RemitosPanel tenant={tenant} />
    </ModuleWithChat>
  );
}
