"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import clsx from "clsx";
import { ArrowUpRight, Check, RefreshCw, X } from "lucide-react";
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

function codigoCaso(g: ReclamoCaso) {
  return g.codigo || g.id;
}

/** Botones de acción con contraste alto (texto blanco sobre color sólido). */
const BTN_TOMAR: React.CSSProperties = {
  background: "#0284c7",
  color: "#ffffff",
};
const BTN_ESCALAR: React.CSSProperties = {
  background: "#d97706",
  color: "#ffffff",
};
const BTN_OK: React.CSSProperties = {
  background: "#16a34a",
  color: "#ffffff",
};
const btnAccionClass =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50";

function ReclamoDetalleModal({
  caso,
  onClose,
  onVerFoto,
  busyId,
  onDecidir,
}: {
  caso: ReclamoCaso;
  onClose: () => void;
  onVerFoto: () => void;
  busyId: string | null;
  onDecidir: (estado: "en_proceso" | "escalado" | "resuelto") => void;
}) {
  const fotoSrc = browsableMediaUrl(caso.imagenUrl);
  const mensajes = (caso.mensajes || []).slice(-12);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reclamo-detalle-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="reclamo-detalle-title" className="text-base font-semibold text-white">
              {codigoCaso(caso)}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {caso.motivoLabel}
              {caso.tipoAbbr ? ` · ${caso.tipoAbbr}` : ""}
            </p>
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

        <div className="mb-4 flex flex-wrap gap-2">
          <Pill color={caso.canal === "WhatsApp" ? "#25d366" : "#a78bfa"}>{caso.canal}</Pill>
          {caso.criticidadLabel !== "—" && (
            <CritBadge level={caso.criticidadLabel as "Alta" | "Media" | "Baja"} />
          )}
          <Pill color={estadoColor(caso.estado)}>{caso.estadoLabel}</Pill>
          <span
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-xs",
              caso.sla === "Por vencer"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-white/5 text-[var(--text-dim)]",
            )}
          >
            {caso.sla}
          </span>
        </div>

        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="text-xs text-[var(--text-faint)]">Cliente</dt>
            <dd className="text-white">{caso.cliente}</dd>
            {caso.telefono && (
              <dd className="text-xs text-[var(--text-dim)]">{caso.telefono}</dd>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-[var(--text-faint)]">Viaje</dt>
              <dd className="text-[var(--text-dim)]">{caso.viaje}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-faint)]">Remito / pedido</dt>
              <dd className="text-[var(--text-dim)]">
                {caso.remito || caso.pedido || "—"}
              </dd>
            </div>
          </div>
          {(caso.resumen || caso.detalle) && (
            <div>
              <dt className="text-xs text-[var(--text-faint)]">Detalle</dt>
              <dd className="whitespace-pre-wrap text-[var(--text-dim)]">
                {caso.detalle || caso.resumen}
              </dd>
            </div>
          )}
          {caso.escaladoA && (
            <div>
              <dt className="text-xs text-[var(--text-faint)]">Escalado a</dt>
              <dd className="text-[var(--text-dim)]">{caso.escaladoA}</dd>
            </div>
          )}
          {caso.notaInterna && (
            <div>
              <dt className="text-xs text-[var(--text-faint)]">Nota interna</dt>
              <dd className="text-[var(--text-dim)]">{caso.notaInterna}</dd>
            </div>
          )}
        </dl>

        {fotoSrc && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--text-faint)]">Evidencia</p>
            <button
              type="button"
              onClick={onVerFoto}
              className="group relative block w-full overflow-hidden rounded-xl border border-[var(--border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoSrc}
                alt={`Foto ${codigoCaso(caso)}`}
                className="max-h-52 w-full object-contain bg-black/40"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1.5 text-center text-xs text-white opacity-90 group-hover:opacity-100">
                Abrir foto
              </span>
            </button>
          </div>
        )}

        {mensajes.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--text-faint)]">Últimos mensajes</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[#0b1020] p-2.5 text-xs leading-relaxed">
              {mensajes.map((m, i) => {
                const esAgente = m.dir === "out";
                return (
                  <li
                    key={`${m.at || i}-${i}`}
                    style={{
                      borderLeft: `3px solid ${esAgente ? "#22c55e" : "#a78bfa"}`,
                      background: esAgente ? "rgba(34,197,94,0.12)" : "rgba(167,139,250,0.10)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      color: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        color: esAgente ? "#4ade80" : "#c4b5fd",
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      {esAgente ? "Agente" : "Cliente"}
                    </div>
                    <div style={{ color: "#f1f5f9" }}>
                      {m.texto || (m.imagen_url ? "[foto]" : "—")}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(caso.historial || []).length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--text-faint)]">Historial</p>
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-[var(--text-dim)]">
              {(caso.historial || []).slice(-8).map((h, i) => (
                <li key={`${h}-${i}`}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {caso.estado !== "resuelto" && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {caso.estado === "nuevo" && (
              <button
                type="button"
                disabled={busyId === caso.id}
                onClick={() => onDecidir("en_proceso")}
                className={btnAccionClass}
                style={BTN_TOMAR}
              >
                Tomar
              </button>
            )}
            {caso.estado !== "escalado" && (
              <button
                type="button"
                disabled={busyId === caso.id}
                onClick={() => onDecidir("escalado")}
                className={btnAccionClass}
                style={BTN_ESCALAR}
              >
                <ArrowUpRight size={14} />
                Escalar
              </button>
            )}
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("resuelto")}
              className={btnAccionClass}
              style={BTN_OK}
            >
              <Check size={14} />
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
  const [detalle, setDetalle] = useState<ReclamoCaso | null>(null);

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
      setDetalle((prev) => {
        if (!prev) return null;
        return filtered.find((r) => r.id === prev.id) || list.find((r) => r.id === prev.id) || null;
      });
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
      message: `${codigoCaso(g)} · ${g.motivoLabel} · ${g.cliente}\n${g.viaje !== "—" ? g.viaje : g.resumen || ""}`,
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

  function abrirFoto(g: ReclamoCaso) {
    const src = browsableMediaUrl(g.imagenUrl);
    if (!src) return;
    setFoto({
      src,
      title: `${codigoCaso(g)} · ${g.motivoLabel}`,
    });
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
              Clientes por WhatsApp · diálogo 100% IA · click en la fila para ver detalle
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
                  <tr
                    key={g.id}
                    className="cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/[0.03]"
                    onClick={() => setDetalle(g)}
                  >
                    <td className="py-3 pr-3 font-medium text-white">
                      <div>{codigoCaso(g)}</div>
                      {g.tipoAbbr && (
                        <div className="text-[10px] font-normal text-[var(--text-faint)]">
                          {g.tipoAbbr}
                          {g.tipoAbbrLabel ? ` · ${g.tipoAbbrLabel}` : ""}
                        </div>
                      )}
                    </td>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirFoto(g);
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
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      {g.estado === "resuelto" ? (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {g.estado === "nuevo" && (
                            <button
                              type="button"
                              disabled={busyId === g.id}
                              onClick={() => void decidir(g, "en_proceso")}
                              className={btnAccionClass}
                              style={BTN_TOMAR}
                            >
                              Tomar
                            </button>
                          )}
                          {g.estado !== "escalado" && (
                            <button
                              type="button"
                              disabled={busyId === g.id}
                              onClick={() => void decidir(g, "escalado")}
                              className={btnAccionClass}
                              style={BTN_ESCALAR}
                            >
                              <ArrowUpRight size={14} />
                              Escalar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === g.id}
                            onClick={() => void decidir(g, "resuelto")}
                            className={btnAccionClass}
                            style={BTN_OK}
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

      {detalle && (
        <ReclamoDetalleModal
          caso={detalle}
          onClose={() => setDetalle(null)}
          onVerFoto={() => abrirFoto(detalle)}
          busyId={busyId}
          onDecidir={(estado) => void decidir(detalle, estado)}
        />
      )}

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Foto del reclamo"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
