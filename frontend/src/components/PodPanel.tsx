"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, RefreshCw, X } from "lucide-react";
import {
  decidirPod,
  listPods,
  resumenPods,
  type PodCaso,
  type ResumenPods,
} from "@/lib/api";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, KpiCard, Pill } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type Filtro = "pendiente" | "ok" | "rechazado" | "todos";

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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </p>
      <div className="mt-1 text-sm text-white">{children}</div>
    </div>
  );
}

function PodDetalleModal({
  caso,
  busyId,
  onClose,
  onVerFoto,
  onDecidir,
}: {
  caso: PodCaso;
  busyId: string | null;
  onClose: () => void;
  onVerFoto: () => void;
  onDecidir: (estado: "ok" | "rechazado") => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-detalle-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 id="pod-detalle-title" className="text-lg font-semibold text-white">
              {caso.codigo}
            </h3>
            <div className="mt-1.5">
              <Pill
                color={
                  caso.estado === "ok"
                    ? "#22c55e"
                    : caso.estado === "rechazado"
                      ? "#ef4444"
                      : "#f59e0b"
                }
              >
                {caso.estadoLabel}
              </Pill>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Receptor">{caso.receptor}</Campo>
            <Campo label="Chofer">
              <div>{caso.chofer}</div>
              <div className="text-xs text-[var(--text-faint)]">{caso.telefono}</div>
            </Campo>
            <Campo label="Pedido / viaje">{caso.viaje}</Campo>
            <Campo label="Registrado">{fmtFecha(caso.createdAt)}</Campo>
            <div className="sm:col-span-2">
              <Campo label="Destino">{caso.destino}</Campo>
            </div>
            {caso.notaChofer && (
              <div className="sm:col-span-2">
                <Campo label="Resumen lectura">{caso.notaChofer}</Campo>
              </div>
            )}
          </div>

          {caso.imagenUrl && (
            <button
              type="button"
              onClick={onVerFoto}
              className="mt-4 text-sm font-medium text-[var(--violet-2)] hover:underline"
            >
              Ver foto de evidencia
            </button>
          )}

          {(caso.historial?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Historial
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-[var(--text-faint)]">
                {(caso.historial || []).slice(-6).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {caso.estado === "pendiente" && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("rechazado")}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <X size={14} />
              Rechazar
            </button>
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("ok")}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check size={14} />
              Confirmar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PodPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<PodCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenPods | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ src: string; title: string } | null>(null);
  const [detalle, setDetalle] = useState<PodCaso | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listPods({
          limit: 100,
          estado: filtro === "todos" ? undefined : filtro,
        }),
        resumenPods(),
      ]);
      setRows(list);
      setResumen(sum);
      setDetalle((cur) => {
        if (!cur) return null;
        return list.find((r) => r.id === cur.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar POD");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(
    () => [
      { label: "Pendientes", value: String(resumen?.pendientes ?? "—"), hint: "por confirmar" },
      { label: "OK", value: String(resumen?.ok ?? "—"), hint: "confirmados" },
      { label: "Rechazados", value: String(resumen?.rechazados ?? "—"), hint: "a rehacer" },
      {
        label: "En diálogo WA",
        value: String(resumen?.en_dialogo ?? "—"),
        hint: "pidiendo receptor/foto",
      },
    ],
    [resumen],
  );

  async function decidir(g: PodCaso, estado: "ok" | "rechazado") {
    const ok = await confirm({
      title: estado === "ok" ? "Confirmar POD" : "Rechazar POD",
      message: `${g.codigo} · Receptor: ${g.receptor}\n${g.chofer} · ${g.destino}`,
      confirmLabel: estado === "ok" ? "Confirmar" : "Rechazar",
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await decidirPod(g.id, { estado, notificar: true });
      setDetalle(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude actualizar");
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
            <h3 className="font-semibold text-white">Constancias de entrega (POD)</h3>
            <p className="text-xs text-[var(--text-faint)]">
              Clic en un registro para abrir el detalle
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["pendiente", "Pendientes"],
                ["ok", "OK"],
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
          <p className="text-sm text-[var(--text-dim)]">
            Todavía no hay POD. El chofer escribe “entregué” o “POD” por WhatsApp y completa
            receptor + foto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">POD</th>
                  <th className="py-2 pr-3 font-medium">Receptor</th>
                  <th className="py-2 pr-3 font-medium">Chofer</th>
                  <th className="py-2 pr-3 font-medium">Destino</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setDetalle(g)}
                    className="cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/[0.04]"
                  >
                    <td className="py-3 pr-3 font-medium text-white">{g.codigo}</td>
                    <td className="max-w-[160px] truncate py-3 pr-3 text-white">{g.receptor}</td>
                    <td className="max-w-[140px] truncate py-3 pr-3 text-[var(--text-dim)]">
                      {g.chofer}
                    </td>
                    <td className="max-w-[220px] truncate py-3 pr-3 text-[var(--text-dim)]">
                      {g.destino === "—" ? "—" : g.destino}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill
                        color={
                          g.estado === "ok"
                            ? "#22c55e"
                            : g.estado === "rechazado"
                              ? "#ef4444"
                              : "#f59e0b"
                        }
                      >
                        {g.estadoLabel}
                      </Pill>
                    </td>
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      {g.estado === "pendiente" ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "ok")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Check size={14} />
                            OK
                          </button>
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "rechazado")}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <X size={14} />
                            Rechazar
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

      {detalle && (
        <PodDetalleModal
          caso={detalle}
          busyId={busyId}
          onClose={() => setDetalle(null)}
          onVerFoto={() => {
            const src = browsableMediaUrl(detalle.imagenUrl);
            if (src) setFoto({ src, title: detalle.codigo });
          }}
          onDecidir={(estado) => void decidir(detalle, estado)}
        />
      )}

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Foto POD"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
