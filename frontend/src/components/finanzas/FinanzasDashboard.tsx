"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFinanzasResumen, listFacturasFinanzas, type FacturaFinanzas, type FinanzasResumen } from "@/lib/api";
import { antiguedadLabel, estadoCobranza, moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "./EstadoCobranzaPill";

export function FinanzasDashboard() {
  const [resumen, setResumen] = useState<FinanzasResumen | null>(null);
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

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

  const visibles = rows.filter((r) => {
    if (!q.trim()) return true;
    const hay = `${r.numero} ${r.razon_social}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-white">Dashboard de Cobranzas</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">Resumen operativo. Las a pagar se leen en Facturas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/finanzas/conciliacion"
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--panel-2)]"
          >
            Conciliar
          </Link>
          <Link
            href="/finanzas/comunicacion"
            className="rounded-lg bg-[var(--violet)] px-3 py-2 text-sm font-semibold text-white"
          >
            Contactar
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Deuda pendiente"
          value={moneyAR(resumen?.cartera_abierta)}
          hint={`${resumen?.facturas_cobrar ?? "—"} facturas a cobrar`}
        />
        <Kpi
          label="Vencidas"
          value={String(resumen?.vencidas ?? "—")}
          hint="Saldo abierto pasado de vto"
        />
        <Kpi
          label="Eficiencia de cobro"
          value={resumen ? `${resumen.eficiencia}%` : "—"}
          hint="Cobrado vs cartera + cobrado"
        />
        <Kpi
          label="Depósitos a conciliar"
          value={moneyAR(resumen?.pendiente_conciliar)}
          hint={`${resumen?.cobros_pendientes ?? 0} avisos de pasarela`}
          href="/finanzas/conciliacion"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="panel p-5 lg:col-span-8">
          <h2 className="text-sm font-semibold text-white">Cobros bancarios</h2>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            El dinero entra por la pasarela. Si hay pendientes de imputar, se gestionan en Conciliación.
            Las facturas a pagar no se concilian acá.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/finanzas/conciliacion"
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--violet)]/50"
            >
              Ver transferencias
              <span className="text-[var(--violet-2)]">→</span>
            </Link>
            <Link
              href="/finanzas/facturas"
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--violet)]/50"
            >
              Bandeja de facturas
              <span className="text-[var(--violet-2)]">→</span>
            </Link>
          </div>
        </div>
        <div className="panel p-5 lg:col-span-4">
          <h2 className="text-sm font-semibold text-white">A pagar (PDF)</h2>
          <p className="mt-2 text-2xl font-bold text-white">{resumen?.facturas_pagar ?? 0}</p>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Solo entran subiendo el PDF del proveedor. No hay alta en blanco.
          </p>
          <Link href="/finanzas/facturas" className="mt-3 inline-block text-sm font-medium text-[var(--violet-2)]">
            Cargar PDF
          </Link>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Cobranzas pendientes</h2>
            <p className="text-xs text-[var(--text-dim)]">Facturas abiertas y por vencer</p>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-1.5 text-sm text-white sm:w-56"
          />
        </div>
        {visibles.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-dim)]">
            {error ? "Sin datos." : "No hay saldos abiertos."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Factura</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  <th className="px-4 py-3 font-medium">Antigüedad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const st = estadoCobranza(r);
                  return (
                    <tr key={r.id} className="border-t border-[var(--border)] hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 font-mono text-[var(--violet-2)]">{r.numero}</td>
                      <td className="px-4 py-2.5 text-white">{r.razon_social}</td>
                      <td className="px-4 py-2.5 tabular text-white">
                        {moneyAR(saldoFactura(r.monto, r.monto_aplicado), r.moneda || "ARS")}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-dim)]">{r.fecha_vto || "—"}</td>
                      <td
                        className={`px-4 py-2.5 ${st.tone === "bad" ? "text-[var(--red)]" : st.tone === "warn" ? "text-[#f59e0b]" : "text-[var(--text-dim)]"}`}
                      >
                        {antiguedadLabel(r.fecha_vto)}
                      </td>
                      <td className="px-4 py-2.5">
                        <EstadoCobranzaPill tone={st.tone}>{st.label}</EstadoCobranzaPill>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href="/finanzas/comunicacion"
                          className="text-xs font-semibold text-[var(--violet-2)] hover:underline"
                        >
                          Contactar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[var(--border)] p-3 text-center">
          <Link href="/finanzas/facturas" className="text-sm font-medium text-[var(--violet-2)] hover:underline">
            Ver todas las facturas
          </Link>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
      <p className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-dim)]">{hint}</p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="panel panel-hover block p-4">
        {inner}
      </Link>
    );
  }
  return <div className="panel p-4">{inner}</div>;
}
