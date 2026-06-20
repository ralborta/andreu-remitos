"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRemito, imagenUrl, patchRemitoCampos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import { conductorNombre, destinoNombre, estadoColor, estadoLabel, numeroRemito, tenantLabel } from "@/lib/remitos-ui";
import { Card, Pill, SectionTitle } from "./ui";

const CAMPOS_TSB = [
  "nro_guia",
  "conductor",
  "destino",
  "procedencia",
  "chasis",
  "acoplado",
  "peso_kg",
  "malla",
  "remito_cliente",
  "nro_interno",
] as const;

const CAMPOS_BERALDI = [
  "nro_remito",
  "chofer",
  "destino",
  "origen",
  "patente_chasis",
  "patente_acoplado",
  "peso_kg",
] as const;

export function RemitoReview({ id, tenantSlug: _tenantSlug }: { id: string; tenantSlug?: string }) {
  const router = useRouter();
  const [row, setRow] = useState<RemitoRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getRemito(id)
      .then((r) => {
        setRow(r);
        const d = r.datos as Record<string, unknown>;
        const campos = r.tenant === "tsb" ? CAMPOS_TSB : CAMPOS_BERALDI;
        const initial: Record<string, string> = {};
        for (const k of campos) {
          if (d[k] != null) initial[k] = String(d[k]);
        }
        setForm(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function guardar() {
    if (!row) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        body[k] = k === "peso_kg" ? (v ? Number(v) : null) : v || null;
      }
      const updated = await patchRemitoCampos(id, body);
      setRow(updated);
      setMsg(updated.estado === "confirmado" ? "Guardado — remito validado" : "Guardado — revisar horarios");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-dim)]">Cargando remito…</p>;
  if (error && !row) return <p className="text-sm text-[var(--red)]">{error}</p>;
  if (!row) return null;

  const campos = row.tenant === "tsb" ? CAMPOS_TSB : CAMPOS_BERALDI;
  const validacion = row.validacion;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <SectionTitle>Imagen del remito</SectionTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenUrl(id)}
          alt="Remito"
          className="max-h-[520px] w-full rounded-xl border border-[var(--border)] object-contain bg-black/20"
        />
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionTitle
            right={<Pill color={estadoColor(row.estado)}>{estadoLabel(row.estado)}</Pill>}
          >
            {numeroRemito(row)} · {tenantLabel(row.tenant)}
          </SectionTitle>
          <p className="mb-4 text-sm text-[var(--text-dim)]">
            {conductorNombre(row)} → {destinoNombre(row)}
          </p>

          <div className="space-y-3">
            {campos.map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {k.replace(/_/g, " ")}
                </span>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
                  value={form[k] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          {validacion && (validacion.faltantes?.length || validacion.errores?.length) ? (
            <div className="mt-4 rounded-lg bg-[var(--amber)]/10 p-3 text-sm text-[var(--amber)]">
              {validacion.faltantes?.map((f) => <div key={f}>Falta: {f}</div>)}
              {validacion.errores?.map((e) => <div key={e}>{e}</div>)}
            </div>
          ) : null}

          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar correcciones"}
          </button>
          {msg && <p className="mt-2 text-sm text-[var(--green)]">{msg}</p>}
          {error && <p className="mt-2 text-sm text-[var(--red)]">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
