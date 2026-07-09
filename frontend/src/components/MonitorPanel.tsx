"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellOff,
  Bot,
  CheckCircle2,
  Globe,
  MessageCircle,
  QrCode,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { fetchMonitorStatus, fetchMonitorWhatsappQr } from "@/lib/api";
import { useConfirm } from "@/lib/confirm-context";
import type { MonitorStatus, MonitorWhatsappQr } from "@/lib/monitor-types";
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
      return "API Andreu";
    case "bot":
      return "Bot Baileys (HTTP)";
    case "whatsapp":
      return "WhatsApp";
    case "webhook":
      return "Webhook remitos";
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

export function MonitorPanel() {
  const [data, setData] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [qr, setQr] = useState<MonitorWhatsappQr | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
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
        new Notification(title, { body, tag: "andreu-monitor" });
      } catch {
        /* ignore */
      }
    },
    [alertsOn],
  );

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
          notify("⚠️ Andreu — alerta", "Uno o más servicios dejaron de responder.");
        } else {
          pushLog(true, "Todos los servicios OK");
          notify("✅ Andreu — recuperado", "Los servicios volvieron a la normalidad.");
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
      document.title = status.ok ? "Monitor · Andreu" : "⚠ Monitor · Andreu";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de monitoreo";
      setError(msg);
      if (prevOk.current !== false) {
        pushLog(false, msg);
        notify("⚠️ Andreu — API inaccesible", msg);
      }
      prevOk.current = false;
      document.title = "⚠ Monitor · Andreu";
    } finally {
      setLoading(false);
    }
  }, [notify, pushLog]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitor de servicios"
        subtitle={`Chequeo automático cada ${POLL_MS / 1000}s · API, bot WhatsApp y webhook`}
        icon={<Activity size={24} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
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
