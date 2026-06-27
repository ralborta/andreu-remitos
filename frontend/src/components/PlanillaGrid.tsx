"use client";

import clsx from "clsx";
import type { PlanillaColumn, PlanillaFila } from "@/lib/planilla-types";

/** Grilla densa estilo Excel con la línea gráfica Andreu (oscuro, bordes, tabular). */
export function PlanillaGrid({
  columnas,
  filas,
}: {
  columnas: PlanillaColumn[];
  filas: PlanillaFila[];
}) {
  return (
    <div className="planilla-sheet overflow-hidden rounded-xl border border-[var(--border)] bg-[#0c0918] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
        <span className="rounded-md bg-[var(--violet)]/20 px-2 py-0.5 text-[11px] font-semibold text-[var(--violet-2)] ring-1 ring-[var(--violet)]/30">
          Hoja 1
        </span>
        <span className="text-xs text-[var(--text-faint)]">
          {filas.length} filas · {columnas.length} columnas
        </span>
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-auto scroll-thin">
        <table className="border-collapse text-[12px] leading-tight">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#12102a]">
              <th className="sticky left-0 z-30 min-w-[36px] border border-[var(--border)] bg-[#1a1630] px-1.5 py-1.5 text-center text-[10px] font-medium text-[var(--text-faint)]">
                #
              </th>
              {columnas.map((col, i) => (
                <th
                  key={col.key}
                  style={{ minWidth: col.width ?? 88 }}
                  className="border border-[var(--border)] bg-[#12102a] px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]"
                  title={col.header}
                >
                  <span className="mr-1 text-[var(--text-faint)]">{colLetter(i)}</span>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={columnas.length + 1}
                  className="border border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--text-dim)]"
                >
                  No hay filas para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filas.map((fila, rowIdx) => (
                <tr
                  key={`${fila.remito_id}-${fila.orden}-${rowIdx}`}
                  className={clsx(
                    "transition-colors hover:bg-[var(--violet)]/[0.06]",
                    fila.orden === 1 ? "bg-[#0a0712]/40" : "bg-[#0d0a18]/60",
                  )}
                >
                  <td className="sticky left-0 z-10 border border-[var(--border)] bg-[#141028] px-1.5 py-1 text-center tabular-nums text-[var(--text-faint)]">
                    {rowIdx + 1}
                  </td>
                  {columnas.map((col) => {
                    const val = fila[col.key];
                    const empty = val == null || val === "";
                    return (
                      <td
                        key={col.key}
                        className={clsx(
                          "max-w-[200px] truncate border border-[var(--border)] px-2 py-1 align-middle tabular-nums",
                          empty ? "text-[var(--text-faint)]/40" : "text-[var(--text)]",
                          (col.key.includes("hora") || col.key.includes("nro") || col.key.includes("cantidad") || col.key.includes("producto_pla")) &&
                            "font-mono text-[11px]",
                        )}
                        title={empty ? "" : String(val)}
                      >
                        {empty ? "" : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function colLetter(i: number) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
