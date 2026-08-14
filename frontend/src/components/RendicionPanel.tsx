"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ImageIcon, RefreshCw, Search, X } from "lucide-react";
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

/** Fecha corta para la cola (comprobante o alta). */
function fmtFechaCola(g: GastoRendicion) {
  const raw = g.fechaComprobante || g.createdAt || null;
  if (!raw) return "—";
  // YYYY-MM-DD o ISO
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return raw;
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

function RechazoMotivoModal({
  caso,
  busy,
  onClose,
  onConfirm,
}: {
  caso: GastoRendicion;
  busy: boolean;
  onClose: () => void;
  onConfirm: (nota: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [touched, setTouched] = useState(false);
  const motivo = nota.trim();
  const invalid = !motivo;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rechazo-motivo-title"
      >
        <h3 id="rechazo-motivo-title" className="text-lg font-semibold text-white">
          Rechazar gasto
        </h3>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          {caso.codigo} · {caso.categoriaLabel} · {caso.montoLabel}
          {caso.choferNombre ? ` · ${caso.choferNombre}` : ""}
        </p>
        <label className="mt-4 block text-xs font-medium text-[var(--text-faint)]">
          Comentario de rechazo <span className="text-rose-400">*</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            required
            placeholder="Ej. comprobante ilegible, monto incorrecto…"
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-[var(--violet)]/40"
          />
        </label>
        {touched && invalid && (
          <p className="mt-1.5 text-xs text-rose-400">
            Tenés que indicar un comentario para rechazar.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg bg-white/5 px-3 py-2 text-sm text-[var(--text-dim)] hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || invalid}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              onConfirm(motivo);
            }}
            className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/30 disabled:opacity-50"
          >
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

function GastoDetalleModal({
  caso,
  busyId,
  onClose,
  onVerFoto,
  onDecidir,
}: {
  caso: GastoRendicion;
  busyId: string | null;
  onClose: () => void;
  onVerFoto: () => void;
  onDecidir: (estado: "aprobado" | "rechazado") => void;
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
        aria-labelledby="gasto-detalle-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 id="gasto-detalle-title" className="text-lg font-semibold text-white">
              {caso.codigo}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              {caso.categoriaLabel} · {caso.montoLabel}
            </p>
            <span
              className={clsx(
                "mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold",
                caso.estado === "pendiente_aprobacion" && "bg-amber-500/15 text-amber-400",
                caso.estado === "aprobado" && "bg-emerald-500/15 text-emerald-400",
                caso.estado === "rechazado" && "bg-rose-500/15 text-rose-500",
              )}
            >
              {caso.estadoLabel}
            </span>
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
            <Campo label="Chofer">
              <div>{caso.choferNombre || "—"}</div>
              <div className="text-xs text-[var(--text-faint)]">{caso.telefono || ""}</div>
            </Campo>
            <Campo label="Registrado">{fmtFecha(caso.createdAt)}</Campo>
            <Campo label="Proveedor">{caso.proveedor || "—"}</Campo>
            <Campo label="Fecha comprobante">{caso.fechaComprobante || "—"}</Campo>
            <div className="sm:col-span-2">
              <Campo label="Descripción / lectura">{caso.descripcion || "—"}</Campo>
            </div>
            {caso.notaChofer && (
              <div className="sm:col-span-2">
                <Campo label="Nota chofer">{caso.notaChofer}</Campo>
              </div>
            )}
            {caso.notaAprobacion && (
              <div className="sm:col-span-2">
                <Campo
                  label={
                    caso.estado === "rechazado" ? "Comentario de rechazo" : "Nota aprobación"
                  }
                >
                  {caso.notaAprobacion}
                </Campo>
              </div>
            )}
          </div>

          {caso.imagenUrl ? (
            <button
              type="button"
              onClick={onVerFoto}
              className="mt-4 text-sm font-medium text-[var(--violet-2)] hover:underline"
            >
              Ver foto del comprobante
            </button>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-faint)]">Sin comprobante</p>
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

        {caso.estado === "pendiente_aprobacion" && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("rechazado")}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-500 disabled:opacity-50"
            >
              <X size={14} />
              Rechazar
            </button>
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("aprobado")}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 disabled:opacity-50"
            >
              <Check size={14} />
              Aprobar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function RendicionPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<GastoRendicion[]>([]);
  const [resumen, setResumen] = useState<ResumenRendicion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente_aprobacion");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoPreview | null>(null);
  const [detalle, setDetalle] = useState<GastoRendicion | null>(null);
  const [rechazoTarget, setRechazoTarget] = useState<GastoRendicion | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listGastosRendicion({
          limit: 100,
          estado: filtro === "todos" ? undefined : filtro,
          q: q || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        }),
        resumenRendicion(),
      ]);
      setRows(list);
      setResumen(sum);
      setDetalle((cur) => {
        if (!cur) return null;
        return list.find((r) => r.id === cur.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar rendiciones");
    } finally {
      setLoading(false);
    }
  }, [filtro, q, desde, hasta]);

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

  function abrirComprobante(g: GastoRendicion) {
    const src = browsableMediaUrl(g.imagenUrl);
    if (!src) {
      void confirm({
        title: "Comprobante",
        message: "Sin comprobante",
        alert: true,
        confirmLabel: "Entendido",
      });
      return;
    }
    setFoto({
      src,
      title: `${g.codigo} · ${g.categoriaLabel}`,
    });
  }

  async function decidir(
    g: GastoRendicion,
    estado: "aprobado" | "rechazado",
    nota?: string,
  ) {
    if (estado === "rechazado") {
      const motivo = typeof nota === "string" ? nota.trim() : "";
      if (!motivo) {
        setRechazoTarget(g);
        return;
      }
    }
    if (estado === "aprobado") {
      const ok = await confirm({
        title: "Aprobar gasto",
        message: `${g.codigo} · ${g.categoriaLabel} · ${g.montoLabel}\n${g.choferNombre || g.telefono || ""}`,
        confirmLabel: "Aprobar",
      });
      if (!ok) return;
    }
    setBusyId(g.id);
    try {
      await decidirGastoRendicion(g.id, {
        estado,
        ...(estado === "rechazado" && nota ? { nota: nota.trim() } : {}),
        ...(estado === "aprobado" && nota ? { nota } : {}),
      });
      setDetalle(null);
      setRechazoTarget(null);
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
              Clic en un registro para abrir el detalle
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

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1 text-xs text-[var(--text-dim)]">
            Buscar
            <span className="relative mt-1.5 block">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Remito, chofer o patente…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-[var(--violet)]/40"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-dim)]">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--violet)]/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-dim)]">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--violet)]/40"
            />
          </label>
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
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Código</th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
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
                  <tr
                    key={g.id}
                    onClick={() => setDetalle(g)}
                    className="cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/[0.04]"
                  >
                    <td className="py-3 pr-3 font-medium text-white">{g.codigo}</td>
                    <td className="whitespace-nowrap py-3 pr-3 tabular text-[var(--text-dim)]">
                      {fmtFechaCola(g)}
                    </td>
                    <td className="max-w-[140px] truncate py-3 pr-3 text-[var(--text-dim)]">
                      {g.choferNombre || "—"}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">{g.categoriaLabel}</td>
                    <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => abrirComprobante(g)}
                        className="inline-flex items-center gap-1.5 tabular text-white hover:text-[var(--violet-2)]"
                        title={g.imagenUrl ? "Ver comprobante" : "Sin comprobante"}
                      >
                        {g.montoLabel}
                        {g.imagenUrl ? (
                          <ImageIcon size={14} className="text-[var(--text-faint)]" />
                        ) : null}
                      </button>
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detalle && (
        <GastoDetalleModal
          caso={detalle}
          busyId={busyId}
          onClose={() => setDetalle(null)}
          onVerFoto={() => abrirComprobante(detalle)}
          onDecidir={(estado) => void decidir(detalle, estado)}
        />
      )}

      {rechazoTarget && (
        <RechazoMotivoModal
          caso={rechazoTarget}
          busy={busyId === rechazoTarget.id}
          onClose={() => setRechazoTarget(null)}
          onConfirm={(nota) => void decidir(rechazoTarget, "rechazado", nota)}
        />
      )}

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Comprobante"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
