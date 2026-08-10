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

export function PodPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<PodCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenPods | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ src: string; title: string } | null>(null);

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
              WhatsApp: foto del formulario/producto → la IA lee los datos · confirmación en mesa
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">POD</th>
                  <th className="py-2 pr-3 font-medium">Receptor</th>
                  <th className="py-2 pr-3 font-medium">Chofer</th>
                  <th className="py-2 pr-3 font-medium">Destino</th>
                  <th className="py-2 pr-3 font-medium">Foto</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    className="border-b border-[var(--border)]/60 hover:bg-white/[0.03]"
                  >
                    <td className="py-3 pr-3 font-medium text-white">
                      {g.codigo}
                      {g.viaje !== "—" && (
                        <div className="text-[10px] font-normal text-[var(--text-faint)]">
                          {g.viaje}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-white">{g.receptor}</td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">
                      <div>{g.chofer}</div>
                      <div className="text-xs text-[var(--text-faint)]">{g.telefono}</div>
                    </td>
                    <td className="max-w-[200px] py-3 pr-3 text-[var(--text-dim)]">
                      <div className="truncate">{g.destino}</div>
                      {g.notaChofer && (
                        <div className="mt-0.5 line-clamp-2 text-[10px] text-[var(--text-faint)]">
                          {g.notaChofer}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      {g.imagenUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            const src = browsableMediaUrl(g.imagenUrl);
                            if (src) setFoto({ src, title: g.codigo });
                          }}
                          className="text-xs text-[var(--violet-2)] hover:underline"
                        >
                          Ver foto
                        </button>
                      ) : (
                        "—"
                      )}
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
                    <td className="py-3">
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

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Foto POD"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
