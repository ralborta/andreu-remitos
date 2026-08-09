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
  History,
  ImageIcon,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  ShoppingBag,
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

function formatFechaMsg(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/(\d{1,2}:\d{2})/);
    return m?.[1] ?? String(iso);
  }
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Paleta del modal de detalle (mockup claro). */
const RC = {
  purple: "#7c3aed",
  purpleSoft: "#f3e8ff",
  purpleText: "#6d28d9",
  border: "#e5e7eb",
  label: "#9ca3af",
  body: "#374151",
  title: "#111827",
  muted: "#6b7280",
  chatBg: "#111827",
  chatAgentBg: "#14532d",
  chatAgentText: "#4ade80",
  chatClientText: "#e5e7eb",
  wa: "#16a34a",
  waBg: "#dcfce7",
  media: "#ea580c",
  mediaBg: "#ffedd5",
  sla: "#6b7280",
  slaBg: "#f3f4f6",
  nuevo: "#9333ea",
  nuevoBg: "#f3e8ff",
} as const;

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
  "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50";

function LightBadge({
  bg,
  color,
  icon,
  children,
}: {
  bg: string;
  color: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      {icon}
      {children}
    </span>
  );
}

function estadoBadgeStyle(estado: string) {
  if (estado === "nuevo") return { bg: RC.nuevoBg, color: RC.nuevo };
  if (estado === "resuelto") return { bg: "#dcfce7", color: "#16a34a" };
  if (estado === "escalado") return { bg: "#ffedd5", color: "#ea580c" };
  if (estado === "en_proceso") return { bg: "#e0f2fe", color: "#0284c7" };
  return { bg: RC.slaBg, color: RC.sla };
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
  const estadoStyle = estadoBadgeStyle(caso.estado);

  useEffect(() => {
    setFotoIdx(0);
  }, [caso.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reclamo-detalle-title"
      >
        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: RC.purple }}
              >
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3
                  id="reclamo-detalle-title"
                  className="truncate text-[1.15rem] font-bold tracking-tight sm:text-xl"
                  style={{ color: RC.title }}
                >
                  {codigoCaso(caso)}
                </h3>
                <p className="mt-0.5 text-sm" style={{ color: RC.muted }}>
                  {caso.motivoLabel}
                  {caso.tipoAbbr ? ` · ${caso.tipoAbbr}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Badges */}
          <div className="mb-4 flex flex-wrap gap-2">
            <LightBadge
              bg={caso.canal === "WhatsApp" ? RC.waBg : RC.purpleSoft}
              color={caso.canal === "WhatsApp" ? RC.wa : RC.purpleText}
              icon={<MessageCircle size={12} />}
            >
              {caso.canal}
            </LightBadge>
            {evidencias.length > 0 && (
              <LightBadge bg={RC.mediaBg} color={RC.media} icon={<ImageIcon size={12} />}>
                Media
              </LightBadge>
            )}
            <LightBadge
              bg={estadoStyle.bg}
              color={estadoStyle.color}
              icon={caso.estado === "nuevo" ? <Sparkles size={12} /> : undefined}
            >
              {caso.estadoLabel}
            </LightBadge>
            <LightBadge
              bg={caso.sla === "Por vencer" ? "#fef3c7" : RC.slaBg}
              color={caso.sla === "Por vencer" ? "#d97706" : RC.sla}
              icon={<Clock size={12} />}
            >
              {caso.sla}
            </LightBadge>
          </div>

          {/* Info card — 3 columnas */}
          <section
            className="mb-4 rounded-2xl border bg-white p-4"
            style={{ borderColor: RC.border }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <UserRound size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Cliente
                  </p>
                  <p className="truncate text-sm font-bold" style={{ color: RC.purpleText }}>
                    {caso.cliente}
                  </p>
                  {caso.telefono && (
                    <p className="text-xs" style={{ color: RC.muted }}>
                      {caso.telefono}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShoppingBag size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Viaje
                  </p>
                  <p className="text-sm font-medium" style={{ color: RC.body }}>
                    {caso.viaje || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ClipboardList size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Remito / pedido
                  </p>
                  <p className="text-sm font-medium" style={{ color: RC.body }}>
                    {remitoPedido}
                  </p>
                </div>
              </div>
            </div>

            {detalleTxt && (
              <div
                className="mt-4 flex items-start gap-2.5 border-t pt-3"
                style={{ borderColor: RC.border }}
              >
                <MessageSquareText
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: RC.purple }}
                />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Detalle
                  </p>
                  <p
                    className="whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ color: RC.body }}
                  >
                    {detalleTxt}
                  </p>
                </div>
              </div>
            )}

            {(caso.escaladoA || caso.notaInterna) && (
              <div
                className="mt-3 space-y-1.5 border-t pt-3 text-sm"
                style={{ borderColor: RC.border, color: RC.body }}
              >
                {caso.escaladoA && (
                  <p>
                    <span style={{ color: RC.label }}>Escalado a · </span>
                    {caso.escaladoA}
                  </p>
                )}
                {caso.notaInterna && (
                  <p>
                    <span style={{ color: RC.label }}>Nota · </span>
                    {caso.notaInterna}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Evidencia */}
          {evidencias.length > 0 && fotoActual && (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: RC.title }}
                >
                  <ImageIcon size={16} style={{ color: RC.purple }} />
                  Evidencia
                </div>
                <button
                  type="button"
                  onClick={() => onVerFoto(fotoActual)}
                  className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: RC.purpleText }}
                >
                  Ver en grande
                  <ExternalLink size={12} />
                </button>
              </div>
              <div
                className="relative overflow-hidden rounded-2xl border bg-gray-50"
                style={{ borderColor: RC.border }}
              >
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 shadow hover:bg-gray-50"
                      onClick={() =>
                        setFotoIdx((i) => (i - 1 + evidencias.length) % evidencias.length)
                      }
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Foto siguiente"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 shadow hover:bg-gray-50"
                      onClick={() => setFotoIdx((i) => (i + 1) % evidencias.length)}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
                      {evidencias.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Foto ${i + 1}`}
                          onClick={() => setFotoIdx(i)}
                          className="h-2 w-2 rounded-full transition"
                          style={{
                            background: i === fotoIdx ? RC.purple : "#d1d5db",
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Últimos mensajes — chat oscuro con timeline */}
          {mensajes.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: RC.title }}
                >
                  <MessageCircle size={16} style={{ color: RC.purple }} />
                  Últimos mensajes
                </div>
                <Link
                  href={chatHref}
                  className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: RC.purpleText }}
                >
                  Ver conversación completa
                  <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="relative max-h-64 space-y-2.5 overflow-y-auto pl-3">
                <span
                  className="absolute bottom-3 left-[18px] top-3 w-px"
                  style={{ background: "#d8b4fe" }}
                  aria-hidden
                />
                {mensajes.map((m, i) => {
                  const esAgente = m.dir === "out";
                  return (
                    <li key={`${m.at || i}-${i}`} className="relative pl-5">
                      <span
                        className="absolute left-[10px] top-4 z-[1] h-2.5 w-2.5 rounded-full ring-2 ring-white"
                        style={{ background: RC.purple }}
                      />
                      <div
                        className="flex items-start justify-between gap-3 rounded-xl px-3.5 py-3"
                        style={{
                          background: esAgente ? RC.chatAgentBg : RC.chatBg,
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="text-[11px] font-bold"
                            style={{
                              color: esAgente ? RC.chatAgentText : "#c4b5fd",
                            }}
                          >
                            {esAgente ? "Agente" : "Cliente"}
                            {m.at ? (
                              <span className="ml-2 font-normal opacity-80">
                                {formatFechaMsg(m.at)}
                              </span>
                            ) : null}
                          </p>
                          <p
                            className="mt-1 text-sm leading-relaxed"
                            style={{
                              color: esAgente ? RC.chatAgentText : RC.chatClientText,
                            }}
                          >
                            {m.texto || (m.imagen_url ? "[foto]" : "—")}
                          </p>
                        </div>
                        <span
                          className="mt-0.5 shrink-0 opacity-70"
                          style={{
                            color: esAgente ? RC.chatAgentText : "#a78bfa",
                          }}
                        >
                          {esAgente ? <Headphones size={16} /> : <UserRound size={16} />}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Historial + meta */}
          <section className="grid gap-3 sm:grid-cols-[1.45fr_1fr]">
            <div>
              <div
                className="mb-2 flex items-center gap-2 text-sm font-semibold"
                style={{ color: RC.title }}
              >
                <History size={16} style={{ color: RC.purple }} />
                Historial
              </div>
              {historial.length === 0 ? (
                <p className="text-xs" style={{ color: RC.label }}>
                  Sin eventos todavía.
                </p>
              ) : (
                <ul className="relative max-h-36 space-y-2.5 overflow-y-auto pl-1">
                  {historial.map((h, i) => (
                    <li key={`${h}-${i}`} className="relative flex gap-3 pl-4">
                      <span
                        className="absolute left-0 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: RC.purple }}
                      />
                      {i < historial.length - 1 && (
                        <span
                          className="absolute left-[3px] top-3.5 h-[calc(100%+2px)] w-px"
                          style={{ background: "#e9d5ff" }}
                        />
                      )}
                      <p className="text-xs leading-relaxed" style={{ color: RC.body }}>
                        {h}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2.5">
              <div
                className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3"
                style={{ borderColor: RC.border }}
              >
                <Calendar size={15} style={{ color: RC.purple }} />
                <p className="text-xs font-medium" style={{ color: RC.body }}>
                  Creado el {formatFechaCorta(caso.createdAt)}
                </p>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3"
                style={{ borderColor: RC.border }}
              >
                <MessageCircle
                  size={15}
                  style={{ color: caso.canal === "WhatsApp" ? RC.wa : RC.purple }}
                />
                <p className="text-xs font-medium" style={{ color: RC.body }}>
                  Canal {caso.canal}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Acciones */}
        {caso.estado !== "resuelto" && (
          <div
            className="flex flex-wrap gap-2.5 border-t bg-white px-5 py-4 sm:px-6"
            style={{ borderColor: RC.border }}
          >
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
