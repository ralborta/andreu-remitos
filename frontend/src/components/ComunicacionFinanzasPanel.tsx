"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  comunicarFacturaFinanzas,
  listFacturasFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";

export function ComunicacionFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const data = await listFacturasFinanzas({ tipo: "cobrar", limit: 200 });
    setRows(data.filter((f) => saldoFactura(f.monto, f.monto_aplicado) > 0));
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, [load]);

  const visibles = useMemo(
    () =>
      rows.filter((r) =>
        `${r.razon_social} ${r.numero}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [rows, q],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function enviar() {
    if (selected.size === 0) {
      setError("Elegí al menos un cliente");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    let okCount = 0;
    let fail = 0;
    try {
      for (const id of selected) {
        const out = await comunicarFacturaFinanzas(id, {
          canal,
          mensaje: mensaje || undefined,
        });
        if (out.envio.ok) okCount += 1;
        else fail += 1;
      }
      await load();
      setOk(`${okCount} enviados. ${fail} con aviso (paso igual registrado).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Enviar Mensaje</h1>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">
          Seleccioná clientes y mandá WhatsApp o email de cobranza
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente..."
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
            />
          </div>
          <ul>
            {visibles.map((r) => (
              <li key={r.id} className="border-b border-[var(--border)]">
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="flex-1">
                    <span className="font-medium text-white">{r.razon_social}</span>
                    <span className="ml-2 font-mono text-xs text-[var(--text-faint)]">{r.numero}</span>
                  </span>
                  <span className="tabular">{moneyAR(saldoFactura(r.monto, r.monto_aplicado))}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel space-y-3 p-5">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase text-[var(--text-faint)]">Canal</span>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as "whatsapp" | "email")}
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>
          <textarea
            className="min-h-32 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Vacío = el agente arma el recordatorio"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          {ok && <p className="text-sm text-[var(--green)]">{ok}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void enviar()}
            className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Enviando…" : `Enviar a ${selected.size} cliente(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
