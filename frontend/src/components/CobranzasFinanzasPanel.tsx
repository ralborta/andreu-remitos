"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getFinanzasResumen, listFacturasFinanzas, type FacturaFinanzas } from "@/lib/api";
import { antiguedadLabel, estadoCobranza, moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "@/components/finanzas/EstadoCobranzaPill";

export function CobranzasFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [selected, setSelected] = useState<FacturaFinanzas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartera, setCartera] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, res] = await Promise.all([
        listFacturasFinanzas({ tipo: "cobrar", limit: 200 }),
        getFinanzasResumen(),
      ]);
      setRows(data);
      setCartera(res.cartera_abierta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar cobranzas");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibles = useMemo(() => {
    return rows.filter((r) => {
      if (!q.trim()) return true;
      return `${r.numero} ${r.razon_social}`.toLowerCase().includes(q.trim().toLowerCase());
    });
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-white">Cobranzas</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Cartera {moneyAR(cartera)}. Solo cuentas por cobrar. El cobro lo avisa la pasarela.
          </p>
        </div>
        <Link
          href="/finanzas/comunicacion"
          className="rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white"
        >
          Ir a comunicación
        </Link>
      </div>
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="panel overflow-hidden xl:col-span-3">
          <div className="border-b border-[var(--border)] p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
          {visibles.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">No hay facturas a cobrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase text-[var(--text-faint)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Factura</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Vto</th>
                    <th className="px-4 py-3 font-medium">Antigüedad</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => {
                    const saldo = saldoFactura(r.monto, r.monto_aplicado);
                    const st = estadoCobranza(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.04] ${
                          selected?.id === r.id ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-[var(--violet-2)]">{r.numero}</td>
                        <td className="px-4 py-2.5 text-white">{r.razon_social}</td>
                        <td className="px-4 py-2.5 tabular text-white">{moneyAR(saldo)}</td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{r.fecha_vto || "—"}</td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{antiguedadLabel(r.fecha_vto)}</td>
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
        <div className="panel p-5 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-dim)]">Pasos</h2>
          {!selected ? (
            <p className="text-sm text-[var(--text-dim)]">Elegí una factura para ver emitida → contacto → cobro.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white">
                {selected.razon_social} · {selected.numero}
              </p>
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
          )}
        </div>
      </div>
    </div>
  );
}
