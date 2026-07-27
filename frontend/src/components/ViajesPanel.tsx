"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Route } from "lucide-react";
import {
  cambiarEstadoViaje,
  createViaje,
  deleteViaje,
  listViajes,
  patchViaje,
  type Viaje,
  type ViajeEstado,
} from "@/lib/api";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

const ESTADO_COLOR: Record<string, string> = {
  solicitado: "#a79fc9",
  confirmado: "#38bdf8",
  asignado: "#818cf8",
  en_curso: "#f59e0b",
  entregado: "#22c55e",
  cerrado: "#6f6796",
  cancelado: "#ef4444",
};

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[var(--text-faint)]";

type FormState = {
  cliente: string;
  origen: string;
  destino: string;
  carga: string;
  fecha: string;
  tenant: string;
  chofer: string;
  tractor: string;
  semi: string;
  notas: string;
};

const emptyForm: FormState = {
  cliente: "",
  origen: "",
  destino: "",
  carga: "",
  fecha: "",
  tenant: "",
  chofer: "",
  tractor: "",
  semi: "",
  notas: "",
};

export function ViajesPanel() {
  const [rows, setRows] = useState<Viaje[]>([]);
  const [activo, setActivo] = useState<Viaje | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("");

  const refrescar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listViajes({
        limit: 100,
        estado: filtroEstado || undefined,
      });
      setRows(list);
      setActivo((prev) => (prev ? list.find((v) => v.id === prev.id) ?? prev : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar viajes");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createViaje({
        cliente: form.cliente.trim(),
        origen: form.origen.trim(),
        destino: form.destino.trim(),
        carga: form.carga.trim() || undefined,
        fecha: form.fecha || undefined,
        tenant: form.tenant || undefined,
        chofer: form.chofer.trim() || undefined,
        tractor: form.tractor.trim() || undefined,
        semi: form.semi.trim() || undefined,
        notas: form.notas.trim() || undefined,
      });
      setForm(emptyForm);
      setActivo(created);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function onEstado(estado: ViajeEstado) {
    if (!activo) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await cambiarEstadoViaje(activo.id, estado);
      setActivo(updated);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar estado");
    } finally {
      setSaving(false);
    }
  }

  async function onGuardarAsignacion() {
    if (!activo) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await patchViaje(activo.id, {
        chofer: activo.chofer,
        tractor: activo.tractor,
        semi: activo.semi,
        telefonoChofer: activo.telefonoChofer,
        notas: activo.notas,
      });
      setActivo(updated);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onEliminar() {
    if (!activo) return;
    if (!confirm(`¿Eliminar viaje ${activo.codigo}?`)) return;
    setSaving(true);
    try {
      await deleteViaje(activo.id);
      setActivo(null);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  }

  const cols: Column<Viaje>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (r) => (
        <button
          type="button"
          onClick={() => setActivo(r)}
          className={`font-medium ${activo?.id === r.id ? "text-[var(--violet-2)]" : "text-white hover:underline"}`}
        >
          {r.codigo}
        </button>
      ),
    },
    { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
    {
      key: "ruta",
      header: "Ruta",
      render: (r) => (
        <span className="text-[var(--text-dim)]">
          {r.origen} → {r.destino}
        </span>
      ),
    },
    { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]", render: (r) => r.chofer || "—" },
    {
      key: "unidad",
      header: "Unidad",
      className: "text-[var(--text-dim)]",
      render: (r) => r.tractor || "—",
    },
    {
      key: "tms",
      header: "TMS",
      render: (r) => (
        <span className="text-xs text-[var(--text-faint)]">{r.tmsId || r.tmsSyncStatus || "none"}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => <Pill color={ESTADO_COLOR[r.estado] ?? "#a79fc9"}>{r.estadoLabel}</Pill>,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Nuevo viaje</SectionTitle>
          <p className="text-xs text-[var(--text-faint)]">Opera en Andreu · TMS opcional (stub)</p>
        </div>
        <form onSubmit={onCrear} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Cliente *</span>
            <input
              className={inputCls}
              required
              value={form.cliente}
              onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Origen *</span>
            <input
              className={inputCls}
              required
              value={form.origen}
              onChange={(e) => setForm((f) => ({ ...f, origen: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Destino *</span>
            <input
              className={inputCls}
              required
              value={form.destino}
              onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Carga</span>
            <input
              className={inputCls}
              value={form.carga}
              onChange={(e) => setForm((f) => ({ ...f, carga: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Fecha</span>
            <input
              type="date"
              className={inputCls}
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Tenant</span>
            <select
              className={inputCls}
              value={form.tenant}
              onChange={(e) => setForm((f) => ({ ...f, tenant: e.target.value }))}
            >
              <option value="">—</option>
              <option value="tsb">TSB</option>
              <option value="beraldi">Beraldi</option>
              <option value="corina">Corina</option>
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Notas</span>
            <input
              className={inputCls}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crear viaje
            </button>
          </div>
        </form>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      </Card>

      {activo && (
        <Card className="p-4 ring-1 ring-[var(--violet)]/30">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Route size={16} className="text-[var(--violet-2)]" />
            <span className="font-medium text-white">{activo.codigo}</span>
            <Pill color={ESTADO_COLOR[activo.estado]}>{activo.estadoLabel}</Pill>
            <span className="text-xs text-[var(--text-faint)]">TMS: {activo.tmsId || activo.tmsSyncStatus}</span>
          </div>
          <p className="text-sm text-white">
            {activo.cliente} · {activo.origen} → {activo.destino}
          </p>
          {activo.carga && <p className="mt-1 text-xs text-[var(--text-dim)]">Carga: {activo.carga}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Chofer</span>
              <input
                className={inputCls}
                value={activo.chofer ?? ""}
                onChange={(e) => setActivo({ ...activo, chofer: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Tractor</span>
              <input
                className={inputCls}
                value={activo.tractor ?? ""}
                onChange={(e) => setActivo({ ...activo, tractor: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Semi</span>
              <input
                className={inputCls}
                value={activo.semi ?? ""}
                onChange={(e) => setActivo({ ...activo, semi: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onGuardarAsignacion()}
              disabled={saving}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
            >
              Guardar asignación
            </button>
            {activo.transiciones.map((est) => (
              <button
                key={est}
                type="button"
                disabled={saving}
                onClick={() => void onEstado(est)}
                className="rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-[var(--violet)]/40"
              >
                → {est.replace(/_/g, " ")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void onEliminar()}
              className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
            >
              Eliminar
            </button>
          </div>

          {activo.historial.length > 0 && (
            <ul className="mt-4 max-h-32 space-y-1 overflow-auto border-t border-[var(--border-soft)] pt-3 text-[11px] text-[var(--text-faint)]">
              {activo.historial.map((h, i) => (
                <li key={`${h}-${i}`}>{h}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Viajes ({rows.length})</SectionTitle>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-[var(--border)] bg-white/5 px-2 py-1 text-xs text-white"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.keys(ESTADO_COLOR).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refrescar()}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-white"
            >
              <RefreshCw size={12} />
              Sync
            </button>
          </div>
        </div>
        {loading && rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-faint)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-faint)]">
            Sin viajes — creá el primero arriba
          </p>
        ) : (
          <DataTable columns={cols} rows={rows} minWidth={920} />
        )}
      </Card>
    </div>
  );
}
