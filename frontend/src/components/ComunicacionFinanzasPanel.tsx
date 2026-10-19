"use client";

import { useCallback, useEffect, useState } from "react";
import {
  comunicarFacturaFinanzas,
  listFacturasFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { estadoCobranza, moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { EstadoCobranzaPill } from "@/components/finanzas/EstadoCobranzaPill";

export function ComunicacionFinanzasPanel() {
  const [rows, setRows] = useState<FacturaFinanzas[]>([]);
  const [selected, setSelected] = useState<FacturaFinanzas | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await listFacturasFinanzas({ tipo: "cobrar", limit: 200 });
    const abiertas = data.filter((f) => saldoFactura(f.monto, f.monto_aplicado) > 0);
    setRows(abiertas);
    setSelected((prev) => abiertas.find((f) => f.id === prev?.id) || abiertas[0] || null);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, [load]);

  async function enviar() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const out = await comunicarFacturaFinanzas(selected.id, {
        canal: "whatsapp",
        mensaje: mensaje || undefined,
      });
      setSelected(out.factura);
      setRows((prev) => prev.map((r) => (r.id === out.factura.id ? out.factura : r)));
      setMensaje("");
      if (out.envio.ok) setOk("WhatsApp enviado y paso registrado.");
      else setOk(`Paso registrado. El envío no salió: ${out.envio.error || "sin canal"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo contactar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[var(--font-display)] text-2xl font-bold text-white">Comunicación</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">WhatsApp de cobranza. Cada envío queda como paso.</p>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] lg:grid-cols-[280px_1fr]">
        <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">WhatsApp</p>
            <p className="text-xs text-[var(--text-dim)]">Chats activos</p>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-dim)]">No hay saldos abiertos.</p>
          ) : (
            <ul>
              {rows.map((r) => {
                const st = estadoCobranza(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setOk(null);
                        setError(null);
                      }}
                      className={`w-full border-b border-[var(--border)] px-4 py-3 text-left ${
                        selected?.id === r.id ? "bg-[var(--violet)]/15" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">{r.razon_social}</span>
                        <EstadoCobranzaPill tone={st.tone}>{st.label}</EstadoCobranzaPill>
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--text-faint)]">
                        {r.numero} · {moneyAR(saldoFactura(r.monto, r.monto_aplicado))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex min-h-[420px] flex-col p-4">
          {!selected ? (
            <p className="text-sm text-[var(--text-dim)]">Elegí un cliente.</p>
          ) : (
            <>
              <div className="border-b border-[var(--border)] pb-3">
                <p className="font-medium text-white">{selected.razon_social}</p>
                <p className="text-xs text-[var(--text-dim)]">
                  {selected.telefono || "sin teléfono"} · vto {selected.fecha_vto || "—"} · {selected.numero}
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {(selected.pasos || []).map((p, i) => (
                  <div key={`${p.at}-${i}`} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-[var(--text)]">
                    {p.label}
                    <div className="mt-1 text-[11px] text-[var(--text-faint)]">
                      {p.at ? new Date(p.at).toLocaleString("es-AR") : ""}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Vacío = el agente arma el recordatorio"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />
              {error && <p className="mt-2 text-sm text-[var(--red)]">{error}</p>}
              {ok && <p className="mt-2 text-sm text-[var(--green)]">{ok}</p>}
              <button
                type="button"
                disabled={busy}
                onClick={() => void enviar()}
                className="mt-3 w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar WhatsApp"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
