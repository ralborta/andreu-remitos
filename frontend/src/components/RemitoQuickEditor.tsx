"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckSquare, ExternalLink, Trash2, X } from "lucide-react";
import { imagenUrl, deleteRemito, getRemito, patchRemitoCampos, patchRemitoTenant, procesarRemitos } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/lib/confirm-context";
import { canDeleteRemitos } from "@/lib/auth-types";
import type { RemitoRow, Tenant } from "@/lib/types";
import {
  buildHorariosBody,
  campoLabel,
  camposEdicion,
  formEdicionFromDatos,
  advertenciaTenant,
  estadoColor,
  estadoLabel,
  esTenantCorina,
  fechaBaseHorarios,
  horasFromRow,
  numeroRemito,
  remitoProcesable,
  tenantLabel,
} from "@/lib/remitos-ui";
import { REMITO_TENANTS } from "@/lib/tenants";
import { Card, Pill, SectionTitle } from "./ui";
import { RemitoHorariosFields } from "./RemitoHorariosFields";
import { RemitoCampoInput } from "./RemitoCampoInput";
import { useRemitoMaestros } from "@/hooks/useRemitoMaestros";
import { RemitoImagePreview } from "./RemitoImageLightbox";

const NUMERIC_CAMPOS = new Set(["peso_kg", "total_bultos", "total_litros"]);

function camposFor(row: RemitoRow) {
  return camposEdicion(row.tenant);
}

function formFromRow(row: RemitoRow) {
  return formEdicionFromDatos(row.tenant, row.datos as Record<string, unknown>);
}

