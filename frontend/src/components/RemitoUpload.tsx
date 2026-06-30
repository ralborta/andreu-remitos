"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isTenantSlug, REMITO_TENANTS, type TenantSlug } from "@/lib/tenants";
import { ingestRemito } from "@/lib/api";
import { Card, SectionTitle } from "./ui";

export function RemitoUpload() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTenant = searchParams.get("tenant");
  const [tenant, setTenant] = useState<TenantSlug>(
    initialTenant && isTenantSlug(initialTenant) ? initialTenant : "tsb",
  );
  const [telefono, setTelefono] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Elegí una foto");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await ingestRemito(file, tenant, telefono || undefined);
      router.push(`/remitos/${out.tenant}/${out.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <SectionTitle>Subir remito (solo pruebas)</SectionTitle>
      <p className="mb-4 text-sm text-[var(--text-dim)]">
        En producción los remitos llegan por <strong className="text-white">WhatsApp</strong> (BuilderBot → API).
        Usá esto solo para probar sin celular.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-[var(--text-faint)]">Cliente</span>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            value={tenant}
            onChange={(e) => setTenant(e.target.value as TenantSlug)}
          >
            {REMITO_TENANTS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-[var(--text-faint)]">Teléfono chofer (opcional)</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+54 9 …"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase text-[var(--text-faint)]">Foto del remito</span>
          <input
            type="file"
            accept="image/*"
            className="w-full text-sm text-[var(--text-dim)]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Procesando con Document AI…" : "Procesar remito"}
        </button>
      </form>
    </Card>
  );
}
