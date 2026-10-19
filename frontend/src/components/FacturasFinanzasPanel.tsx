"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  facturaArchivoUrl,
  ingestFacturaPagar,
  listFacturasFinanzas,
  patchFacturaFinanzas,
  type FacturaFinanzas,
  type FacturaTipo,
} from "@/lib/api";
import { estadoCobranza, moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "@/components/finanzas/EstadoCobranzaPill";

export function FacturasFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [filtro, setFiltro] = useState<"todas" | FacturaTipo>("todas");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FacturaFinanzas | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFacturasFinanzas({ limit: 200 });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let list = rows;
    if (filtro !== "todas") list = list.filter((r) => r.tipo === filtro);
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((r) => `${r.numero} ${r.razon_social} ${r.cuit_emisor}`.toLowerCase().includes(n));
    }
    return list;
  }, [rows, filtro, q]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const row = await ingestFacturaPagar(file);
      setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
      setSelected(row);
      setFiltro("pagar");
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-white">Facturas</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            A pagar: PDF del proveedor. A cobrar: solo sistema.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white">
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
          {uploading ? "Leyendo PDF…" : "Importar PDF a pagar"}
        </label>
      </div>

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="panel p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar factura, cliente, CUIT…"
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-1">
            {(
              [
                ["todas", "Todas"],
                ["pagar", "A pagar"],
                ["cobrar", "A cobrar"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium ${
                  filtro === id ? "bg-[var(--violet)] text-white" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="self-center text-xs text-[var(--text-faint)]">{visible.length} comprobantes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="panel overflow-hidden xl:col-span-3">
          {loading ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">
              {filtro === "pagar" ? "Todavía no hay PDF de proveedor. Importá uno." : "No hay facturas con ese filtro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Cliente / emisor</th>
                    <th className="px-4 py-3 font-medium">Emisión</th>
                    <th className="px-4 py-3 font-medium">Vto</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const st =
                      r.tipo === "pagar"
                        ? r.estado === "confirmada"
                          ? { label: "Confirmada", tone: "ok" as const }
                          : { label: "Leída IA", tone: "warn" as const }
                        : estadoCobranza(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.04] ${
                          selected?.id === r.id ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-mono text-[var(--violet-2)]">{r.numero || "—"}</div>
                          <div className="text-[11px] text-[var(--text-faint)]">
                            {r.tipo === "pagar" ? "A pagar" : "A cobrar"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-white">{r.razon_social || "—"}</div>
                          <div className="font-mono text-[11px] text-[var(--text-faint)]">{r.cuit_emisor || "—"}</div>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{r.fecha || "—"}</td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{r.fecha_vto || "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular text-white">
                          {moneyAR(r.tipo === "cobrar" ? saldoFactura(r.monto, r.monto_aplicado) : r.monto, r.moneda || "ARS")}
                        </td>
                        <td className="px-4 py-2.5">
                          <EstadoCobranzaPill tone={st.tone}>{st.label}</EstadoCobranzaPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          {!selected ? (
            <div className="panel p-5 text-sm text-[var(--text-dim)]">
              Elegí una factura. Las a pagar se confirman acá; las a cobrar se gestionan en Cobranzas.
            </div>
          ) : (
            <div className="panel space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  {selected.tipo === "pagar" ? "Lectura IA" : selected.numero}
                </h2>
                {selected.tipo === "pagar" && selected.id ? (
                  <a
                    href={facturaArchivoUrl(selected.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--violet-2)] hover:underline"
                  >
                    Ver archivo
                  </a>
                ) : null}
              </div>

              {selected.tipo === "cobrar" ? (
                <p className="text-sm text-[var(--text-dim)]">
                  Entra por sistema. No se edita acá. Cobranzas, Conciliación y Comunicación la siguen.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Razón social" value={selected.razon_social || ""} onChange={(v) => setField("razon_social", v)} />
                  <Campo label="CUIT emisor" value={selected.cuit_emisor || ""} onChange={(v) => setField("cuit_emisor", v)} />
                  <Campo label="Número" value={selected.numero || ""} onChange={(v) => setField("numero", v)} />
                  <Campo label="Tipo" value={selected.tipo_comprobante || ""} onChange={(v) => setField("tipo_comprobante", v)} />
                  <Campo label="Fecha" value={selected.fecha || ""} onChange={(v) => setField("fecha", v)} />
                  <Campo label="Vencimiento" value={selected.fecha_vto || ""} onChange={(v) => setField("fecha_vto", v)} />
                  <Campo
                    label="Monto"
                    value={selected.monto == null ? "" : String(selected.monto)}
                    onChange={(v) => setField("monto", v === "" ? null : Number(v.replace(",", ".")))}
                  />
                  <Campo label="CAE" value={selected.cae || ""} onChange={(v) => setField("cae", v)} />
                </div>
              )}

              {selected.tipo === "pagar" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmar()}
                  className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Guardando…" : selected.estado === "confirmada" ? "Actualizar lectura" : "Confirmar lectura"}
                </button>
              )}

              <ol className="space-y-2">
                {(selected.pasos || []).map((p, i) => (
                  <li key={`${p.at}-${i}`} className="text-xs text-[var(--text-dim)]">
                    {i + 1}. {p.label}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
      />
    </label>
  );
}
