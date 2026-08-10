"use client";

import { useEffect, useRef, useState } from "react";
import {
  trips,
  CIUDADES,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  tripLatLng,
  type Trip,
} from "@/lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mapa real de flota (Carto dark / OSM).
 * No usamos Google Maps acá: la key del proyecto no sirve para Maps JS en el browser
 * (ApiNotActivated / billing). Leaflet + tiles oscuros dan el mismo UX con los puntos.
 */

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    if (!document.querySelector('link[data-andreu-leaflet]')) {
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

function leafletDivIcon(L: any, color: string, pulse: boolean) {
  const size = pulse ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid #0c0a18;box-shadow:0 0 0 ${pulse ? 6 : 0}px ${color}55"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function popupHtml(t: Trip) {
  const color = TRIP_STATUS_COLOR[t.estado];
  return `<div style="font:12px/1.4 system-ui,sans-serif;max-width:220px;color:#111">
    <div style="font-weight:700;margin-bottom:2px">${t.id} · ${t.cliente}</div>
    <div style="color:#555">${t.origen} → ${t.destino}</div>
    <div style="margin-top:6px;display:flex;align-items:center;gap:6px;color:#444">
      <span style="width:8px;height:8px;border-radius:99px;background:${color};display:inline-block"></span>
      ${TRIP_STATUS_LABEL[t.estado]} · ${t.chofer}${t.eta !== "—" ? ` · ETA ${t.eta}` : ""}
    </div>
  </div>`;
}

export function FleetMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const detenidos = trips.filter((t) => t.estado === "detenido").length;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        mapRef.current.innerHTML = "";

        const map = L.map(mapRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([-34.6, -64.0], 5);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 18,
        }).addTo(map);

        const bounds: [number, number][] = [];

        for (const [name, p] of Object.entries(CIUDADES)) {
          L.circleMarker([p.lat, p.lng], {
            radius: 3,
            color: "#6f6796",
            fillColor: "#6f6796",
            fillOpacity: 0.9,
            weight: 0,
          })
            .bindTooltip(name, { direction: "top", opacity: 0.9 })
            .addTo(map);
          bounds.push([p.lat, p.lng]);
        }

        for (const t of trips.filter((x) => x.estado === "en_curso" || x.estado === "detenido")) {
          const o = CIUDADES[t.origen];
          const d = CIUDADES[t.destino];
          if (!o || !d) continue;
          L.polyline(
            [
              [o.lat, o.lng],
              [d.lat, d.lng],
            ],
            { color: "#6f5aad", weight: 2, opacity: 0.65 },
          ).addTo(map);
        }

        for (const t of trips) {
          const pos = tripLatLng(t);
          if (!pos) continue;
          const color = TRIP_STATUS_COLOR[t.estado];
          const m = L.marker([pos.lat, pos.lng], {
            icon: leafletDivIcon(L, color, t.estado === "en_curso"),
          }).addTo(map);
          m.bindPopup(popupHtml(t));
          m.on("mouseover", () => {
            setHover(t.id);
            m.openPopup();
          });
          m.on("mouseout", () => setHover(null));
          bounds.push([pos.lat, pos.lng]);
        }

        if (bounds.length) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
        }

        // Leaflet a veces necesita invalidateSize tras el layout
        setTimeout(() => map.invalidateSize(), 80);

        cleanupRef.current = () => map.remove();
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar el mapa");
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[var(--text-dim)]">
          <span className="h-2 w-2 rounded-full" style={{ background: "#38bdf8" }} />
          {activos} en curso
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[var(--text-dim)]">
          <span className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />
          {detenidos} detenidos
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[var(--text-dim)]">
          <span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
          entregados
        </span>
        {hover && (
          <span className="text-[var(--text-faint)]">{trips.find((t) => t.id === hover)?.id}</span>
        )}
      </div>

      <div className="surface-dark relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0c0a18]">
        <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />

        {!ready && !error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-[var(--text-faint)]">
            Cargando mapa…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-xs text-[var(--amber)]">
            No se pudo cargar el mapa: {error}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)] backdrop-blur">
          Flota en tiempo real · Argentina
        </div>
      </div>
    </div>
  );
}
