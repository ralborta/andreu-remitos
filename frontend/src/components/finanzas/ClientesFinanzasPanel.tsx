"use client";

import { useEffect, useMemo, useState } from "react";
import { listFacturasFinanzas, type FacturaFinanzas } from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";

type Cliente = {
  key: string;
  razon_social: string;
  cuit: string;
  telefono: string;
  email: string;
  facturas: number;
  saldo: number;
};

export function ClientesFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFacturasFinanzas({ tipo: "cobrar", limit: 200 })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, []);

  const clientes = useMemo(() => {
    const map = new Map<string, Cliente>();
    for (const r of rows) {
      const key = r.cuit_emisor || r.razon_social || r.id;
      const prev = map.get(key) || {
        key,
        razon_social: r.razon_social || "Cliente sin datos",
        cuit: r.cuit_emisor || "—",
        telefono: r.telefono || "",
        email: r.email || "",
        facturas: 0,
        saldo: 0,
      };
      prev.facturas += 1;
      prev.saldo += saldoFactura(r.monto, r.monto_aplicado);
      map.set(key, prev);
    }
    return [...map.values()].filter((c) =>
      `${c.razon_social} ${c.cuit}`.toLowerCase().includes(q.trim().toLowerCase()),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">Cartera de deudores desde las facturas a cobrar</p>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--red)]">{error}</p>}
      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente..."
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
          />
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              <th className="px-4 py-3">Razón social</th>
              <th className="px-4 py-3">CUIT</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Facturas</th>
              <th className="px-4 py-3">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.key} className="border-t border-[var(--border)]">
                <td className="px-4 py-2.5 font-medium text-white">{c.razon_social}</td>
                <td className="px-4 py-2.5 font-mono text-[var(--text-dim)]">{c.cuit}</td>
                <td className="px-4 py-2.5">{c.telefono || "—"}</td>
                <td className="px-4 py-2.5">{c.facturas}</td>
                <td className="px-4 py-2.5 font-mono">{moneyAR(c.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
