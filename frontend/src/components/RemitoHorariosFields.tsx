"use client";

import clsx from "clsx";
import { ORDEN_HORARIOS } from "@/lib/remitos-ui";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

/** HH:MM válido para guardar (00:00–23:59). */
export function horaValidaUi(hora: string | undefined | null): boolean {
  if (!hora?.trim()) return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function normalizarHoraInput(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  const compact = s.replace(/\D/g, "");
  if (compact.length === 4) return `${compact.slice(0, 2)}:${compact.slice(2)}`;
  if (compact.length === 3) return `0${compact[0]}:${compact.slice(1)}`;
  return s;
}

export function RemitoHorariosFields({
  horas,
  onChange,
}: {
  horas: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        Horarios (5 hs del remito)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ORDEN_HORARIOS.map(({ key, label }) => {
          const v = horas[key] ?? "";
          const invalido = Boolean(v) && !horaValidaUi(v);
          return (
            <label key={key} className="block">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                {label}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={clsx(
                  inputCls,
                  invalido && "border-[var(--amber)]/60 ring-1 ring-[var(--amber)]/30",
                )}
                value={v}
                onChange={(e) => onChange(key, e.target.value)}
                onBlur={(e) => {
                  const n = normalizarHoraInput(e.target.value);
                  if (n !== e.target.value) onChange(key, n);
                }}
                placeholder="HH:MM"
              />
              {invalido && (
                <span className="mt-0.5 block text-[10px] text-[var(--amber)]">
                  Hora inválida ({v}) — corregir a HH:MM
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--text-faint)]">
        Orden: entrada carga → salida carga → llegada descarga → inicio descarga → fin descarga
      </p>
    </div>
  );
}
