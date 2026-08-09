"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, RefreshCw, X } from "lucide-react";
import {
  decidirGastoRendicion,
  listGastosRendicion,
  resumenRendicion,
  type GastoRendicion,
  type ResumenRendicion,
} from "@/lib/api";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, KpiCard } from "./ui";
import { useConfirm } from "@/lib/confirm-context";

type Filtro = "todos" | "pendiente_aprobacion" | "aprobado" | "rechazado";

export function RendicionPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<GastoRendicion[]>([]);
  const [resumen, setResumen] = useState<ResumenRendicion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente_aprobacion");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listGastosRendicion({
          limit: 100,
          estado: filtro === "todos" ? undefined : filtro,
        }),
        resumenRendicion(),
      ]);
      setRows(list);
      setResumen(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar rendiciones");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(
    () => [
      { label: "Pendientes", value: String(resumen?.pendientes ?? "—"), hint: "esperan OK humano" },
      {
        label: "Monto pendiente",
        value: resumen ? `$${Math.round(resumen.monto_pendiente).toLocaleString("es-AR")}` : "—",
        hint: "a revisar",
      },
      { label: "Aprobados", value: String(resumen?.aprobados ?? "—"), hint: "del período" },
      { label: "Rechazados", value: String(resumen?.rechazados ?? "—"), hint: "del período" },
    ],
    [resumen],
  );

  async function decidir(g: GastoRendicion, estado: "aprobado" | "rechazado") {
    const ok = await confirm({
      title: estado === "aprobado" ? "Aprobar gasto" : "Rechazar gasto",
      message: `${g.codigo} · ${g.categoriaLabel} · ${g.montoLabel}\n${g.choferNombre || g.telefono || ""}`,
      confirmLabel: estado === "aprobado" ? "Aprobar" : "Rechazar",
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await decidirGastoRendicion(g.id, { estado });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude decidir");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Cola de aprobación</h3>
            <p className="text-xs text-[var(--text-faint)]">
              Gastos menores (nafta, peajes, arreglos…) · siempre con verificación humana
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["pendiente_aprobacion", "Pendientes"],
                ["aprobado", "Aprobados"],
                ["rechazado", "Rechazados"],
                ["todos", "Todos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs",
                  filtro === id
                    ? "bg-[var(--violet)] text-white"
                    : "bg-white/5 text-[var(--text-dim)] hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-[var(--text-dim)] hover:bg-white/10"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No hay gastos en este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Código</th>
                  <th className="py-2 pr-3 font-medium">Chofer</th>
                  <th className="py-2 pr-3 font-medium">Categoría</th>
                  <th className="py-2 pr-3 font-medium">Monto</th>
                  <th className="py-2 pr-3 font-medium">Detalle</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 pr-3 font-medium text-white">{g.codigo}</td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">
                      <div>{g.choferNombre || "—"}</div>
                      <div className="text-xs text-[var(--text-faint)]">{g.telefono || ""}</div>
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">{g.categoriaLabel}</td>
                    <td className="py-3 pr-3 tabular text-white">{g.montoLabel}</td>
                    <td className="max-w-[240px] py-3 pr-3 text-[var(--text-dim)]">
                      <div className="truncate">{g.proveedor || g.descripcion || g.notaChofer || "—"}</div>
                      {g.imagenUrl && (
                        <a
                          href={browsableMediaUrl(g.imagenUrl) || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-[var(--violet-2)] hover:underline"
                        >
                          Ver foto
                        </a>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={clsx(
                          "rounded-md px-2 py-0.5 text-xs",
                          g.estado === "pendiente_aprobacion" && "bg-amber-500/15 text-amber-300",
                          g.estado === "aprobado" && "bg-emerald-500/15 text-emerald-300",
                          g.estado === "rechazado" && "bg-rose-500/15 text-rose-300",
                        )}
                      >
                        {g.estadoLabel}
                      </span>
                    </td>
                    <td className="py-3">
                      {g.estado === "pendiente_aprobacion" ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "aprobado")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            <Check size={14} />
                            OK
                          </button>
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "rechazado")}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                          >
                            <X size={14} />
                            No
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
