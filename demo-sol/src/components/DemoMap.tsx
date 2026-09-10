"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_TRIPS,
  STATUS_COLOR,
  STATUS_LABEL,
  tripPosition,
  type DemoTrip,
} from "../lib/seed";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Mismo basemap y markers que FleetMap del UI SOL (CARTO Voyager). */
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    if (!document.querySelector('link[data-sol-demo-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.solDemoLeaflet = "1";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-sol-demo-leaflet]");
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", () => reject(new Error("Leaflet error")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.async = true;
    s.dataset.solDemoLeaflet = "1";
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

export function DemoMap({ trips = DEMO_TRIPS }: { trips?: DemoTrip[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: any;

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(
          [-34.6, -64.0],
          5,
        );
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 18,
        }).addTo(map);

        const bounds: [number, number][] = [];
        for (const t of trips) {
          const pos = tripPosition(t);
          if (!pos) continue;
          const color = STATUS_COLOR[t.estado] || "#38bdf8";

          if (t.estado === "en_curso" || t.estado === "demorado") {
            L.polyline(
              [
                [pos.origin.lat, pos.origin.lng],
                [pos.dest.lat, pos.dest.lng],
              ],
              { color: "#6f5aad", weight: 2, opacity: 0.55 },
            ).addTo(map);
          }

          const m = L.marker([pos.lat, pos.lng], {
            icon: leafletDivIcon(L, color, t.estado === "en_curso" || t.estado === "demorado"),
          }).addTo(map);
          m.bindPopup(
            `<div style="font:12px/1.4 system-ui;color:#111;min-width:180px">
                <b>${t.id}</b> · ${t.cliente}<br/>
                ${t.origen} → ${t.destino}<br/>
                ${STATUS_LABEL[t.estado]} · ${t.chofer}${t.eta !== "—" ? ` · ETA ${t.eta}` : ""}
              </div>`,
          );
          bounds.push([pos.lat, pos.lng]);
        }

        if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
        setTimeout(() => map.invalidateSize(), 80);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de mapa");
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [trips]);

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-[#eaf2f8]">
      <div ref={ref} className="absolute inset-0 z-0" />
      {!ready && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm text-slate-500">
          Cargando mapa de flota…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg bg-slate-800/70 px-3 py-1.5 text-xs text-white backdrop-blur">
        DEMO · rutas y unidades de ejemplo
      </div>
    </div>
  );
}
