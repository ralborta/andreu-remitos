"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import {
  decidirReclamo,
  listReclamos,
  resumenReclamos,
  type ReclamoCaso,
  type ResumenReclamos,
} from "@/lib/api";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, CritBadge, KpiCard, Pill } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type Filtro = "abiertos" | "nuevo" | "en_proceso" | "escalado" | "resuelto" | "todos";

type FotoPreview = { src: string; title: string };

function estadoColor(estado: string) {
  if (estado === "resuelto") return "#22c55e";
  if (estado === "escalado") return "#f59e0b";
  if (estado === "en_proceso") return "#38bdf8";
  if (estado === "nuevo") return "#d946ef";
  return "#a79fc9";
}

export function ReclamosPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<ReclamoCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenReclamos | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("abiertos");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoPreview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const estadoApi =
        filtro === "abiertos" || filtro === "todos" ? undefined : filtro;
      const [list, sum] = await Promise.all([
        listReclamos({ limit: 100, estado: estadoApi }),
        resumenReclamos(),
      ]);
      const filtered =
        filtro === "abiertos"
          ? list.filter((r) => ["nuevo", "en_proceso", "escalado"].includes(r.estado))
          : list;
      setRows(filtered);
      setResumen(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar reclamos");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(
    () => [
      { label: "Abiertos", value: String(resumen?.abiertos ?? "—"), hint: "activos" },
      { label: "Nuevos", value: String(resumen?.nuevo ?? "—"), hint: "recién abiertos" },
      { label: "Escalados", value: String(resumen?.escalado ?? "—"), hint: "prioridad" },
      { label: "Resueltos", value: String(resumen?.resuelto ?? "—"), hint: "cerrados" },
    ],
    [resumen],
  );

  async function decidir(
    g: ReclamoCaso,
    estado: "en_proceso" | "escalado" | "resuelto",
  ) {
    const labels = {
      en_proceso: "Tomar en proceso",
      escalado: "Escalar",
      resuelto: "Marcar resuelto",
    };
    const ok = await confirm({
      title: labels[estado],
      message: `${g.id} · ${g.motivoLabel} · ${g.cliente}\n${g.viaje !== "—" ? g.viaje : g.resumen || ""}`,
      confirmLabel: labels[estado],
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await decidirReclamo(g.id, { estado });
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
            <h3 className="font-semibold text-white">Reclamos en gestión</h3>
            <p className="text-xs text-[var(--text-faint)]">
              Clientes por WhatsApp · diálogo 100% IA · clasificación y escalamiento
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["abiertos", "Abiertos"],
                ["nuevo", "Nuevos"],
                ["en_proceso", "En proceso"],
                ["escalado", "Escalados"],
                ["resuelto", "Resueltos"],
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
            Todavía no hay reclamos abiertos. Cuando un cliente escriba por WhatsApp, aparecen acá.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Reclamo</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Viaje</th>
                  <th className="py-2 pr-3 font-medium">Motivo</th>
                  <th className="py-2 pr-3 font-medium">Canal</th>
                  <th className="py-2 pr-3 font-medium">Criticidad</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">SLA</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 pr-3 font-medium text-white">{g.id}</td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">
                      <div>{g.cliente}</div>
                      <div className="text-xs text-[var(--text-faint)]">{g.telefono || ""}</div>
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">{g.viaje}</td>
                    <td className="max-w-[200px] py-3 pr-3 text-[var(--text-dim)]">
                      <div>{g.motivoLabel}</div>
                      {(g.resumen || g.detalle) && (
                        <div className="truncate text-xs text-[var(--text-faint)]">
                          {g.resumen || g.detalle}
                        </div>
                      )}
                      {g.imagenUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const src = browsableMediaUrl(g.imagenUrl);
                            if (!src) return;
                            setFoto({
                              src,
                              title: `${g.id} · ${g.motivoLabel}`,
                            });
                          }}
                          className="mt-1 inline-block text-xs text-[var(--violet-2)] hover:underline"
                        >
                          Ver foto
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill color={g.canal === "WhatsApp" ? "#25d366" : "#a78bfa"}>{g.canal}</Pill>
                    </td>
                    <td className="py-3 pr-3">
                      {g.criticidadLabel !== "—" ? (
                        <CritBadge level={g.criticidadLabel as "Alta" | "Media" | "Baja"} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill color={estadoColor(g.estado)}>{g.estadoLabel}</Pill>
                    </td>
                    <td
                      className={clsx(
                        "py-3 pr-3 text-xs",
                        g.sla === "Por vencer" ? "text-[var(--amber)]" : "text-[var(--text-dim)]",
                      )}
                    >
                      {g.sla}
                    </td>
                    <td className="py-3">
                      {g.estado === "resuelto" ? (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {g.estado === "nuevo" && (
                            <button
                              type="button"
                              disabled={busyId === g.id}
                              onClick={() => void decidir(g, "en_proceso")}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
                            >
                              Tomar
                            </button>
                          )}
                          {g.estado !== "escalado" && (
                            <button
                              type="button"
                              disabled={busyId === g.id}
                              onClick={() => void decidir(g, "escalado")}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                            >
                              <ArrowUpRight size={14} />
                              Escalar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "resuelto")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            <Check size={14} />
                            OK
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Foto del reclamo"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