function EditorBody({
  row,
  onClose,
  onSaved,
  onDeleted,
}: {
  row: RemitoRow;
  onClose?: () => void;
  onSaved?: (updated: RemitoRow) => void;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuth();
  const puedeBorrar = canDeleteRemitos(user);
  const maestros = useRemitoMaestros(row.tenant);
  const [form, setForm] = useState(() => formFromRow(row));
  const [horas, setHoras] = useState(() => horasFromRow(row));
  const [saving, setSaving] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [cambiandoTenant, setCambiandoTenant] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromRow(row));
    setHoras(horasFromRow(row));
    setMsg(null);
    setError(null);
  }, [row.id]);

  const campos = camposFor(row);
  const validacion = row.validacion;
  const procesable = remitoProcesable(row);
  const advTenant = advertenciaTenant(row);
  const formDirty = useMemo(() => {
    const baseline = formFromRow(row);
    const camposKeys = camposFor(row);
    for (const k of camposKeys) {
      if ((form[k] ?? "") !== (baseline[k] ?? "")) return true;
    }
    if (!esTenantCorina(row.tenant)) {
      const h0 = horasFromRow(row);
      for (const k of Object.keys(horas) as (keyof typeof horas)[]) {
        if ((horas[k] ?? "") !== (h0[k] ?? "")) return true;
      }
    }
    return false;
  }, [form, horas, row]);

  const onCampoChange = useCallback((key: string, val: string) => {
    setForm((f) => (f[key] === val ? f : { ...f, [key]: val }));
  }, []);

  const onHoraChange = useCallback((key: string, val: string) => {
    setHoras((h) => (h[key] === val ? h : { ...h, [key]: val }));
  }, []);

  const imagenSrc = useMemo(() => imagenUrl(row.id), [row.id]);

  async function cambiarTenant(nuevo: Tenant) {
    if (nuevo === row.tenant) return;
    setCambiandoTenant(true);
    setMsg(null);
    setError(null);
    try {
      const updated = await patchRemitoTenant(row.id, nuevo);
      onSaved?.(updated);
      setForm(formFromRow(updated));
      setHoras(horasFromRow(updated));
      setMsg(`Movido a ${tenantLabel(nuevo)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar cliente");
    } finally {
      setCambiandoTenant(false);
    }
  }

  const confirm = useConfirm();

  async function borrar() {
    const nro = numeroRemito(row);
    const ok = await confirm({
      title: "Eliminar remito",
      message: `¿Eliminar el remito ${nro} por completo? (foto y datos — no se puede deshacer)`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setBorrando(true);
    setError(null);
    try {
      await deleteRemito(row.id);
      onDeleted?.(row.id);
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setBorrando(false);
    }
  }

  async function guardar() {
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
      const updated = await patchRemitoCampos(row.id, body);
      onSaved?.(updated);
      setForm(formFromRow(updated));
      setHoras(horasFromRow(updated));
      setMsg(updated.estado === "confirmado" ? "Guardado — validado" : "Guardado");
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function procesar() {
    setProcesando(true);
    setMsg(null);
    setError(null);
    try {
      // Siempre persistir el formulario antes de procesar: si no, la validación
      // del servidor (y el botón) siguen con el destino OCR viejo (ej. Lach.874).
      const saved = await guardar();
      if (!saved) return;
      const check = remitoProcesable(saved);
      if (!check.ok) {
        setError(check.motivos[0] || "No se puede procesar — revisá destino y horarios");
        return;
      }
      const result = await procesarRemitos([saved.id], saved.tenant);
      if (result.errores.length > 0) {
        setError(result.errores[0].motivos.join(" · "));
        return;
      }
      const updated = await getRemito(saved.id);
      onSaved?.(updated);
      setForm(formFromRow(updated));
      setHoras(horasFromRow(updated));
      setMsg("Procesado — listo para planilla");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
            {tenantLabel(row.tenant)} · Editar remito
          </p>
          <h3 className="text-lg font-semibold text-white">{numeroRemito(row)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Pill color={estadoColor(row.estado)}>{estadoLabel(row.estado)}</Pill>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {advTenant && (
        <div className="mb-3 rounded-lg bg-[var(--amber)]/10 px-3 py-2 text-xs text-[var(--amber)]">
          {advTenant}
        </div>
      )}

      <label className="mb-4 block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Cliente / empresa
        </span>
        <select
          value={row.tenant}
          disabled={cambiandoTenant}
          onChange={(e) => cambiarTenant(e.target.value as Tenant)}
          className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)] disabled:opacity-50"
        >
          {REMITO_TENANTS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[10px] text-[var(--text-faint)]">
          TSB ↔ Beraldi ↔ Corina — revalida destino y horarios al cambiar.
        </span>
      </label>

      <div className="mb-4">
        <RemitoImagePreview
          src={imagenSrc}
          alt={`Remito ${numeroRemito(row)}`}
        />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 pb-2">
        {campos.map((k) => (
          <label
            key={k}
            className={`block ${k === "procedencia" || k === "destino" || k === "origen" ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {campoLabel(k)}
            </span>
            <RemitoCampoInput
              campo={k}
              value={form[k] ?? ""}
              onChange={(v) => onCampoChange(k, v)}
              maestros={maestros}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
        {!esTenantCorina(row.tenant) && (
          <RemitoHorariosFields horas={horas} onChange={onHoraChange} />
        )}
      </div>

      {validacion && (validacion.faltantes?.length || validacion.errores?.length) ? (
        <div className="mt-3 rounded-lg bg-[var(--amber)]/10 p-3 text-xs text-[var(--amber)]">
          {formDirty && (
            <div className="mb-1 font-medium">
              Hay cambios sin guardar — al procesar se guardan solos; o pulsá «Guardar cambios».
            </div>
          )}
          {validacion.faltantes?.map((f) => (
            <div key={f}>Falta: {f}</div>
          ))}
          {validacion.errores?.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-[var(--border-soft)] pt-4">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={saving || procesando}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
        >
          <Check size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {row.estado !== "confirmado" && (
          <button
            type="button"
            onClick={() => void procesar()}
            disabled={procesando || saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)]/20 py-2.5 text-sm font-semibold text-[var(--green)] ring-1 ring-[var(--green)]/40 hover:bg-[var(--green)]/30 disabled:opacity-50"
          >
            <CheckSquare size={16} />
            {procesando ? "Procesando…" : formDirty ? "Guardar y procesar" : "Procesar remito"}
          </button>
        )}
        {!procesable.ok && !formDirty && row.estado !== "confirmado" && procesable.motivos.length > 0 && (
          <p className="text-center text-xs text-[var(--text-faint)]">
            Para procesar: {procesable.motivos[0]}
          </p>
        )}
        {formDirty && row.estado !== "confirmado" && (
          <p className="text-center text-xs text-[var(--text-faint)]">
            Corregiste campos — guardá o usá «Guardar y procesar».
          </p>
        )}
        <Link
          href={`/remitos/${row.tenant}/${row.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-dim)] hover:border-[var(--violet)]/40 hover:text-white"
        >
          <ExternalLink size={16} />
          Revisión completa
        </Link>
        {puedeBorrar && (
          <button
            type="button"
            onClick={borrar}
            disabled={borrando || saving || procesando}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--red)]/40 py-2.5 text-sm font-medium text-[var(--red)] hover:bg-[var(--red)]/10 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {borrando ? "Eliminando…" : "Eliminar remito"}
          </button>
        )}
        {msg && <p className="text-center text-sm text-[var(--green)]">{msg}</p>}
        {error && <p className="text-center text-sm text-[var(--red)]">{error}</p>}
      </div>
    </div>
  );
}

/** Panel lateral en desktop */
export function RemitoQuickEditorPanel({
  row,
  onSaved,
  onDeleted,
}: {
  row: RemitoRow | null;
  onSaved?: (updated: RemitoRow) => void;
  onDeleted?: (id: string) => void;
}) {
  if (!row) {
    return (
      <Card className="flex min-h-[480px] items-center justify-center bg-[var(--bg-2)]">
        <div className="max-w-xs text-center">
          <p className="text-sm font-medium text-white">Seleccioná un remito</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            Clic en una fila para ver la foto y editar campos — como el CRM viejo, pero en el mismo panel.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <EditorBody row={row} onSaved={onSaved} onDeleted={onDeleted} />
    </Card>
  );
}

/** Drawer en pantallas chicas / cuando hace falta overlay */
export function RemitoQuickEditorDrawer({
  row,
  open,
  onClose,
  onSaved,
  onDeleted,
}: {
  row: RemitoRow | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: RemitoRow) => void;
  onDeleted?: (id: string) => void;
}) {
  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar panel"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-2)] p-4 shadow-2xl">
        <EditorBody row={row} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
      </div>
    </div>
  );
}
