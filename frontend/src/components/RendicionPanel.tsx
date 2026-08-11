"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, RefreshCw, X } from "lucide-react";
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
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type Filtro = "todos" | "pendiente_aprobacion" | "aprobado" | "rechazado";

type FotoPreview = {
  src: string;
  title: string;
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RendicionPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<GastoRendicion[]>([]);
  const [resumen, setResumen] = useState<ResumenRendicion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente_aprobacion");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoPreview | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              Clic en un registro para ver el detalle y la transcripción
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
                {rows.map((g) => {
                  const open = expandedId === g.id;
                  return (
                    <Fragment key={g.id}>
                      <tr
                        onClick={() =>
                          setExpandedId((id) => (id === g.id ? null : g.id))
                        }
                        className={clsx(
                          "cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/[0.03]",
                          open && "bg-white/[0.04]",
                        )}
                      >
                        <td className="py-3 pr-3 font-medium text-white">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown
                              size={14}
                              className={clsx(
                                "shrink-0 text-[var(--text-faint)] transition-transform",
                                open && "rotate-180",
                              )}
                            />
                            {g.codigo}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-dim)]">
                          {g.choferNombre || "—"}
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-dim)]">{g.categoriaLabel}</td>
                        <td className="py-3 pr-3 tabular text-white">{g.montoLabel}</td>
                        <td className="max-w-[200px] truncate py-3 pr-3 text-[var(--text-dim)]">
                          {g.proveedor || g.descripcion || "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={clsx(
                              "rounded-md px-2 py-0.5 text-xs font-semibold",
                              g.estado === "pendiente_aprobacion" && "bg-amber-500/15 text-amber-400",
                              g.estado === "aprobado" && "bg-emerald-500/15 text-emerald-400",
                              g.estado === "rechazado" && "bg-rose-500/15 text-rose-500",
                            )}
                          >
                            {g.estadoLabel}
                          </span>
                        </td>
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          {g.estado === "pendiente_aprobacion" ? (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === g.id}
                                onClick={() => void decidir(g, "aprobado")}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                <Check size={14} />
                                OK
                              </button>
                              <button
                                type="button"
                                disabled={busyId === g.id}
                                onClick={() => void decidir(g, "rechazado")}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/30 disabled:opacity-50"
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
                      {open && (
                        <tr className="border-b border-[var(--border)]/60 bg-[var(--bg-2)]/80">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Resumen
                                </p>
                                <p className="mt-0.5 text-sm text-white">
                                  {g.descripcion || g.categoriaLabel}
                                  {g.montoLabel !== "—" ? ` · ${g.montoLabel}` : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Chofer
                                </p>
                                <p className="mt-0.5 text-sm text-white">{g.choferNombre || "—"}</p>
                                <p className="text-xs text-[var(--text-faint)]">{g.telefono || ""}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Proveedor / fecha
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                  {g.proveedor || "—"}
                                  {g.fechaComprobante ? ` · ${g.fechaComprobante}` : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Nota chofer
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                  {g.notaChofer || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Registrado
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                  {fmtFecha(g.createdAt)}
                                </p>
                              </div>
                              {g.imagenUrl && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                    Comprobante
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const src = browsableMediaUrl(g.imagenUrl);
                                      if (!src) return;
                                      setFoto({
                                        src,
                                        title: `${g.codigo} · ${g.categoriaLabel}`,
                                      });
                                    }}
                                    className="mt-0.5 text-sm text-[var(--violet-2)] hover:underline"
                                  >
                                    Ver foto
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="mt-3">
                              <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                Transcripción OCR (Document AI)
                              </p>
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 px-3 py-2 text-xs text-[var(--text-dim)]">
                                {g.textoOcr?.trim() ||
                                  "Sin transcripción aún (gastos anteriores a Document AI, o OCR vacío)."}
                              </pre>
                            </div>
                            {(g.historial?.length ?? 0) > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Historial
                                </p>
                                <ul className="mt-1 space-y-0.5 text-xs text-[var(--text-faint)]">
                                  {(g.historial || []).slice(-5).map((h) => (
                                    <li key={h}>{h}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Comprobante"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
