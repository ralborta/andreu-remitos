"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFacturasFinanzas({ tipo: "cobrar", limit: 200 })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
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
      if (!prev.email && r.email) prev.email = r.email;
      if (!prev.telefono && r.telefono) prev.telefono = r.telefono;
      map.set(key, prev);
    }
    const search = q.trim().toLowerCase();
    return [...map.values()].filter((c) =>
      `${c.razon_social} ${c.cuit} ${c.email} ${c.telefono}`.toLowerCase().includes(search),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">Cartera de deudores para cobranzas y comunicación</p>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--red)]">{error}</p>}
      <div className="panel overflow-hidden">
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="mb-3 text-base font-semibold text-white">Lista de Clientes</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razón social, email, teléfono o CUIT..."
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
          />
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--text-dim)]">Cargando...</p>
        ) : clientes.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--text-dim)]">
            {q ? "No se encontraron clientes" : "No hay clientes"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="px-4 py-3">Razón social</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">CUIT</th>
                  <th className="px-4 py-3">Facturas</th>
                  <th className="px-4 py-3">Saldo</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.key} className="border-t border-[var(--border)] hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-medium text-white">{c.razon_social}</td>
                    <td className="px-4 py-2.5 text-[var(--violet-2)]">{c.email || "—"}</td>
                    <td className="px-4 py-2.5">{c.telefono || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--text-dim)]">{c.cuit}</td>
                    <td className="px-4 py-2.5">{c.facturas}</td>
                    <td className="px-4 py-2.5 font-mono">{moneyAR(c.saldo)}</td>
                    <td className="px-4 py-2.5">
                      <Link href="/finanzas/facturas/cobranzas" className="text-xs font-medium text-[var(--violet-2)]">
                        Ver cobranzas
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-dim)]">
          Mostrando {clientes.length} clientes
        </div>
      </div>
    </div>
  );
}
