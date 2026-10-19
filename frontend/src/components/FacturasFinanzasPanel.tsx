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
import { Card, Pill, SectionTitle } from "@/components/ui";

function money(n: number | null | undefined, moneda = "ARS") {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "ARS",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function estadoLabel(row: FacturaFinanzas) {
  if (row.tipo === "cobrar") {
    if (row.estado === "saldada") return "Saldada";
    return "Abierta";
  }
  if (row.estado === "confirmada") return "Confirmada";
  if (row.estado === "leida") return "Leída por IA";
  return row.estado || "—";
}

function estadoColor(row: FacturaFinanzas) {
  if (row.tipo === "cobrar") return "#38bdf8";
  if (row.estado === "confirmada") return "#22c55e";
  return "#f59e0b";
}

export function FacturasFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [filtro, setFiltro] = useState<"todas" | FacturaTipo>("todas");
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
    if (filtro === "todas") return rows;
    return rows.filter((r) => r.tipo === filtro);
  }, [rows, filtro]);

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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="space-y-4 xl:col-span-3">
        <Card>
          <SectionTitle>Cargar factura a pagar</SectionTitle>
          <p className="mb-3 text-sm text-[var(--text-dim)]">
            Solo PDF o foto de <strong className="text-white">factura de proveedor</strong>. La IA lee los
            datos. No hay alta en blanco. Las a cobrar no se suben acá.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-white/[0.03] px-4 py-8 text-center hover:border-[var(--violet)]/50">
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
            <span className="text-sm font-medium text-white">
              {uploading ? "La IA está leyendo la factura…" : "Soltá o elegí el PDF"}
            </span>
            <span className="mt-1 text-xs text-[var(--text-faint)]">Factura A / B / C · no tickets de chofer</span>
          </label>
          {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}
        </Card>

        <Card>
          <SectionTitle
            right={
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
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      filtro === id
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            Facturas
          </SectionTitle>

          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">
              {filtro === "cobrar"
                ? "Las a cobrar entran solo por sistema. Todavía no hay integración."
                : "Todavía no hay facturas a pagar. Subí un PDF."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Número</th>
                    <th className="py-2 pr-3 font-medium">Emisor / cliente</th>
                    <th className="py-2 pr-3 font-medium">Monto</th>
                    <th className="py-2 pr-3 font-medium">Vto</th>
                    <th className="py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.04] ${
                        selected?.id === r.id ? "bg-white/[0.06]" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <Pill color={r.tipo === "pagar" ? "#a78bfa" : "#38bdf8"}>
                          {r.tipo === "pagar" ? "A pagar" : "A cobrar"}
                        </Pill>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-white">{r.numero || "—"}</td>
                      <td className="py-2.5 pr-3">
                        <div className="text-white">{r.razon_social || "—"}</div>
                        <div className="font-mono text-[11px] text-[var(--text-faint)]">
                          {r.cuit_emisor || "—"}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 tabular text-white">{money(r.monto, r.moneda || "ARS")}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-dim)]">{r.fecha_vto || r.fecha || "—"}</td>
                      <td className="py-2.5">
                        <Pill color={estadoColor(r)}>{estadoLabel(r)}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="xl:col-span-2">
        {!selected ? (
          <Card>
            <p className="text-sm text-[var(--text-dim)]">Elegí una factura para ver la lectura y los pasos.</p>
          </Card>
        ) : (
          <Card className="space-y-4">
            <SectionTitle
              right={
                selected.tipo === "pagar" && selected.id ? (
                  <a
                    href={facturaArchivoUrl(selected.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--violet-2)] hover:underline"
                  >
                    Ver archivo
                  </a>
                ) : null
              }
            >
              {selected.tipo === "pagar" ? "Lectura IA" : "Solo sistema"}
            </SectionTitle>

            {selected.tipo === "cobrar" ? (
              <p className="text-sm text-[var(--text-dim)]">
                Esta factura a cobrar no se carga ni se edita acá. Entra por sistema; Cobranzas, Conciliación y
                Comunicación la gestionan.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo
                  label="Razón social"
                  value={selected.razon_social || ""}
                  onChange={(v) => setField("razon_social", v)}
                />
                <Campo
                  label="CUIT emisor"
                  value={selected.cuit_emisor || ""}
                  onChange={(v) => setField("cuit_emisor", v)}
                />
                <Campo label="Número" value={selected.numero || ""} onChange={(v) => setField("numero", v)} />
                <Campo
                  label="Tipo"
                  value={selected.tipo_comprobante || ""}
                  onChange={(v) => setField("tipo_comprobante", v)}
                />
                <Campo
                  label="Fecha"
                  value={selected.fecha || ""}
                  onChange={(v) => setField("fecha", v)}
                />
                <Campo
                  label="Vencimiento"
                  value={selected.fecha_vto || ""}
                  onChange={(v) => setField("fecha_vto", v)}
                />
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
                {saving
                  ? "Guardando…"
                  : selected.estado === "confirmada"
                    ? "Actualizar lectura"
                    : "Confirmar lectura"}
              </button>
            )}

            <div>
              <SectionTitle>Pasos</SectionTitle>
              {(!selected.pasos || selected.pasos.length === 0) && (
                <p className="text-sm text-[var(--text-dim)]">Sin pasos todavía.</p>
              )}
              <ol className="space-y-2">
                {(selected.pasos || []).map((p, i) => (
                  <li key={`${p.at}-${i}`} className="flex gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--violet)]/20 text-[10px] font-bold text-[var(--violet-2)]">
                      {i + 1}
                    </span>
                    <span>
                      <span className="text-white">{p.label}</span>
                      <span className="ml-2 text-[11px] text-[var(--text-faint)]">
                        {p.at ? new Date(p.at).toLocaleString("es-AR") : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        )}
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
