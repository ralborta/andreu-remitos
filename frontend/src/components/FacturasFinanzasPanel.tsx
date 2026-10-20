"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  facturaArchivoUrl,
  ingestFacturaPagar,
  listFacturasFinanzas,
  patchFacturaFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { estadoCobranza, moneyAR } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "@/components/finanzas/EstadoCobranzaPill";

export function FacturasFinanzasPanel({ modo }: { modo: "pagar" | "cobrar" }) {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FacturaFinanzas | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listFacturasFinanzas({ tipo: modo, limit: 200 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las facturas");
    } finally {
      setLoading(false);
    }
  }, [modo]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const st = r.tipo === "pagar"
        ? r.estado === "confirmada"
          ? "Pagada"
          : "Por vencer"
        : estadoCobranza(r).label;
      if (estado !== "all" && st !== estado) return false;
      if (!q.trim()) return true;
      return `${r.numero} ${r.razon_social} ${r.cuit_emisor}`.toLowerCase().includes(q.trim().toLowerCase());
    });
  }, [rows, q, estado]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const row = await ingestFacturaPagar(file);
      setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
      setSelected(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el PDF");
    } finally {
      setUploading(false);
    }
  }

  async function confirmar() {
    if (!selected || selected.tipo !== "pagar") return;
    setSaving(true);
    setError(null);
    try {
      const row = await patchFacturaFinanzas(selected.id, {
        tipo_comprobante: selected.tipo_comprobante,
        punto_venta: selected.punto_venta,
        numero: selected.numero,
        fecha: selected.fecha,
        fecha_vto: selected.fecha_vto,
        cuit_emisor: selected.cuit_emisor,
        razon_social: selected.razon_social,
        cuit_receptor: selected.cuit_receptor,
        monto: selected.monto,
        moneda: selected.moneda,
        cae: selected.cae,
      });
      setSelected(row);
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof FacturaFinanzas>(key: K, value: FacturaFinanzas[K]) {
    setSelected((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{modo === "pagar" ? "Pagos" : "Cobranzas"}</h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            {modo === "pagar"
              ? "Facturas a pagar: se cargan con el PDF del proveedor"
              : "Facturas a cobrar: entran por sistema"}
          </p>
        </div>
        {modo === "pagar" && (
          <label className="cursor-pointer rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading ? "Subiendo…" : "Cargar factura"}
          </label>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-[var(--red)]">{error}</p>}

      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="mb-3 text-base font-semibold text-white">
            {modo === "pagar" ? "Facturas a pagar" : "Todas las Facturas"}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cliente, número de factura..."
              className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
            />
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-white/5 px-2 text-sm text-white"
            >
              <option value="all">Todos los estados</option>
              <option value="Por vencer">Por vencer</option>
              <option value="Vencido">Vencido</option>
              <option value="Parcial">Parcial</option>
              <option value="Pagada">Pagada</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--text-dim)]">Cargando...</p>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--text-dim)]">No hay facturas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Aplicado</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const st =
                    r.tipo === "pagar"
                      ? r.estado === "confirmada"
                        ? { label: "Pagada", tone: "ok" as const }
                        : { label: "Por vencer", tone: "warn" as const }
                      : estadoCobranza(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.03] ${
                        selected?.id === r.id ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-[var(--violet-2)]">{r.numero || "SIN-NUMERO"}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-white">{r.razon_social || "Cliente sin datos"}</div>
                        {r.cuit_emisor && <div className="text-xs text-[var(--text-dim)]">CUIT: {r.cuit_emisor}</div>}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold">{moneyAR(r.monto, r.moneda || "ARS")}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-500">{moneyAR(r.monto_aplicado || 0)}</td>
                      <td className="px-4 py-2.5">{r.fecha_vto || "—"}</td>
                      <td className="px-4 py-2.5">
                        <EstadoCobranzaPill tone={st.tone}>{st.label}</EstadoCobranzaPill>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--violet-2)]">Ver Detalle</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="panel mt-4 space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {selected.tipo === "pagar" ? "Lectura IA" : "Historial"} · {selected.numero}
            </h2>
            {selected.tipo === "pagar" && selected.id && (
              <a href={facturaArchivoUrl(selected.id)} target="_blank" rel="noreferrer" className="text-xs text-[var(--violet-2)]">
                Ver archivo
              </a>
            )}
          </div>
          {selected.tipo === "pagar" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Razón social" value={selected.razon_social || ""} onChange={(v) => setField("razon_social", v)} />
                <Campo label="CUIT" value={selected.cuit_emisor || ""} onChange={(v) => setField("cuit_emisor", v)} />
                <Campo label="Número" value={selected.numero || ""} onChange={(v) => setField("numero", v)} />
                <Campo
                  label="Monto"
                  value={selected.monto == null ? "" : String(selected.monto)}
                  onChange={(v) => setField("monto", v === "" ? null : Number(v.replace(",", ".")))}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmar()}
                className="rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white"
              >
                {saving ? "Guardando…" : "Confirmar lectura"}
              </button>
            </>
          )}
          <ol className="space-y-1">
            {(selected.pasos || []).map((p, i) => (
              <li key={`${p.at}-${i}`} className="text-xs text-[var(--text-dim)]">
                {i + 1}. {p.label}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase text-[var(--text-faint)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
      />
    </label>
  );
}
