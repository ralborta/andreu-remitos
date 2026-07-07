"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRemito, getRemito, imagenUrl, patchRemitoCampos, patchRemitoTenant } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { canDeleteRemitos } from "@/lib/auth-types";
import type { RemitoRow, Tenant } from "@/lib/types";
import {
  acopladoPatente,
  advertenciaTenant,
  buildHorariosBody,
  campoLabel,
  camposEdicion,
  formEdicionFromDatos,
  chasisPatente,
  conductorNombre,
  destinoNombre,
  estadoColor,
  estadoLabel,
  esTenantCorina,
  fechaBaseHorarios,
  fechaHoraRemito,
  horasFromRow,
  numeroRemito,
  origenNombre,
  pesoKg,
  tenantLabel,
} from "@/lib/remitos-ui";
import { REMITO_TENANTS } from "@/lib/tenants";
import { Card, Pill, SectionTitle } from "./ui";
import { RemitoHorariosFields } from "./RemitoHorariosFields";
import { RemitoCampoInput } from "./RemitoCampoInput";
import { RemitoImagePreview } from "./RemitoImageLightbox";
import { useRemitoMaestros } from "@/hooks/useRemitoMaestros";

const NUMERIC_CAMPOS = new Set(["peso_kg", "total_bultos", "total_litros"]);

export function RemitoReview({ id, tenantSlug }: { id: string; tenantSlug?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const puedeBorrar = canDeleteRemitos(user);
  const [row, setRow] = useState<RemitoRow | null>(null);
  const maestros = useRemitoMaestros(row?.tenant ?? tenantSlug ?? "tsb");
  const [form, setForm] = useState<Record<string, string>>({});
  const [horas, setHoras] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function cambiarTenant(nuevo: Tenant) {
    if (!row || nuevo === row.tenant) return;
    setError(null);
    try {
      const updated = await patchRemitoTenant(id, nuevo);
      setRow(updated);
      setMsg(`Movido a ${tenantLabel(nuevo)}`);
      router.push(`/remitos/${nuevo}/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar cliente");
    }
  }

  async function borrar() {
    if (!row) return;
    if (!window.confirm(`¿Eliminar el remito ${numeroRemito(row)} por completo?`)) return;
    setBorrando(true);
    try {
      await deleteRemito(id);
      router.push(`/remitos/${row.tenant}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
      setBorrando(false);
    }
  }

  useEffect(() => {
    getRemito(id)
      .then((r) => {
        setRow(r);
        setForm(formEdicionFromDatos(r.tenant, r.datos as Record<string, unknown>));
        setHoras(horasFromRow(r));
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
        body[k] = NUMERIC_CAMPOS.has(k) ? (v ? Number(v) : null) : v || null;
      }
      if (!esTenantCorina(row.tenant)) {
        Object.assign(body, buildHorariosBody(horas, fechaBaseHorarios(row)));
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

  const campos = camposEdicion(row.tenant);
  const validacion = row.validacion;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Imagen al costado — como el CRM viejo pero horizontal */}
      <Card className="lg:sticky lg:top-4 lg:self-start">
        <SectionTitle>Foto del remito (WhatsApp)</SectionTitle>
        <p className="mb-3 text-xs text-[var(--text-faint)]">
          Compará la lectura de la IA con el papel manuscrito
        </p>
        <RemitoImagePreview
          src={imagenUrl(id)}
          alt={`Remito ${numeroRemito(row)}`}
          className="w-full object-contain"
          hint="Ampliar foto"
        />
        {row.telefono_chofer && (
          <p className="mt-3 text-xs text-[var(--text-dim)]">
            Enviado por WhatsApp · {row.telefono_chofer} · {fechaHoraRemito(row)}
          </p>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionTitle
            right={<Pill color={estadoColor(row.estado)}>{estadoLabel(row.estado)}</Pill>}
          >
            Editar remito {tenantLabel(row.tenant)} · {numeroRemito(row)}
          </SectionTitle>

          {advertenciaTenant(row) && (
            <p className="mb-3 rounded-lg bg-[var(--amber)]/10 px-3 py-2 text-xs text-[var(--amber)]">{advertenciaTenant(row)}</p>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">Cliente</span>
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
              value={row.tenant}
              onChange={(e) => cambiarTenant(e.target.value as Tenant)}
            >
              {REMITO_TENANTS.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </select>
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-white/5 p-3 text-sm">
            <div>
              <span className="text-xs text-[var(--text-faint)]">Chofer</span>
              <p className="text-white">{conductorNombre(row)}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-faint)]">Ruta</span>
              <p className="text-white">{origenNombre(row)} → {destinoNombre(row)}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-faint)]">Unidad</span>
              <p className="text-white">{chasisPatente(row)} / {acopladoPatente(row)}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--text-faint)]">Peso leído</span>
              <p className="text-white">{pesoKg(row)} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {campos.map((k) => (
              <label key={k} className="block sm:col-span-2 sm:[&:nth-child(-n+4)]:col-span-1">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  {campoLabel(k)}
                </span>
                <RemitoCampoInput
                  campo={k}
                  value={form[k] ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
                  maestros={maestros}
                />
              </label>
            ))}
          </div>

          {!esTenantCorina(row.tenant) && (
            <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
              <RemitoHorariosFields
                horas={horas}
                onChange={(key, value) => setHoras((h) => ({ ...h, [key]: value }))}
              />
            </div>
          )}

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
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {puedeBorrar && (
            <button
              type="button"
              onClick={borrar}
              disabled={borrando || saving}
              className="mt-2 w-full rounded-xl border border-[var(--red)]/40 py-2.5 text-sm font-medium text-[var(--red)] hover:bg-[var(--red)]/10 disabled:opacity-50"
            >
              {borrando ? "Eliminando…" : "Eliminar remito"}
            </button>
          )}
          {msg && <p className="mt-2 text-sm text-[var(--green)]">{msg}</p>}
          {error && <p className="mt-2 text-sm text-[var(--red)]">{error}</p>}
        </Card>
      </div>
    </div>
  );
}
