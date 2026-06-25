"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";
import { imagenUrl, patchRemitoCampos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import {
  buildHorariosBody,
  campoLabel,
  estadoColor,
  estadoLabel,
  fechaBaseHorarios,
  horasFromRow,
  numeroRemito,
  tenantLabel,
} from "@/lib/remitos-ui";
import { Card, Pill, SectionTitle } from "./ui";
import { RemitoHorariosFields } from "./RemitoHorariosFields";

const CAMPOS_TSB = [
  "fecha_guia",
  "nro_guia",
  "conductor",
  "chasis",
  "acoplado",
  "procedencia",
  "destino",
  "peso_kg",
] as const;

const CAMPOS_BERALDI = [
  "fecha_remito",
  "nro_remito",
  "chofer",
  "patente_chasis",
  "patente_acoplado",
  "origen",
  "destino",
  "peso_kg",
] as const;

function camposFor(row: RemitoRow) {
  return row.tenant === "tsb" ? CAMPOS_TSB : CAMPOS_BERALDI;
}

function formFromRow(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  const campos = camposFor(row);
  const initial: Record<string, string> = {};
  for (const k of campos) {
    if (d[k] != null) initial[k] = String(d[k]);
  }
  return initial;
}

function EditorBody({
  row,
  onClose,
  onSaved,
}: {
  row: RemitoRow;
  onClose?: () => void;
  onSaved?: (updated: RemitoRow) => void;
}) {
  const [form, setForm] = useState(() => formFromRow(row));
  const [horas, setHoras] = useState(() => horasFromRow(row));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromRow(row));
    setHoras(horasFromRow(row));
    setMsg(null);
    setError(null);
  }, [row.id, row.updated_at]);

  const campos = camposFor(row);
  const validacion = row.validacion;

  async function guardar() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        body[k] = k === "peso_kg" ? (v ? Number(v) : null) : v || null;
      }
      Object.assign(body, buildHorariosBody(horas, fechaBaseHorarios(row)));
      const updated = await patchRemitoCampos(row.id, body);
      onSaved?.(updated);
      setMsg(updated.estado === "confirmado" ? "Guardado — validado" : "Guardado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
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

      <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenUrl(row.id)}
          alt={`Remito ${numeroRemito(row)}`}
          className="max-h-[min(42vh,360px)] w-full object-contain object-top"
        />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-2">
        {campos.map((k) => (
          <label
            key={k}
            className={`block ${k === "procedencia" || k === "destino" || k === "origen" ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {campoLabel(k)}
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
              value={form[k] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
        <RemitoHorariosFields
          horas={horas}
          onChange={(key, value) => setHoras((h) => ({ ...h, [key]: value }))}
        />
      </div>

      {validacion && (validacion.faltantes?.length || validacion.errores?.length) ? (
        <div className="mt-3 rounded-lg bg-[var(--amber)]/10 p-3 text-xs text-[var(--amber)]">
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
          onClick={guardar}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
        >
          <Check size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <Link
          href={`/remitos/${row.tenant}/${row.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-dim)] hover:border-[var(--violet)]/40 hover:text-white"
        >
          <ExternalLink size={16} />
          Revisión completa
        </Link>
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
}: {
  row: RemitoRow | null;
  onSaved?: (updated: RemitoRow) => void;
}) {
  if (!row) {
    return (
      <Card className="flex min-h-[480px] items-center justify-center">
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
      <EditorBody row={row} onSaved={onSaved} />
    </Card>
  );
}

/** Drawer en pantallas chicas / cuando hace falta overlay */
export function RemitoQuickEditorDrawer({
  row,
  open,
  onClose,
  onSaved,
}: {
  row: RemitoRow | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: RemitoRow) => void;
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
        <EditorBody row={row} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}
