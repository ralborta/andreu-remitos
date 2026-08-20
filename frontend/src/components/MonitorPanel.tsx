"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellOff,
  Bot,
  CheckCircle2,
  Globe,
  MessageCircle,
  PauseCircle,
  QrCode,
  Radio,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import {
  buildAgentRuntimeBoard,
  RUNTIME_COLOR,
  RUNTIME_HINT,
  RUNTIME_LABEL,
  runtimeCounts,
  type AgentRuntimeSnapshot,
  type AgentRuntimeState,
} from "@/lib/agent-runtime";
import { agents } from "@/lib/agents";
import {
  fetchMonitorStatus,
  fetchMonitorWhatsappQr,
  listDestinos,
  listRemitos,
  listViajes,
  resumenEta,
  resumenIncidencias,
  resumenPods,
  resumenReclamos,
  resumenRendicion,
} from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { useConfirm } from "@/lib/confirm-context";
import type { MonitorStatus, MonitorWhatsappQr } from "@/lib/monitor-types";
import { AgentIcon } from "./Icon";
import { Card, PageHeader, Pill } from "./ui";

const POLL_MS = 15_000;
const LOG_MAX = 30;

type LogEntry = {
  at: string;
  ok: boolean;
  message: string;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function serviceLabel(id: string) {
  switch (id) {
    case "api":
      return `API ${BRAND.name}`;
    case "bot":
      return "Bot Baileys (HTTP)";
    case "whatsapp":
      return "WhatsApp";
    case "webhook":
      return "Webhook agentes";
    default:
      return id;
  }
}

function serviceIcon(id: string) {
  switch (id) {
    case "api":
      return <Server size={20} />;
    case "bot":
      return <Bot size={20} />;
    case "whatsapp":
      return <MessageCircle size={20} />;
    case "webhook":
      return <Globe size={20} />;
    default:
      return <Activity size={20} />;
  }
}

function RuntimeBadge({ state }: { state: AgentRuntimeState }) {
  const color = RUNTIME_COLOR[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color,
        background: `${color}1f`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {state === "activo" && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </span>
      {RUNTIME_LABEL[state]}
    </span>
  );
}

function AgentRuntimeCard({
  agent,
  row,
}: {
  agent: (typeof agents)[number];
  row: AgentRuntimeSnapshot;
}) {
  const color = RUNTIME_COLOR[row.state];
  return (
    <Link
      href={`/agentes/${agent.slug}`}
      className="panel panel-hover flex flex-col gap-3 p-4 transition-colors"
      style={{ boxShadow: row.state === "activo" ? `inset 0 0 0 1px ${color}33` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${color}18`, color }}
          >
            <AgentIcon name={agent.icon} size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{agent.short}</p>
            <p className="truncate text-[11px] text-[var(--text-faint)]">{agent.name}</p>
          </div>
        </div>
        <RuntimeBadge state={row.state} />
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-dim)]">{row.detail}</p>
      <div className="mt-auto flex items-center justify-between text-[11px] text-[var(--text-faint)]">
        <span>{RUNTIME_HINT[row.state]}</span>
        {row.queue > 0 && <span className="tabular text-white/80">cola {row.queue}</span>}
      </div>
    </Link>
  );
}

export function MonitorPanel() {
  const [data, setData] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [qr, setQr] = useState<MonitorWhatsappQr | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [agentBoard, setAgentBoard] = useState<AgentRuntimeSnapshot[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const prevOk = useRef<boolean | null>(null);
  const prevWa = useRef<boolean | null>(null);
  const confirm = useConfirm();

  const pushLog = useCallback((ok: boolean, message: string) => {
    setLog((prev) => [{ at: new Date().toISOString(), ok, message }, ...prev].slice(0, LOG_MAX));
  }, []);

  const notify = useCallback(
    (title: string, body: string) => {
      if (!alertsOn || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification(title, { body, tag: "sol-monitor" });
      } catch {
        /* ignore */
      }
    },
    [alertsOn],
  );

  const refreshAgents = useCallback(async (waConnected: boolean | null) => {
    setAgentsLoading(true);
    try {
      const settled = await Promise.allSettled([
        listRemitos({ pendientes: true, limit: 200 }),
        listDestinos({ limit: 200 }),
        listViajes({ limit: 200 }),
        resumenRendicion(),
        resumenIncidencias(),
        resumenEta(),
        resumenReclamos(),
        resumenPods(),
      ]);

      const remitos = settled[0].status === "fulfilled" ? settled[0].value : [];
      const destinos = settled[1].status === "fulfilled" ? settled[1].value : [];
      const viajes = settled[2].status === "fulfilled" ? settled[2].value : [];
      const rendicion = settled[3].status === "fulfilled" ? settled[3].value : null;
      const incidencias = settled[4].status === "fulfilled" ? settled[4].value : null;
      const eta = settled[5].status === "fulfilled" ? settled[5].value : null;
      const reclamos = settled[6].status === "fulfilled" ? settled[6].value : null;
      const pods = settled[7].status === "fulfilled" ? settled[7].value : null;

      const destinosEsperandoCliente = destinos.filter((d) => d.estado === "esperando_cliente").length;
      const destinosEnCurso = destinos.filter(
        (d) => d.estado === "esperando_eta_chofer" || d.estado === "en_ruta",
      ).length;
      const viajesActivos = viajes.filter((v) => v.estado === "en_curso" || v.estado === "asignado").length;
      const viajesPendientes = viajes.filter((v) => v.estado === "solicitado").length;

      setAgentBoard(
        buildAgentRuntimeBoard({
          remitosPendientes: remitos.length,
          destinosEsperandoCliente,
          destinosEnCurso,
          viajesActivos,
          viajesPendientes,
          rendicion,
          incidencias,
          eta,
          reclamos,
          pods,
          waConnected,
        }),
      );
    } catch {
      setAgentBoard(buildAgentRuntimeBoard({ waConnected }));
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await fetchMonitorStatus();
      setData(status);
      setError(null);

      const waOk = status.services.whatsapp.ok;
      if (waOk) {
        setShowQr(false);
        setQr(null);
      }

      if (prevOk.current !== null && prevOk.current !== status.ok) {
        if (!status.ok) {
          pushLog(false, "Sistema degradado o caído");
          notify(`⚠️ ${BRAND.name} — alerta`, "Uno o más servicios dejaron de responder.");
        } else {
          pushLog(true, "Todos los servicios OK");
          notify(`✅ ${BRAND.name} — recuperado`, "Los servicios volvieron a la normalidad.");
        }
      }

      if (prevWa.current !== null && prevWa.current !== waOk) {
        if (!waOk) {
          pushLog(false, "WhatsApp desconectado");
          notify("📱 WhatsApp caído", "El bot perdió la sesión. Abrí Monitor → Mostrar QR.");
        } else {
          pushLog(true, "WhatsApp reconectado");
          notify("📱 WhatsApp OK", "Sesión WhatsApp activa de nuevo.");
        }
      }

      prevOk.current = status.ok;
      prevWa.current = waOk;
      document.title = status.ok ? `Monitor · ${BRAND.name}` : `⚠ Monitor · ${BRAND.name}`;

      void refreshAgents(waOk);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de monitoreo";
      setError(msg);
      if (prevOk.current !== false) {
        pushLog(false, msg);
        notify(`⚠️ ${BRAND.name} — API inaccesible`, msg);
      }
      prevOk.current = false;
      document.title = `⚠ Monitor · ${BRAND.name}`;
      void refreshAgents(false);
    } finally {
      setLoading(false);
    }
  }, [notify, pushLog, refreshAgents]);

  const loadQr = useCallback(async () => {
    setQrLoading(true);
    try {
      const payload = await fetchMonitorWhatsappQr();
      setQr(payload);
      setShowQr(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cargar el QR";
      setQr({ ok: false, connected: false, message: msg });
      setShowQr(true);
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!data || data.services.whatsapp.ok) return;
    if (!showQr) return;
    const id = window.setInterval(() => void loadQr(), 12_000);
    return () => window.clearInterval(id);
  }, [data, showQr, loadQr]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function toggleAlerts() {
    if (typeof Notification === "undefined") {
      await confirm({
        title: "Notificaciones no disponibles",
        message: "Tu navegador no soporta notificaciones de escritorio.",
        alert: true,
        variant: "warning",
      });
      return;
    }
    if (Notification.permission === "granted") {
      setAlertsOn((v) => !v);
      return;
    }
    const perm = await Notification.requestPermission();
    setAlertsOn(perm === "granted");
  }

  const services = data
    ? [data.services.api, data.services.bot, data.services.whatsapp, data.services.webhook]
    : [];

  const counts = useMemo(() => runtimeCounts(agentBoard), [agentBoard]);
  const bySlug = useMemo(() => new Map(agentBoard.map((r) => [r.slug, r])), [agentBoard]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitor de servicios"
        subtitle={`Chequeo cada ${POLL_MS / 1000}s · infraestructura + estado de agentes`}
        icon={<Activity size={24} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              <RefreshCw size={16} className={loading || agentsLoading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => void toggleAlerts()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              {alertsOn ? <Bell size={16} /> : <BellOff size={16} />}
              {alertsOn ? "Alertas ON" : "Activar alertas"}
            </button>
          </div>
        }
      />

      {/* Banner global */}
      <div
        className={`rounded-2xl border p-5 ${
          error
            ? "border-red-500/40 bg-red-500/10"
            : data?.ok
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/10"
        }`}
      >
        <div className="flex items-start gap-4">
          {error || !data?.ok ? (
            <XCircle className="mt-0.5 shrink-0 text-red-400" size={28} />
          ) : (
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={28} />
          )}
          <div>
            <p className="font-[var(--font-display)] text-xl font-bold text-white">
              {error
                ? "No se pudo contactar la API"
                : data?.ok
                  ? "Todo operativo"
                  : "Atención — hay servicios caídos"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              {error ??
                (data?.checked_at
                  ? `Último chequeo: ${fmtTime(data.checked_at)}`
                  : "Esperando primer chequeo…")}
            </p>
            {data?.hints && data.hints.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-amber-200/90">
                {data.hints.map((h) => (
                  <li key={h}>→ {h}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp QR */}
      {data && !data.services.whatsapp.ok && (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <QrCode size={20} />
                Vincular WhatsApp
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[var(--text-dim)]">
                Baileys <strong className="font-medium text-white/90">reconecta solo</strong> ante cortes de
                red. Si la sesión expiró o cerraste sesión en el teléfono, escaneá el QR acá (se renueva cada
                ~60 s).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadQr()}
                disabled={qrLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <QrCode size={16} className={qrLoading ? "animate-pulse" : ""} />
                {showQr ? "Actualizar QR" : "Mostrar QR"}
              </button>
            </div>
          </div>

          {showQr && (
            <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {qr?.image_base64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr.image_base64}
                  alt="QR WhatsApp Baileys"
                  className="h-56 w-56 rounded-xl border border-white/10 bg-white p-2"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-center text-sm text-[var(--text-dim)]">
                  {qrLoading ? "Cargando QR…" : "Sin QR todavía"}
                </div>
              )}
              <div className="text-sm text-[var(--text-dim)]">
                <p className="text-white/90">{qr?.message ?? "Tocá «Mostrar QR» para generar la vista."}</p>
                {qr?.qr_updated_at && (
                  <p className="mt-2 tabular text-xs text-[var(--text-faint)]">
                    QR del bot: {fmtTime(qr.qr_updated_at)}
                  </p>
                )}
                {qr?.connected && qr.phone && (
                  <p className="mt-2 text-emerald-300">Conectado: {qr.phone}</p>
                )}
                <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs">
                  <li>WhatsApp en el celular → Dispositivos vinculados</li>
                  <li>Vincular dispositivo → Escanear QR</li>
                  <li>Apuntá a este código (actualizalo si pasó 1 minuto)</li>
                </ol>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tarjetas por servicio */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          <Server size={14} />
          Infraestructura
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((svc) => (
            <Card key={svc.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      svc.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {serviceIcon(svc.id)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{serviceLabel(svc.id)}</p>
                    <Pill color={svc.ok ? "#22c55e" : "#ef4444"}>{svc.ok ? "OK" : "CAÍDO"}</Pill>
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-[var(--text-dim)]">
                {svc.latency_ms != null && svc.latency_ms > 0 && (
                  <div className="flex justify-between">
                    <dt>Latencia</dt>
                    <dd className="tabular text-white">{svc.latency_ms} ms</dd>
                  </div>
                )}
                {svc.phone && (
                  <div className="flex justify-between">
                    <dt>Número bot</dt>
                    <dd className="text-white">{svc.phone}</dd>
                  </div>
                )}
                {svc.detail && (
                  <div>
                    <dt className="mb-0.5">Detalle</dt>
                    <dd className="text-white/90">{svc.detail}</dd>
                  </div>
                )}
                {svc.error && (
                  <div>
                    <dt className="mb-0.5 text-red-300">Error</dt>
                    <dd className="text-red-200">{svc.error}</dd>
                  </div>
                )}
              </dl>
            </Card>
          ))}
          {loading && services.length === 0 && (
            <p className="col-span-full text-sm text-[var(--text-dim)]">Cargando estado…</p>
          )}
        </div>
      </div>

      {/* Estado de agentes */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            <Radio size={14} />
            Agentes involucrados
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["activo", "en_espera", "en_hold", "offline"] as AgentRuntimeState[]).map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-dim)]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: RUNTIME_COLOR[s] }}
                />
                {RUNTIME_LABEL[s]}
                <strong className="tabular text-white">{counts[s]}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Activo = con cola o procesando
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            En espera = online sin trabajo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PauseCircle size={12} className="text-amber-400" />
            En hold = espera humana / cliente / chofer
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {agents.map((agent) => {
            const row = bySlug.get(agent.slug) ?? {
              slug: agent.slug,
              state: "en_espera" as const,
              detail: agentsLoading ? "Consultando colas…" : "Sin métrica",
              queue: 0,
            };
            return <AgentRuntimeCard key={agent.slug} agent={agent} row={row} />;
          })}
        </div>
      </div>

      {/* Historial de eventos */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Eventos recientes (esta sesión)
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Sin cambios de estado aún. Dejá esta pestaña abierta para recibir alertas si algo cae.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto scroll-thin">
            {log.map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${e.ok ? "bg-emerald-400" : "bg-red-400"}`}
                />
                <span className="tabular text-[var(--text-faint)]">{fmtTime(e.at)}</span>
                <span className={e.ok ? "text-emerald-200" : "text-red-200"}>{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
