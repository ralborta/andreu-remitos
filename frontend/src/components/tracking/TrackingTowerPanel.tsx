"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getTrackingPilotMetrics,
  getTrackingTripHistory,
  getTrackingTripLive,
  listActiveTrackingTrips,
  listViajes,
  type TrackingHistoryResponse,
  type TrackingLiveResponse,
  type TrackingTripState,
  type Viaje,
} from "@/lib/api";
import { Card, SectionTitle } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TrackingTone = "green" | "amber" | "red" | "gray" | "blue";

const TONE_HEX: Record<TrackingTone, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  gray: "#6b7280",
  blue: "#0284c7",
};

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    if (!document.querySelector("link[data-andreu-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.andreuLeaflet = "1";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-andreu-leaflet]");
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", () => reject(new Error("Leaflet error")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.dataset.andreuLeaflet = "1";
    s.onload = () => resolve((window as any).L);
    s.onerror = () => reject(new Error("No se pudo cargar el mapa"));
    document.head.appendChild(s);
  });
}

function leafletDot(L: any, color: string, pulse: boolean) {
  const size = pulse ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid #fff;box-shadow:0 0 0 ${pulse ? 5 : 0}px ${color}55"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function trackingTone(status?: string | null, ageSec?: number | null, accuracy?: number | null): TrackingTone {
  const s = String(status || "NOT_STARTED");
  if (["COMPLETED", "ARRIVED"].includes(s)) return "blue";
  if (["CANCELLED", "STOPPED_BY_DRIVER"].includes(s)) return "gray";
  if (s === "NOT_STARTED" || s === "AWAITING_PERMISSION") return "gray";
  if (s === "PERMISSION_DENIED") return "red";
  if (ageSec != null && ageSec > 300) return "red";
  if (["STALE", "BACKGROUND_SUSPECTED", "OFFLINE"].includes(s)) return "amber";
  if (s === "LOW_ACCURACY" || (accuracy != null && accuracy > 100)) return "amber";
  if (ageSec != null && ageSec > 120) return "amber";
  if (s === "ACTIVE" && (ageSec == null || ageSec <= 90)) return "green";
  return "amber";
}

function formatAge(sec: number | null | undefined) {
  if (sec == null) return "sin datos";
  if (sec < 60) return `hace ${sec} segundos`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `hace ${m} min ${s} s` : `hace ${m} min`;
}

