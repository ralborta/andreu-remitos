"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getFinanzasResumen, listFacturasFinanzas, type FacturaFinanzas, type FinanzasResumen } from "@/lib/api";
import { antiguedadLabel, estadoCobranza, moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "./EstadoCobranzaPill";

export function FinanzasDashboard() {
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("all");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFinanzasResumen(), listFacturasFinanzas({ tipo: "cobrar", limit: 200 })])
      .then(([r, facturas]) => {
        if (cancelled) return;
        setResumen(r);
        setRows(facturas.filter((f) => saldoFactura(f.monto, f.monto_aplicado) > 0));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar Finanzas");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibles = useMemo(() => {
    return rows.filter((r) => {
      const st = estadoCobranza(r);
      if (estado !== "all" && st.label !== estado) return false;
      if (!q.trim()) return true;
      return `${r.numero} ${r.razon_social}`.toLowerCase().includes(q.trim().toLowerCase());
    });
  }, [rows, q, estado]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard de Cobranzas</h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">Resumen operativo en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/finanzas/ingresos"
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            Exportar
          </Link>
          <Link
            href="/finanzas/conciliacion"
            className="rounded-lg bg-[var(--violet)] px-3 py-2 text-sm font-semibold text-white"
          >
            Nuevo Cobro
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--red)]">{error}</p>}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Monto Total Cobrado" value={moneyAR(resumen?.cobrado)} accent="bg-emerald-100" />
        <Kpi title="Deuda Pendiente" value={moneyAR(resumen?.cartera_abierta)} accent="bg-red-100" />
        <Kpi title="Eficiencia de Cobro" value={resumen ? `${resumen.eficiencia}%` : "—"} accent="bg-blue-100" />
        <Kpi title="Depósitos pendientes" value={String(resumen?.cobros_pendientes ?? "—")} accent="bg-amber-100" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border)] p-4">
            <h2 className="text-base font-semibold text-white">Cobranzas Pendientes</h2>
            <p className="text-xs text-[var(--text-dim)]">Facturas abiertas y por vencer</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar..."
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
              </select>
            </div>
          </div>
          {visibles.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--text-dim)]">
              {error ? "No se pudieron cargar las facturas." : "No hay facturas pendientes"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                    <th className="px-4 py-3">Factura</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Antigüedad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => {
                    const st = estadoCobranza(r);
                    return (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5 font-mono font-medium">{r.numero}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-white">{r.razon_social}</div>
                          {r.cuit_emisor && (
                            <div className="text-xs text-[var(--text-faint)]">CUIT: {r.cuit_emisor}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold">
                          {moneyAR(saldoFactura(r.monto, r.monto_aplicado), r.moneda || "ARS")}
                        </td>
                        <td className="px-4 py-2.5">{r.fecha_vto || "—"}</td>
                        <td className={`px-4 py-2.5 ${st.tone === "bad" ? "text-[var(--red)]" : "text-[var(--text-dim)]"}`}>
                          {st.tone === "bad" ? antiguedadLabel(r.fecha_vto) : "Al día"}
                        </td>
                        <td className="px-4 py-2.5">
                          <EstadoCobranzaPill tone={st.tone}>{st.label}</EstadoCobranzaPill>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href="/finanzas/facturas/cobranzas" className="mr-2 text-xs text-[var(--violet-2)]">
                            Ver
                          </Link>
                          <Link href="/finanzas/comunicacion" className="text-xs text-[var(--text-dim)]">
                            {st.label === "Vencido" ? "Llamar" : "Recordar"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-[var(--border)] px-6 py-3 text-xs text-[var(--text-dim)]">
            Mostrando {visibles.length} resultados
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-0">
            <div className="border-b border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Cobros bancarios</h2>
                  <p className="text-xs text-[var(--text-dim)]">Transferencias y conciliación</p>
                </div>
                <Link href="/finanzas/conciliacion" className="text-xs font-medium text-[var(--violet-2)]">
                  Ver conciliación
                </Link>
              </div>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm text-[var(--text-dim)]">
                Los depósitos de la pasarela se imputan en{" "}
                <Link href="/finanzas/conciliacion" className="font-medium text-[var(--violet-2)]">
                  Conciliación
                </Link>
                .
              </p>
              <Link href="/finanzas/conciliacion" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
                Ir a conciliación
              </Link>
            </div>
          </div>
          <div className="panel p-0">
            <div className="border-b border-[var(--border)] p-4">
              <h2 className="text-base font-semibold text-white">Rendimiento Mensual</h2>
              <p className="text-xs text-[var(--text-dim)]">Cobranzas de los últimos 6 meses</p>
            </div>
            <div className="flex h-48 items-end justify-between gap-2 p-6">
              {["Ene", "Feb", "Mar", "Abr", "May", "Jun"].map((month, index) => {
                const heights = [45, 52, 48, 60, 55, 70];
                return (
                  <div key={month} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-sm bg-[var(--violet)]/80"
                      style={{ height: `${heights[index]}%` }}
                    />
                    <span className="text-xs text-[var(--text-dim)]">{month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</p>
          <p className="font-mono text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`} />
      </div>
      <div className={`mt-4 h-0.5 w-full rounded-full ${accent}`} />
    </div>
  );
}
