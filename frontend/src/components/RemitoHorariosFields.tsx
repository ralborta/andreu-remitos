"use client";

import { ORDEN_HORARIOS } from "@/lib/remitos-ui";

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
        {ORDEN_HORARIOS.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              {label}
            </span>
            <input
              type="time"
              step={60}
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)] [color-scheme:dark]"
              value={horas[key] ?? ""}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder="HH:MM"
            />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-faint)]">
        Orden: entrada carga → salida carga → llegada descarga → inicio descarga → fin descarga
      </p>
    </div>
  );
}
