"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Headphones,
  ImageIcon,
  MessageCircle,
  MessageSquareText,
  Package,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
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
  if (estado === "nuevo") return "#a855f7";
  return "#a79fc9";
}

function codigoCaso(g: ReclamoCaso) {
  return g.codigo || g.id;
}

function formatFechaCorta(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHoraMsg(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // Puede venir como "21:20" o similar
    const m = String(iso).match(/(\d{1,2}:\d{2})/);
    return m?.[1] ?? "";
  }
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function collectEvidencias(caso: ReclamoCaso): string[] {
  const out: string[] = [];
  const push = (raw?: string | null) => {
    const u = browsableMediaUrl(raw);
    if (u && !out.includes(u)) out.push(u);
  };
  push(caso.imagenUrl);
  for (const m of caso.mensajes || []) push(m.imagen_url);
  return out;
}

/** Botones de acción con contraste alto (texto blanco sobre color sólido). */
const BTN_TOMAR: CSSProperties = {
  background: "#0284c7",
  color: "#ffffff",
};
const BTN_ESCALAR: CSSProperties = {
  background: "#d97706",
  color: "#ffffff",
};
const BTN_OK: CSSProperties = {
  background: "#16a34a",
  color: "#ffffff",
};
const btnAccionClass =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50";
const btnModalAccionClass =
  "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-50";

function SoftBadge({
  color,
  icon,
  children,
}: {
  color: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color,
        background: `${color}18`,
        boxShadow: `inset 0 0 0 1px ${color}40`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function ReclamoDetalleModal({
  caso,
  onClose,
  onVerFoto,
  busyId,
  onDecidir,
}: {
  caso: ReclamoCaso;
  onClose: () => void;
  onVerFoto: (src?: string) => void;
  busyId: string | null;
  onDecidir: (estado: "en_proceso" | "escalado" | "resuelto") => void;
}) {
  const evidencias = useMemo(() => collectEvidencias(caso), [caso]);
  const [fotoIdx, setFotoIdx] = useState(0);
  const mensajes = (caso.mensajes || []).slice(-8);
  const historial = (caso.historial || []).slice(-8);
  const detalleTxt = caso.detalle || caso.resumen;
  const remitoPedido = caso.remito || caso.pedido || "—";
  const fotoActual = evidencias[fotoIdx] || evidencias[0];
  const chatHref = caso.telefono
    ? `/contactos?tel=${encodeURIComponent(caso.telefono.replace(/\D/g, ""))}`
    : "/contactos";

  useEffect(() => {
    setFotoIdx(0);
  }, [caso.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reclamo-detalle-title"
      >
        <div className="overflow-y-auto p-5 sm:p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--violet)]/20 text-[var(--violet-2)] ring-1 ring-[var(--violet)]/35">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3
                  id="reclamo-detalle-title"
                  className="truncate text-lg font-bold tracking-tight text-white"
                >
                  {codigoCaso(caso)}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                  {caso.motivoLabel}
                  {caso.tipoAbbr ? ` · ${caso.tipoAbbr}` : ""}
                </p>
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

          {/* Badges */}
          <div className="mb-5 flex flex-wrap gap-2">
            <SoftBadge
              color={caso.canal === "WhatsApp" ? "#25d366" : "#a78bfa"}
              icon={<MessageCircle size={12} />}
            >
              {caso.canal}
            </SoftBadge>
            {evidencias.length > 0 && (
              <SoftBadge color="#f59e0b" icon={<ImageIcon size={12} />}>
                Media
              </SoftBadge>
            )}
            {caso.criticidadLabel !== "—" && (
              <CritBadge level={caso.criticidadLabel as "Alta" | "Media" | "Baja"} />
            )}
            <SoftBadge
              color={estadoColor(caso.estado)}
              icon={caso.estado === "nuevo" ? <Sparkles size={12} /> : undefined}
            >
              {caso.estadoLabel}
            </SoftBadge>
            <SoftBadge
              color={caso.sla === "Por vencer" ? "#f59e0b" : "#94a3b8"}
              icon={<Clock size={12} />}
            >
              {caso.sla}
            </SoftBadge>
          </div>

          {/* Info card */}
          <section className="mb-4 space-y-3 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[var(--violet-2)]">
                <UserRound size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{caso.cliente}</p>
                {caso.telefono && (
                  <p className="text-xs text-[var(--text-dim)]">{caso.telefono}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--border)]/70 bg-white/[0.03] px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <Package size={12} />
                  Viaje
                </div>
                <p className="text-sm text-[var(--text-dim)]">{caso.viaje || "—"}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)]/70 bg-white/[0.03] px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <ClipboardList size={12} />
                  Remito / pedido
                </div>
                <p className="text-sm text-[var(--text-dim)]">{remitoPedido}</p>
              </div>
            </div>

            {detalleTxt && (
              <div className="flex items-start gap-3 border-t border-[var(--border)]/60 pt-3">
                <span className="mt-0.5 text-[var(--violet-2)]">
                  <MessageSquareText size={16} />
                </span>
                <div>
                  <p className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                    Detalle
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-dim)]">
                    {detalleTxt}
                  </p>
                </div>
              </div>
            )}

            {(caso.escaladoA || caso.notaInterna) && (
              <div className="space-y-2 border-t border-[var(--border)]/60 pt-3 text-sm">
                {caso.escaladoA && (
                  <p>
                    <span className="text-[var(--text-faint)]">Escalado a · </span>
                    <span className="text-[var(--text-dim)]">{caso.escaladoA}</span>
                  </p>
                )}
                {caso.notaInterna && (
                  <p>
                    <span className="text-[var(--text-faint)]">Nota · </span>
                    <span className="text-[var(--text-dim)]">{caso.notaInterna}</span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Evidencia */}
          {evidencias.length > 0 && fotoActual && (
            <section className="mb-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ImageIcon size={16} className="text-[var(--violet-2)]" />
                  Evidencia
                </div>
                <button
                  type="button"
                  onClick={() => onVerFoto(fotoActual)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--violet-2)] hover:underline"
                >
                  Ver en grande
                  <ExternalLink size={12} />
                </button>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoActual}
                  alt={`Evidencia ${codigoCaso(caso)}`}
                  className="mx-auto max-h-56 w-full cursor-zoom-in object-contain"
                  onClick={() => onVerFoto(fotoActual)}
                />
                {evidencias.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Foto anterior"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                      onClick={() =>
                        setFotoIdx((i) => (i - 1 + evidencias.length) % evidencias.length)
                      }
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Foto siguiente"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                      onClick={() => setFotoIdx((i) => (i + 1) % evidencias.length)}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                      {evidencias.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Foto ${i + 1}`}
                          onClick={() => setFotoIdx(i)}
                          className={clsx(
                            "h-1.5 w-1.5 rounded-full transition",
                            i === fotoIdx ? "bg-[var(--violet-2)]" : "bg-white/35",
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Mensajes */}
          {mensajes.length > 0 && (
            <section className="mb-4 rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">Últimos mensajes</p>
                <Link
                  href={chatHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--violet-2)] hover:underline"
                >
                  Ver conversación completa
                  <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {mensajes.map((m, i) => {
                  const esAgente = m.dir === "out";
                  return (
                    <li
                      key={`${m.at || i}-${i}`}
                      className={clsx(
                        "flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5",
                        esAgente
                          ? "border-emerald-500/35 bg-emerald-500/10"
                          : "border-[var(--border)]/70 bg-white/[0.03]",
                      )}
                    >
                      <div className="min-w-0">
                        <p
                          className={clsx(
                            "text-[11px] font-semibold",
                            esAgente ? "text-emerald-300" : "text-[var(--text-faint)]",
                          )}
                        >
                          {esAgente ? "Agente" : "Cliente"}
                          {m.at ? (
                            <span className="ml-1.5 font-normal opacity-80">
                              {formatHoraMsg(m.at)}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className={clsx(
                            "mt-0.5 text-sm leading-relaxed",
                            esAgente ? "text-emerald-100" : "text-[var(--text-dim)]",
                          )}
                        >
                          {m.texto || (m.imagen_url ? "[foto]" : "—")}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "mt-0.5 shrink-0 rounded-full p-1.5",
                          esAgente
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-white/5 text-[var(--text-faint)]",
                        )}
                      >
                        {esAgente ? <Headphones size={14} /> : <UserRound size={14} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Historial + meta */}
          <section className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Historial</p>
              {historial.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)]">Sin eventos todavía.</p>
              ) : (
                <ul className="relative max-h-36 space-y-3 overflow-y-auto pl-1">
                  {historial.map((h, i) => (
                    <li key={`${h}-${i}`} className="relative flex gap-3 pl-4">
                      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[var(--violet-2)] ring-2 ring-[var(--violet)]/30" />
                      {i < historial.length - 1 && (
                        <span className="absolute left-[3px] top-3.5 h-[calc(100%+4px)] w-px bg-[var(--border)]" />
                      )}
                      <p className="text-xs leading-relaxed text-[var(--text-dim)]">{h}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <Calendar size={12} />
                  Creado
                </div>
                <p className="text-sm text-[var(--text-dim)]">
                  {formatFechaCorta(caso.createdAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 px-4 py-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                  <MessageCircle size={12} />
                  Canal
                </div>
                <p className="text-sm text-[var(--text-dim)]">{caso.canal}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Acciones */}
        {caso.estado !== "resuelto" && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] bg-black/25 p-4 sm:p-5">
            {caso.estado === "nuevo" && (
              <button
                type="button"
                disabled={busyId === caso.id}
                onClick={() => onDecidir("en_proceso")}
                className={btnModalAccionClass}
                style={BTN_TOMAR}
              >
                <Camera size={16} />
                Tomar
              </button>
            )}
            {caso.estado !== "escalado" && (
              <button
                type="button"
                disabled={busyId === caso.id}
                onClick={() => onDecidir("escalado")}
                className={btnModalAccionClass}
                style={BTN_ESCALAR}
              >
                <ArrowUpRight size={16} />
                Escalar
              </button>
            )}
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("resuelto")}
              className={btnModalAccionClass}
              style={BTN_OK}
            >
              <Check size={16} />
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

  function abrirFoto(g: ReclamoCaso, srcOverride?: string) {
    const src = srcOverride || browsableMediaUrl(g.imagenUrl);
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
          onVerFoto={(src) => abrirFoto(detalle, src)}
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
