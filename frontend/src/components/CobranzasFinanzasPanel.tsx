"use client";

import { useCallback, useEffect, useState } from "react";
import { getFinanzasResumen, listFacturasFinanzas, type FacturaFinanzas } from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { Card, Pill, SectionTitle } from "@/components/ui";

export function CobranzasFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [selected, setSelected] = useState<FacturaFinanzas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartera, setCartera] = useState<number | null>(null);

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

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <Card>
          <SectionTitle
            right={
              <span className="text-xs text-[var(--text-dim)]">
                Cartera {moneyAR(cartera)}
              </span>
            }
          >
            Facturas a cobrar
          </SectionTitle>
          <p className="mb-3 text-sm text-[var(--text-dim)]">
            Solo lo que el cliente debe. Entran por sistema. El cobro lo avisa la pasarela.
          </p>
          {error && <p className="mb-2 text-sm text-[var(--red)]">{error}</p>}
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">No hay facturas a cobrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-[var(--text-faint)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Número</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Saldo</th>
                    <th className="py-2 pr-3 font-medium">Vto</th>
                    <th className="py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const saldo = saldoFactura(r.monto, r.monto_aplicado);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`cursor-pointer border-t border-[var(--border)] hover:bg-white/[0.04] ${
                          selected?.id === r.id ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <td className="py-2.5 pr-3 font-mono text-white">{r.numero}</td>
                        <td className="py-2.5 pr-3 text-white">{r.razon_social}</td>
                        <td className="py-2.5 pr-3 tabular text-white">{moneyAR(saldo)}</td>
                        <td className="py-2.5 pr-3 text-[var(--text-dim)]">{r.fecha_vto || "—"}</td>
                        <td className="py-2.5">
                          <Pill
                            color={
                              r.estado === "saldada" ? "#22c55e" : saldo > 0 && r.fecha_vto && r.fecha_vto < new Date().toISOString().slice(0, 10) ? "#ef4444" : "#f59e0b"
                            }
                          >
                            {r.estado}
                          </Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="xl:col-span-2">
        <Card>
          <SectionTitle>Pasos</SectionTitle>
          {!selected ? (
            <p className="text-sm text-[var(--text-dim)]">Elegí una factura.</p>
          ) : (
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
          )}
        </Card>
      </div>
    </div>
  );
}
