"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Clock, MessageCircle, RefreshCw } from "lucide-react";
import {
  avisarEtaIncidencia,
  listEtaCola,
  listEtaNotificaciones,
  notificarEtaDestino,
  resumenEta,
  type EtaColaItem,
  type EtaNotificacion,
  type ResumenEta,
} from "@/lib/api";
import { useConfirm } from "@/lib/confirm-context";
import { Card, KpiCard, Pill, SectionTitle } from "./ui";

function fuentePill(fuente: string) {
  if (fuente === "incidencia") return <Pill color="#f59e0b">Incidencia</Pill>;
  if (fuente === "viaje") return <Pill color="#38bdf8">Viaje</Pill>;
  return <Pill color="#a78bfa">Destino / Viajes</Pill>;
}

export function EtaPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<EtaColaItem[]>([]);
  const [notif, setNotif] = useState<EtaNotificacion[]>([]);
  const [sum, setSum] = useState<ResumenEta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cola, resumen, logs] = await Promise.all([
        listEtaCola({ limit: 80 }),
        resumenEta(),
        listEtaNotificaciones({ limit: 20 }),
      ]);
      setRows(cola);
      setSum(resumen);
      setNotif(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar ETA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function notificar(item: EtaColaItem, demora: boolean) {
    const title = demora ? "Avisar demora al cliente" : "Enviar ETA al cliente";
    const ok = await confirm({
      title,
      message:
        `${item.cliente} · ${item.telefonoCliente || "sin tel"}\n` +
        `${item.destino}\n` +
        `ETA: ${item.etaTexto || "(sin estimado)"}\n\n` +
        `Se envía por WhatsApp (agente ETA ↔ Viajes / Incidencias).`,
      confirmLabel: demora ? "Avisar demora" : "Enviar WhatsApp",
    });
    if (!ok) return;
    setBusyId(item.id);
    setError(null);
    try {
      if (item.fuente === "incidencia") {
        await avisarEtaIncidencia(item.refId, {
          etaTexto: item.etaTexto || undefined,
        });
      } else {
        await notificarEtaDestino(item.refId, {
          demora,
          etaTexto: item.etaTexto || undefined,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude notificar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="En cola" value={String(sum?.enCola ?? "—")} hint="activos" />
        <KpiCard label="Con ETA" value={String(sum?.conEta ?? "—")} hint="listos para avisar" />
        <KpiCard
          label="Esperando chofer"
          value={String(sum?.esperandoChofer ?? "—")}
          hint="sin estimado aún"
        />
        <KpiCard
          label="Avisos hoy"
          value={String(sum?.notificacionesHoy ?? "—")}
          hint={`${sum?.demorasNotificadasHoy ?? 0} demoras`}
        />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Clock size={16} className="text-[var(--violet-2)]" />
              Cola ETA · WhatsApp al cliente
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              Se comunica con Gestión de Viajes (viaje/destino) e Incidencias (demoras). El aviso
              sale por WhatsApp al cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-[var(--text-dim)] hover:bg-white/10"
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Todavía no hay ETAs. Confirmá un destino (agente Destinos / Viajes) o registrá una
            demora en Incidencias.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Fuente</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Destino</th>
                  <th className="py-2 pr-3 font-medium">ETA</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)]/60 hover:bg-white/[0.03]"
                  >
                    <td className="py-3 pr-3">
                      {fuentePill(r.fuente)}
                      {r.codigoIncidencia && (
                        <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                          {r.codigoIncidencia}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">
                      <div className="font-medium text-white">{r.cliente}</div>
                      <div className="text-xs text-[var(--text-faint)]">
                        {r.telefonoCliente || "sin tel"}
                      </div>
                    </td>
                    <td className="max-w-[220px] py-3 pr-3 text-[var(--text-dim)]">
                      <div className="truncate">{r.destino}</div>
                      <div className="text-[10px] text-[var(--text-faint)]">
                        {r.viaje !== "—" ? r.viaje : r.chofer}
                      </div>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-white">
                      {r.etaTexto || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Pill
                        color={
                          r.fuente === "incidencia"
                            ? "#f59e0b"
                            : r.estado === "esperando_eta_chofer"
                              ? "#38bdf8"
                              : "#22c55e"
                        }
                      >
                        {r.estadoLabel}
                      </Pill>
                      {r.causa && (
                        <div className="mt-1 max-w-[160px] truncate text-[10px] text-[var(--text-faint)]">
                          {r.causa}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {r.fuente === "destino" && (
                          <button
                            type="button"
                            disabled={busyId === r.id || !r.puedeNotificar}
                            onClick={() => void notificar(r, false)}
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40",
                              "bg-[var(--violet)] hover:bg-[var(--violet)]/90",
                            )}
                          >
                            <MessageCircle size={13} />
                            Avisar ETA
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === r.id || !r.puedeNotificar}
                          onClick={() => void notificar(r, true)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
                        >
                          <MessageCircle size={13} />
                          Demora
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Últimos avisos WhatsApp</SectionTitle>
        {notif.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Todavía no hay notificaciones enviadas.</p>
        ) : (
          <ul className="space-y-2">
            {notif.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill color={n.tipo === "demora" ? "#f59e0b" : "#22c55e"}>
                    {n.tipo}
                  </Pill>
                  <span className="text-white">{n.cliente || n.telefono_cliente}</span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {new Date(n.created_at).toLocaleString("es-AR")}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--text-dim)]">
                  {n.mensaje}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
