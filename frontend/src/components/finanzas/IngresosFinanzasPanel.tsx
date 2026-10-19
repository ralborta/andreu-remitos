"use client";

import { useEffect, useState } from "react";
import { listCobrosFinanzas, type CobroFinanzas } from "@/lib/api";
import { moneyAR } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "./EstadoCobranzaPill";

export function IngresosFinanzasPanel() {
  const [rows, setRows] = useState<CobroFinanzas[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    listCobrosFinanzas({ limit: 200 })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, []);

  const visibles = rows.filter((c) =>
    `${c.external_ref} ${c.factura_numero}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const total = visibles.reduce((s, c) => s + Number(c.monto || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Transferencias Bancarias</h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">Ingresos avisados por la pasarela</p>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--red)]">{error}</p>}
      <div className="mb-4 panel p-4">
        <p className="text-xs uppercase text-[var(--text-faint)]">Total</p>
        <p className="font-mono text-2xl font-bold text-white">{moneyAR(total)}</p>
      </div>
      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar referencia..."
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
          />
        </div>
        {visibles.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--text-dim)]">No hay transferencias</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-dim)]">
                    {c.settled_at ? new Date(c.settled_at).toLocaleString("es-AR") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{c.external_ref || c.id}</td>
                  <td className="px-4 py-2.5">{c.factura_numero || "—"}</td>
                  <td className="px-4 py-2.5 font-mono">{moneyAR(c.monto, c.moneda || "ARS")}</td>
                  <td className="px-4 py-2.5">
                    <EstadoCobranzaPill tone={c.estado === "aplicado" ? "ok" : "warn"}>
                      {c.estado === "aplicado" ? "Imputado" : "Pendiente"}
                    </EstadoCobranzaPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
