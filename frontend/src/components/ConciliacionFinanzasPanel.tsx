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
import { Card, Pill, SectionTitle } from "@/components/ui";

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
      setError("Elegí la factura a cobrar");
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

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Aviso de pasarela</SectionTitle>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          De entrada el cobro entra por API. Acá podés cargar el aviso (como si llegara el webhook) y
          el agente intenta matchear con la factura.
        </p>
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
      </Card>

      <Card>
        <SectionTitle>Cobros</SectionTitle>
        {cobros.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Todavía no llegó ningún cobro de la pasarela.</p>
        ) : (
          <div className="space-y-3">
            {abiertas.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1 block text-[11px] uppercase text-[var(--text-faint)]">
                  Factura para match manual
                </span>
                <select
                  className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
                  value={facturaId}
                  onChange={(e) => setFacturaId(e.target.value)}
                >
                  <option value="">Elegí factura a cobrar</option>
                  {abiertas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.numero} · {f.razon_social} · {moneyAR(saldoFactura(f.monto, f.monto_aplicado))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-[var(--text-faint)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Ref</th>
                    <th className="py-2 pr-3 font-medium">Monto</th>
                    <th className="py-2 pr-3 font-medium">Factura</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {cobros.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-3 font-mono text-white">{c.external_ref || c.id}</td>
                      <td className="py-2.5 pr-3">{moneyAR(c.monto, c.moneda || "ARS")}</td>
                      <td className="py-2.5 pr-3">{c.factura_numero || "—"}</td>
                      <td className="py-2.5 pr-3">
                        <Pill color={c.estado === "aplicado" ? "#22c55e" : "#f59e0b"}>{c.estado}</Pill>
                      </td>
                      <td className="py-2.5">
                        {c.estado !== "aplicado" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void match(c.id)}
                            className="text-xs font-semibold text-[var(--violet-2)] hover:underline"
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
          </div>
        )}
      </Card>
    </div>
  );
}
