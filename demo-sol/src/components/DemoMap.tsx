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
        map = L.map(ref.current, { zoomControl: true, attributionControl: false });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 18,
        }).addTo(map);

        const bounds: any[] = [];
        for (const t of trips) {
          const pos = tripPosition(t);
          if (!pos) continue;
          const color = STATUS_COLOR[t.estado];
          const route = L.polyline(
            [
              [pos.origin.lat, pos.origin.lng],
              [pos.dest.lat, pos.dest.lng],
            ],
            { color, weight: 3, opacity: 0.55, dashArray: t.estado === "asignado" ? "6 8" : undefined },
          ).addTo(map);
          bounds.push(...route.getLatLngs());

          L.circleMarker([pos.origin.lat, pos.origin.lng], {
            radius: 5,
            color: "#8fa8c7",
            fillColor: "#8fa8c7",
            fillOpacity: 0.9,
            weight: 1,
          })
            .bindTooltip(t.origen, { permanent: false })
            .addTo(map);

          L.circleMarker([pos.dest.lat, pos.dest.lng], {
            radius: 5,
            color: "#e8f1ff",
            fillColor: "#e8f1ff",
            fillOpacity: 0.9,
            weight: 1,
          })
            .bindTooltip(t.destino, { permanent: false })
            .addTo(map);

          const truck = L.circleMarker([pos.lat, pos.lng], {
            radius: t.estado === "en_curso" || t.estado === "demorado" ? 8 : 6,
            color: "#070f1a",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          })
            .bindPopup(
              `<div style="font:12px/1.4 system-ui;color:#111;min-width:180px">
                <b>${t.id}</b> · ${t.cliente}<br/>
                ${t.origen} → ${t.destino}<br/>
                ${STATUS_LABEL[t.estado]} · ${t.chofer}${t.eta !== "—" ? ` · ETA ${t.eta}` : ""}
              </div>`,
            )
            .addTo(map);
          bounds.push(truck.getLatLng());
        }

        if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.18));
        else map.setView([-34.6, -58.4], 5);
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
    <div className="relative h-full min-h-[280px] overflow-hidden rounded-xl">
      <div ref={ref} className="absolute inset-0 z-0" />
      {!ready && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#0c0a18]/90 text-sm text-[#a79fc9]">
          Cargando mapa de flota…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#0c0a18] text-sm text-[#ef4444]">
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-black/55 px-3 py-1.5 text-xs text-[#c4b5fd] backdrop-blur">
        DEMO · rutas y unidades de ejemplo
      </div>
    </div>
  );
}
