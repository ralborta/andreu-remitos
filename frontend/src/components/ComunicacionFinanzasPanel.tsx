"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  comunicarFacturaFinanzas,
  listFacturasFinanzas,
  type FacturaFinanzas,
} from "@/lib/api";
import { moneyAR, saldoFactura } from "@/lib/finanzas-format";

const TEMPLATES = {
  whatsapp: {
    "Recordatorio corto":
      "Hola {nombre}, te recordamos la factura {numero}. Saldo {monto}, vence {vto}. ¿Me confirmás el pago?",
    "Factura vencida":
      "Hola {nombre}, la factura {numero} está vencida. Saldo {monto}. Contanos para regularizar.",
  },
  email: {
    "Recordatorio de pago":
      "Estimado/a {nombre},\n\nLe recordamos la factura {numero} con saldo {monto}, vencimiento {vto}.\n\nSaludos.",
    "Factura vencida":
      "Estimado/a {nombre},\n\nLa factura {numero} se encuentra vencida. Saldo {monto}.\n\nSaludos.",
  },
} as const;

function fill(tpl: string, f: FacturaFinanzas) {
  return tpl
    .replaceAll("{nombre}", f.razon_social || "")
    .replaceAll("{numero}", f.numero || "")
    .replaceAll("{monto}", moneyAR(saldoFactura(f.monto, f.monto_aplicado), f.moneda || "ARS"))
    .replaceAll("{vto}", f.fecha_vto || "sin vencimiento");
}

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
        `${r.razon_social} ${r.numero} ${r.telefono}`.toLowerCase().includes(q.trim().toLowerCase()),
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

  function selectAll() {
    if (selected.size === visibles.length) setSelected(new Set());
    else setSelected(new Set(visibles.map((r) => r.id)));
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
        const fac = rows.find((r) => r.id === id);
        const text = fac && mensaje ? fill(mensaje, fac) : mensaje || undefined;
        const out = await comunicarFacturaFinanzas(id, { canal, mensaje: text });
        if (out.envio.ok) okCount += 1;
        else fail += 1;
      }
      await load();
      setOk(`${okCount} enviados. ${fail} con aviso (el paso quedó registrado).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  const tpls = TEMPLATES[canal];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Enviar Mensajes</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Comunicate con los clientes por WhatsApp o email, como en Constanza
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["whatsapp", "email"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCanal(c);
              setMensaje("");
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              canal === c ? "bg-[var(--violet)] text-white" : "border border-[var(--border)] text-[var(--text-dim)]"
            }`}
          >
            {c === "whatsapp" ? "WhatsApp" : "Email"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <div>
              <h2 className="text-base font-semibold text-white">Seleccionar Clientes</h2>
              <p className="text-xs text-[var(--text-dim)]">Quiénes reciben el mensaje</p>
            </div>
            <button type="button" onClick={selectAll} className="text-xs text-[var(--violet-2)]">
              {selected.size === visibles.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
          </div>
          <div className="p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, factura o teléfono..."
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 text-sm text-white"
            />
          </div>
          <ul className="max-h-[520px] overflow-y-auto">
            {visibles.map((r) => (
              <li key={r.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 border-t border-[var(--border)] px-4 py-3 text-sm ${
                    selected.has(r.id) ? "bg-[var(--violet)]/15" : "hover:bg-white/5"
                  }`}
                >
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{r.razon_social}</span>
                    <span className="text-xs text-[var(--text-faint)]">
                      {r.numero} · {r.telefono || "sin teléfono"}
                    </span>
                  </span>
                  <span className="tabular">{moneyAR(saldoFactura(r.monto, r.monto_aplicado))}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-white">Mensaje</h2>
          <div className="flex flex-wrap gap-1">
            {Object.entries(tpls).map(([name, tpl]) => (
              <button
                key={name}
                type="button"
                onClick={() => setMensaje(tpl)}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-dim)] hover:text-white"
              >
                {name}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-40 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Plantilla o texto. {nombre} {numero} {monto} {vto}"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
          <p className="text-[11px] text-[var(--text-faint)]">{mensaje.length} caracteres</p>
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