function ageFromIso(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

type TowerRow = {
  tripId: string;
  viaje: Viaje | null;
  state: TrackingTripState | null;
  ageSec: number | null;
  tone: TrackingTone;
  alerts: string[];
};

function buildAlerts(state: TrackingTripState | null, ageSec: number | null): string[] {
  const alerts: string[] = [];
  const status = state?.status;
  if (!state || !status || status === "NOT_STARTED") {
    alerts.push("Tracking no iniciado");
    return alerts;
  }
  if (status === "PERMISSION_DENIED") alerts.push("Permiso de ubicación denegado");
  if (ageSec != null && ageSec > 300) alerts.push("Sin posición > 5 min (crítico)");
  else if (ageSec != null && ageSec > 120) alerts.push("Posición antigua (stale)");
  if (status === "BACKGROUND_SUSPECTED") alerts.push("Posible suspensión del navegador");
  if (status === "OFFLINE") alerts.push("Chofer offline / pendientes");
  if (
    status === "LOW_ACCURACY" ||
    (state.accuracy != null && state.accuracy > 100)
  ) {
    alerts.push("Baja precisión GPS");
  }
  return alerts;
}

const POLL_MS = 12_000;

export function TrackingTowerPanel() {
  const [rows, setRows] = useState<TowerRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<TrackingLiveResponse | null>(null);
  const [history, setHistory] = useState<TrackingHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [pilotLabel, setPilotLabel] = useState<string | null>(null);
  const [metricsLine, setMetricsLine] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const trailRef = useRef<any>(null);
  const Lref = useRef<any>(null);

  const loadList = useCallback(async () => {
    try {
      const [activeRes, viajes, metrics] = await Promise.all([
        listActiveTrackingTrips(),
        listViajes({ limit: 100 }),
        getTrackingPilotMetrics().catch(() => null),
      ]);
      setDisabled(false);
      if (metrics?.gate) {
        const g = metrics.gate as {
          pilot?: boolean;
          gated?: boolean;
          tenants_mode?: string;
          phones_mode?: string;
          phones_size?: number | null;
        };
        if (g.pilot || g.gated) {
          setPilotLabel(
            `Piloto · tenants:${g.tenants_mode} · phones:${g.phones_mode}${
              g.phones_size != null ? `(${g.phones_size})` : ""
            }`,
          );
        } else {
          setPilotLabel("Modo abierto (*)");
        }
        setMetricsLine(
          `24h: ${metrics.last24h.positions} pos · ${metrics.last24h.waSent} WA · ${metrics.last24h.podsCompleted} POD · live stale ${metrics.live.stale}`,
        );
      }
      const byId = new Map(viajes.map((v) => [v.id, v]));
      const activeIds = new Set(activeRes.trips.map((t) => t.trip_id));

      const fromTracking: TowerRow[] = activeRes.trips.map((state) => {
        const ageSec =
          state.position_age_seconds ?? ageFromIso(state.last_position_at);
        return {
          tripId: state.trip_id,
          viaje: byId.get(state.trip_id) || null,
          state,
          ageSec,
          tone: trackingTone(state.status, ageSec, state.accuracy),
          alerts: buildAlerts(state, ageSec),
        };
      });

      // Viajes operativos sin tracking activo (gris)
      const operativos = viajes.filter(
        (v) =>
          ["asignado", "en_curso"].includes(v.estado) && !activeIds.has(v.id),
      );
      const without: TowerRow[] = operativos.map((v) => ({
        tripId: v.id,
        viaje: v,
        state: null,
        ageSec: null,
        tone: "gray" as const,
        alerts: ["Tracking no iniciado"],
      }));

      const merged = [...fromTracking, ...without].sort((a, b) => {
        const order = { red: 0, amber: 1, green: 2, blue: 3, gray: 4 };
        return order[a.tone] - order[b.tone];
      });
      setRows(merged);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      if (/feature_disabled|no habilitado|404/i.test(msg)) {
        setDisabled(true);
        setRows([]);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (tripId: string) => {
    try {
      const [l, h] = await Promise.all([
        getTrackingTripLive(tripId),
        getTrackingTripHistory(tripId),
      ]);
      setLive(l);
      setHistory(h);
    } catch (err) {
      setLive(null);
      setHistory(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar detalle");
    }
  }, []);

  useEffect(() => {
    void loadList();
    const t = setInterval(() => void loadList(), POLL_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setLive(null);
      setHistory(null);
      return;
    }
    void loadDetail(selectedId);
    const t = setInterval(() => void loadDetail(selectedId), POLL_MS);
    return () => clearInterval(t);
  }, [selectedId, loadDetail]);

  // Mapa: boot una vez
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        Lref.current = L;
        mapRef.current.innerHTML = "";
        const map = L.map(mapRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([-34.6, -58.4], 6);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 18,
        }).addTo(map);
        mapObjRef.current = map;
        setTimeout(() => map.invalidateSize(), 80);
        setMapReady(true);
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "Error de mapa");
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
      mapObjRef.current?.remove?.();
      mapObjRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Actualizar marcadores sin interpolar
  useEffect(() => {
    const map = mapObjRef.current;
    const L = Lref.current;
    if (!map || !L) return;

    const seen = new Set<string>();
    const bounds: [number, number][] = [];

    for (const row of rows) {
      const pos = row.state?.last_position;
      if (!pos || !Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude)) continue;
      seen.add(row.tripId);
      bounds.push([pos.latitude, pos.longitude]);
      const color = TONE_HEX[row.tone];
      const pulse = row.tone === "green";
      let marker = markersRef.current.get(row.tripId);
      if (!marker) {
        marker = L.marker([pos.latitude, pos.longitude], {
          icon: leafletDot(L, color, pulse),
        }).addTo(map);
        marker.on("click", () => setSelectedId(row.tripId));
        markersRef.current.set(row.tripId, marker);
      } else {
        // Solo saltar a la última posición reportada (nunca animar entre puntos)
        marker.setLatLng([pos.latitude, pos.longitude]);
        marker.setIcon(leafletDot(L, color, pulse));
      }
      const codigo = row.viaje?.codigo || row.tripId;
      const age = formatAge(row.ageSec);
      const acc =
        row.state?.accuracy != null ? `±${Math.round(row.state.accuracy)} m` : "—";
      marker.bindPopup(
        `<div style="font:12px/1.4 system-ui;max-width:220px">
          <strong>${codigo}</strong><br/>
          ${row.viaje?.chofer || "—"} · ${row.viaje?.tractor || "—"}<br/>
          Estado: ${row.state?.status || "NOT_STARTED"}<br/>
          Última ubicación: ${age}<br/>
          Precisión: ${acc}<br/>
          Fuente: navegador del chofer
        </div>`,
      );
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    if (!selectedId && bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [rows, selectedId]);

  // Trail del viaje seleccionado
  useEffect(() => {
    const map = mapObjRef.current;
    const L = Lref.current;
    if (!map || !L) return;
    if (trailRef.current) {
      map.removeLayer(trailRef.current);
      trailRef.current = null;
    }
    const pts = (history?.positions || [])
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => [p.latitude, p.longitude] as [number, number]);
    if (pts.length >= 2) {
      trailRef.current = L.polyline(pts, {
        color: "#7c3aed",
        weight: 3,
        opacity: 0.75,
      }).addTo(map);
      map.fitBounds(trailRef.current.getBounds(), { padding: [36, 36], maxZoom: 14 });
    } else if (selectedId) {
      const row = rows.find((r) => r.tripId === selectedId);
      const pos = row?.state?.last_position;
      if (pos) map.setView([pos.latitude, pos.longitude], 13);
    }
  }, [history, selectedId, rows]);

  const selected = useMemo(
    () => rows.find((r) => r.tripId === selectedId) || null,
    [rows, selectedId],
  );

  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0, gray: 0, blue: 0 };
    for (const r of rows) c[r.tone] += 1;
    return c;
  }, [rows]);

  if (disabled) {
    return (
      <Card>
        <SectionTitle>Torre Tracking Express</SectionTitle>
        <p className="text-sm text-[var(--text-dim)]">
          El módulo está desactivado. Activá{" "}
          <code className="text-xs">SOL_TRACKING_EXPRESS_ENABLED=true</code> en el API
          para ver la torre.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-[var(--font-display)] text-lg font-bold text-[var(--text)]">
            Torre Tracking Express
          </h3>
          <p className="text-sm text-[var(--text-dim)]">
            Posiciones reales del chofer · actualización cada {POLL_MS / 1000}s · sin interpolación
          </p>
          {pilotLabel && (
            <p className="mt-1 text-xs font-semibold text-[var(--violet)]">{pilotLabel}</p>
          )}
          {metricsLine && (
            <p className="text-xs text-[var(--text-faint)]">{metricsLine}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["green", "Reciente"],
              ["amber", "Antigua / baja prec."],
              ["red", "Perdido"],
              ["gray", "No iniciado"],
              ["blue", "Llegado"],
            ] as const
          ).map(([tone, label]) => (
            <span
              key={tone}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[var(--text-dim)]"
              style={{ background: `${TONE_HEX[tone]}18` }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: TONE_HEX[tone] }}
              />
              {counts[tone]} {label}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-[var(--red)]/30 bg-[var(--red)]/10 px-3 py-2 text-sm text-[var(--red)]">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="!p-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[#0c0a18] sm:aspect-[16/10]">
            <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
            {!mapReady && !mapError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-[var(--text-faint)]">
                Cargando mapa…
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-xs text-[var(--amber)]">
                {mapError}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-black/50 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              Solo última posición reportada
            </div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <SectionTitle>Viajes activos</SectionTitle>
            {loading && (
              <p className="text-xs text-[var(--text-faint)]">Cargando…</p>
            )}
          </div>
          <ul className="max-h-[420px] divide-y divide-[var(--border-soft)] overflow-y-auto">
            {rows.length === 0 && !loading ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">
                No hay viajes con tracking ni asignados en curso.
              </li>
            ) : (
              rows.map((row) => {
                const active = row.tripId === selectedId;
                return (
                  <li key={row.tripId}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId((id) => (id === row.tripId ? null : row.tripId))
                      }
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-[var(--overlay)] ${
                        active ? "bg-[var(--overlay-strong)]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text)]">
                          {row.viaje?.codigo || row.tripId}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            color: TONE_HEX[row.tone],
                            background: `${TONE_HEX[row.tone]}22`,
                          }}
                        >
                          {row.state?.status || "NOT_STARTED"}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-dim)]">
                        {row.viaje?.chofer || "Sin chofer"} ·{" "}
                        {row.viaje?.tractor || "Sin unidad"}
                      </p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {row.viaje?.origen || "—"} → {row.viaje?.destino || "—"}
                      </p>
                      <p className="text-xs text-[var(--text-dim)]">
                        Última ubicación: {formatAge(row.ageSec)}
                        {row.state?.accuracy != null
                          ? ` · Precisión ±${Math.round(row.state.accuracy)} m`
                          : ""}
                      </p>
                      {row.alerts.length > 0 && (
                        <p className="text-xs text-[var(--amber)]">{row.alerts[0]}</p>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      </div>

      {selected && (
        <Card>
          <SectionTitle>
            Detalle · {selected.viaje?.codigo || selected.tripId}
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase text-[var(--text-faint)]">Estado tracking</p>
              <p className="font-semibold" style={{ color: TONE_HEX[selected.tone] }}>
                {live?.tracking?.status || selected.state?.status || "NOT_STARTED"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--text-faint)]">Última ubicación</p>
              <p className="text-sm font-medium text-[var(--text)]">
                {formatAge(
                  live?.tracking?.position_age_seconds ??
                    ageFromIso(live?.tracking?.last_position_at) ??
                    selected.ageSec,
                )}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--text-faint)]">Precisión</p>
              <p className="text-sm font-medium text-[var(--text)]">
                {live?.tracking?.accuracy != null || selected.state?.accuracy != null
                  ? `±${Math.round(live?.tracking?.accuracy ?? selected.state?.accuracy ?? 0)} metros`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[var(--text-faint)]">Fuente</p>
              <p className="text-sm font-medium text-[var(--text)]">
                navegador del chofer
              </p>
            </div>
          </div>

          {(selected.alerts.length > 0 || (live?.tracking?.status && buildAlerts(live.tracking as TrackingTripState, ageFromIso(live.tracking.last_position_at)).length > 0)) && (
            <div className="mt-4 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/10 px-3 py-2">
              <p className="text-xs font-semibold text-[var(--amber)]">Alertas</p>
              <ul className="mt-1 list-inside list-disc text-sm text-[var(--text-dim)]">
                {buildAlerts(
                  (live?.tracking as TrackingTripState) || selected.state,
                  live?.tracking?.position_age_seconds ??
                    ageFromIso(live?.tracking?.last_position_at) ??
                    selected.ageSec,
                ).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text)]">
                Historial de recorrido ({history?.positions.length ?? 0} pts)
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--text-dim)]">
                {(history?.positions || []).slice(-30).reverse().map((p) => (
                  <li key={p.id} className="font-mono">
                    #{p.sequence} · {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    {p.accuracy != null ? ` · ±${Math.round(p.accuracy)}m` : ""} ·{" "}
                    {new Date(p.recorded_at).toLocaleTimeString("es-AR")}
                  </li>
                ))}
                {!history?.positions?.length && (
                  <li>Sin posiciones todavía.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--text)]">
                Eventos ({history?.events.length ?? 0})
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-[var(--text-dim)]">
                {(history?.events || []).slice(-25).reverse().map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold text-[var(--text)]">{e.type}</span>
                    {" · "}
                    {new Date(e.occurred_at).toLocaleString("es-AR")}
                  </li>
                ))}
                {!history?.events?.length && <li>Sin eventos.</li>}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
