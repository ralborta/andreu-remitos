"use client";

import { useCallback, useEffect, useState } from "react";
import {
  comunicarFacturaFinanzas,
  listFacturasFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";
import { Card, SectionTitle } from "@/components/ui";

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
    setSelected((prev) => abiertas.find((f) => f.id === prev?.id) || null);
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
      if (out.envio.ok) setOk("WhatsApp enviado y paso registrado.");
      else setOk(`Paso registrado. El envío no salió: ${out.envio.error || "sin canal"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo contactar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>Clientes a contactar</SectionTitle>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          WhatsApp de cobranza, no de choferes. Cada envío queda como paso en la factura.
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No hay saldos abiertos.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setOk(null);
                    setError(null);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selected?.id === r.id ? "bg-[var(--violet)]/20 text-white" : "hover:bg-white/5 text-[var(--text)]"
                  }`}
                >
                  <span className="font-medium">{r.razon_social}</span>
                  <span className="ml-2 font-mono text-xs text-[var(--text-faint)]">{r.numero}</span>
                  <span className="ml-2 text-xs">{moneyAR(saldoFactura(r.monto, r.monto_aplicado))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionTitle>Mensaje</SectionTitle>
        {!selected ? (
          <p className="text-sm text-[var(--text-dim)]">Elegí un cliente.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-dim)]">
              {selected.razon_social} · {selected.telefono || "sin teléfono"} · vto {selected.fecha_vto || "—"}
            </p>
            <textarea
              className="min-h-28 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
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
              {busy ? "Enviando…" : "Contactar por WhatsApp"}
            </button>
            {(selected.pasos || []).length > 0 && (
              <ol className="space-y-1.5 pt-2">
                {selected.pasos.map((p, i) => (
                  <li key={`${p.at}-${i}`} className="text-xs text-[var(--text-dim)]">
                    {i + 1}. {p.label}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
