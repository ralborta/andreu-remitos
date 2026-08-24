"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, RefreshCw, X } from "lucide-react";
import {
  decidirEvidence,
  listEvidence,
  resumenEvidence,
  type EvidenceCaso,
  type EvidenceType,
  type ResumenEvidence,
} from "@/lib/api";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, KpiCard, Pill } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type FiltroEstado = "pendiente" | "observado" | "ok" | "rechazado" | "todos";
type FiltroTipo = "todos" | EvidenceType;

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

function fmtQty(q?: Record<string, unknown> | null) {
  if (!q) return "—";
  const parts: string[] = [];
  if (q.pallets != null) parts.push(`${q.pallets} pallets`);
  if (q.cajas != null) parts.push(`${q.cajas} cajas`);
  if (q.bultos != null) parts.push(`${q.bultos} bultos`);
  return parts.length ? parts.join(" · ") : "—";
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

function EvidenceDetalleModal({
  caso,
  busyId,
  onClose,
  onVerFoto,
  onDecidir,
}: {
  caso: EvidenceCaso;
  busyId: string | null;
  onClose: () => void;
  onVerFoto: (url: string, title: string) => void;
  onDecidir: (estado: "ok" | "rechazado" | "observado") => void;
}) {
  const imgs = caso.attachments?.length
    ? caso.attachments
    : caso.imagenUrl
      ? [{ url: caso.imagenUrl, id: caso.id }]
      : [];

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
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {caso.codigo}{" "}
              <span className="text-sm font-normal text-[var(--text-dim)]">({caso.typeLabel})</span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Pill color={caso.type === "POP" ? "#0ea5e9" : "#7c3aed"}>{caso.type}</Pill>
              <Pill
                color={
                  caso.estado === "ok"
                    ? "#22c55e"
                    : caso.estado === "rechazado"
                      ? "#ef4444"
                      : caso.estado === "observado"
                        ? "#f59e0b"
                        : "#f59e0b"
                }
              >
                {caso.estadoLabel}
              </Pill>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Viaje">{caso.viaje}</Campo>
            <Campo label="Chofer">
              <div>{caso.chofer}</div>
              <div className="text-xs text-[var(--text-faint)]">{caso.telefono}</div>
            </Campo>
            {caso.type === "POD" && <Campo label="Receptor">{caso.receptor}</Campo>}
            {caso.type === "POP" && <Campo label="Origen">{caso.origen}</Campo>}
            <Campo label="Destino">{caso.destino}</Campo>
            <Campo label="Cantidades reportadas">{fmtQty(caso.reportedQuantities)}</Campo>
            <Campo label="Cantidades esperadas">{fmtQty(caso.expectedQuantities)}</Campo>
            <Campo label="Estado carga">{caso.condition || "—"}</Campo>
            <Campo label="Registrado">{fmtFecha(caso.createdAt)}</Campo>
          </div>

          {caso.differenceNotes && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              ⚠ {caso.differenceNotes}
            </p>
          )}

          {caso.notaChofer && (
            <div className="mt-3">
              <Campo label="Notas chofer">{caso.notaChofer}</Campo>
            </div>
          )}

          {imgs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                Evidencias ({imgs.length})
              </p>
              {imgs.map((a, i) => (
                <button
                  key={a.id || i}
                  type="button"
                  onClick={() => onVerFoto(a.url, `${caso.codigo} · foto ${i + 1}`)}
                  className="block text-sm text-[var(--violet-2)] hover:underline"
                >
                  Ver evidencia {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {["pendiente", "observado"].includes(caso.estado) && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("rechazado")}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600/90 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <X size={14} /> Rechazar
            </button>
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("ok")}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Check size={14} /> Aprobar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Backoffice unificado POP/POD. */
export function EvidencePanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<EvidenceCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenEvidence | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("pendiente");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ src: string; title: string } | null>(null);
  const [detalle, setDetalle] = useState<EvidenceCaso | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listEvidence({
          limit: 150,
          estado: filtro === "todos" ? undefined : filtro,
          type: tipo === "todos" ? undefined : tipo,
        }),
        resumenEvidence(tipo === "todos" ? undefined : tipo),
      ]);
      setRows(list);
      setResumen(sum);
      setDetalle((cur) => (cur ? list.find((r) => r.id === cur.id) ?? null : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar evidencias");
    } finally {
      setLoading(false);
    }
  }, [filtro, tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(
    () => [
      { label: "Pendientes", value: String(resumen?.pendientes ?? "—") },
      { label: "Observados", value: String(resumen?.observados ?? "—") },
      { label: "Aprobados", value: String(resumen?.ok ?? "—") },
      { label: "Rechazados", value: String(resumen?.rechazados ?? "—") },
    ],
    [resumen],
  );

  async function decidir(g: EvidenceCaso, estado: "ok" | "rechazado") {
    const ok = await confirm({
      title: estado === "ok" ? `Aprobar ${g.type}` : `Rechazar ${g.type}`,
      message: `${g.codigo} · ${g.viaje}\n${g.chofer}`,
      confirmLabel: estado === "ok" ? "Aprobar" : "Rechazar",
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await decidirEvidence(g.id, { estado, notificar: true });
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
          <KpiCard key={k.label} label={k.label} value={k.value} />
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Evidencias de Transporte</h3>
            <p className="text-xs text-[var(--text-faint)]">POP (retiro) y POD (entrega)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["todos", "POP", "POD"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs",
                  tipo === t ? "bg-sky-600 text-white" : "bg-white/5 text-[var(--text-dim)]",
                )}
              >
                {t === "todos" ? "Todos" : t}
              </button>
            ))}
            {(
              [
                ["pendiente", "Pendientes"],
                ["observado", "Observados"],
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
                  filtro === id ? "bg-[var(--violet)] text-white" : "bg-white/5 text-[var(--text-dim)]",
                )}
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={() => void load()} className="rounded-lg bg-white/5 p-2">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase text-[var(--text-faint)]">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Viaje</th>
                <th className="py-2 pr-3">Chofer</th>
                <th className="py-2 pr-3">Cantidades</th>
                <th className="py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-[var(--border)]/50 hover:bg-white/[0.03]"
                  onClick={() => setDetalle(r)}
                >
                  <td className="py-2.5 pr-3 font-medium text-white">{r.codigo}</td>
                  <td className="py-2.5 pr-3">
                    <Pill color={r.type === "POP" ? "#0ea5e9" : "#7c3aed"}>{r.type}</Pill>
                  </td>
                  <td className="py-2.5 pr-3">{r.estadoLabel}</td>
                  <td className="py-2.5 pr-3">{r.viaje}</td>
                  <td className="py-2.5 pr-3">{r.chofer}</td>
                  <td className="py-2.5 pr-3 text-xs text-[var(--text-dim)]">
                    {fmtQty(r.reportedQuantities)}
                    {r.observed && " ⚠"}
                  </td>
                  <td className="py-2.5 text-xs text-[var(--text-faint)]">{fmtFecha(r.createdAt)}</td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-faint)]">
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {detalle && (
        <EvidenceDetalleModal
          caso={detalle}
          busyId={busyId}
          onClose={() => setDetalle(null)}
          onVerFoto={(url, title) =>
            setFoto({ src: browsableMediaUrl(url) || url, title })
          }
          onDecidir={decidir}
        />
      )}

      {foto && (
        <RemitoImageLightbox src={foto.src} title={foto.title} onClose={() => setFoto(null)} />
      )}
    </div>
  );
}

/** @deprecated Usar EvidencePanel */
export function PodPanel() {
  return <EvidencePanel />;
}
