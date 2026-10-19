"use client";

import { useCallback, useEffect, useState } from "react";
import {
  conciliarCobroFinanzas,
  listCobrosFinanzas,
  listFacturasFinanzas,
  registrarCobroPasarela,
  type CobroFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "@/components/finanzas/EstadoCobranzaPill";

export function ConciliacionFinanzasPanel() {
  const [cobros, setCobros] = useState<CobroFinanzas[]>([]);
  const [facturas, setFacturas] = useState<FacturaFinanzas[]>([]);
  const [facturaId, setFacturaId] = useState("");
  const [monto, setMonto] = useState("");
  const [numero, setNumero] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, f] = await Promise.all([
        listCobrosFinanzas({ limit: 200 }),
        listFacturasFinanzas({ tipo: "cobrar", limit: 200 }),
      ]);
      setCobros(c);
      setFacturas(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar conciliación");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function simularPasarela() {
    const n = Number(monto.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("Ingresá el monto que avisó la pasarela");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registrarCobroPasarela({
        monto: n,
        numero_factura: numero || undefined,
      });
      setMonto("");
      setNumero("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el cobro");
    } finally {
      setBusy(false);
    }
  }

  async function match(id: string) {
    if (!facturaId) {
      setError("Elegí la factura a cobrar en el listado de la derecha");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await conciliarCobroFinanzas(id, facturaId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conciliar");
    } finally {
      setBusy(false);
    }
  }

  const abiertas = facturas.filter((f) => saldoFactura(f.monto, f.monto_aplicado) > 0);
  const pendientes = cobros.filter((c) => c.estado !== "aplicado");
  const aplicados = cobros.filter((c) => c.estado === "aplicado");
  const ingreso = cobros.reduce((s, c) => s + Number(c.monto || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Conciliación de Cobros</h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">
          Emparejá avisos de la pasarela con facturas a cobrar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Ingresos</p>
          <p className="mt-2 text-2xl font-bold text-white">{moneyAR(ingreso)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Pendientes</p>
          <p className="mt-2 text-2xl font-bold text-[#f59e0b]">{pendientes.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Conciliados</p>
          <p className="mt-2 text-2xl font-bold text-white">{aplicados.length}</p>
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Aviso de pasarela</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Monto acreditado"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Nº factura (si vino en la referencia)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void simularPasarela()}
            className="rounded-xl bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Registrar cobro
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-[var(--red)]">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <h2 className="text-sm font-semibold text-white">Transferencias</h2>
            <EstadoCobranzaPill tone="warn">{pendientes.length} pendientes</EstadoCobranzaPill>
          </div>
          {cobros.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">Todavía no llegó ningún cobro de la pasarela.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase text-[var(--text-faint)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Ref</th>
                    <th className="px-4 py-2 font-medium">Monto</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {cobros.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-white">{c.external_ref || c.id}</div>
                        <div className="text-[11px] text-[var(--text-faint)]">{c.factura_numero || "sin factura"}</div>
                      </td>
                      <td className="px-4 py-2.5">{moneyAR(c.monto, c.moneda || "ARS")}</td>
                      <td className="px-4 py-2.5">
                        <EstadoCobranzaPill tone={c.estado === "aplicado" ? "ok" : "warn"}>
                          {c.estado === "aplicado" ? "Conciliado" : "Pendiente"}
                        </EstadoCobranzaPill>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.estado !== "aplicado" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void match(c.id)}
                            className="rounded-lg bg-[var(--violet)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Conciliar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] p-4">
            <h2 className="text-sm font-semibold text-white">Facturas abiertas</h2>
            <p className="text-xs text-[var(--text-dim)]">Elegí una y después Conciliar a la izquierda</p>
          </div>
          {abiertas.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">No hay saldos abiertos.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {abiertas.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setFacturaId(f.id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                      facturaId === f.id ? "bg-[var(--violet)]/20" : "hover:bg-white/5"
                    }`}
                  >
                    <span>
                      <span className="font-mono text-[var(--violet-2)]">{f.numero}</span>
                      <span className="ml-2 text-white">{f.razon_social}</span>
                    </span>
                    <span className="tabular text-white">{moneyAR(saldoFactura(f.monto, f.monto_aplicado))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
