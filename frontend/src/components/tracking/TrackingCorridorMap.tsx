"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const WALTER = { lat: -32.98, lng: -60.82 };

const VEHICLES = [
  { id: "walter", ...WALTER, color: "#10b981", pulse: true, label: "74 km/h · R450" },
  { id: "paez", lat: -32.35, lng: -62.15, color: "#10b981", pulse: true, label: "C. Páez (RN9)" },
  { id: "parada", lat: -34.0981, lng: -59.0286, color: "#f59e0b", pulse: false, label: "Parada (0 km)" },
  { id: "rosario", lat: -32.9442, lng: -60.62, color: "#10b981", pulse: false, label: "" },
  { id: "caba", lat: -34.6037, lng: -58.4, color: "#3b82f6", pulse: false, label: "" },
];

const CITIES = [
  { name: "Rosario (Santa Fe)", lat: -32.9442, lng: -60.6505 },
  { name: "Buenos Aires (CABA)", lat: -34.6037, lng: -58.3816 },
];

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

function vehicleIcon(L: any, color: string, pulse: boolean, label: string) {
  const size = pulse ? 16 : 13;
  const pill = label
    ? `<span style="position:absolute;left:50%;bottom:18px;transform:translateX(-50%);white-space:nowrap;background:#0f172a;color:#fff;font:700 10px/1.2 system-ui,sans-serif;padding:4px 7px;border-radius:6px">${label}</span>`
    : "";
  const ring = pulse
    ? `<span style="position:absolute;inset:-7px;border-radius:99px;background:${color}33"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<span style="position:relative;display:block;width:${size}px;height:${size}px">${ring}${pill}<span style="position:absolute;inset:0;border-radius:99px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function TrackingCorridorMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let onMessage: ((ev: MessageEvent) => void) | null = null;

    async function boot() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        mapRef.current.innerHTML = "";

        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: true,
        }).setView([-33.6, -60.4], 7);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        L.polyline(
          [
            [-31.4201, -64.1888],
            [-32.35, -62.15],
            WALTER,
            [-32.9442, -60.6505],
            [-34.0981, -59.0286],
            [-34.6037, -58.3816],
          ],
          { color: "#64748b", weight: 3, opacity: 0.55, dashArray: "8 8" },
        ).addTo(map);

        for (const city of CITIES) {
          L.circleMarker([city.lat, city.lng], {
            radius: 5,
            color: "#475569",
            fillColor: "#64748b",
            fillOpacity: 1,
            weight: 1,
          })
            .bindTooltip(city.name, {
              permanent: true,
              direction: "right",
              offset: [8, 0],
              className: "sol-tracking-city",
            })
            .addTo(map);
        }

        for (const v of VEHICLES) {
          L.marker([v.lat, v.lng], {
            icon: vehicleIcon(L, v.color, v.pulse, v.label),
            zIndexOffset: v.id === "walter" ? 800 : 400,
          }).addTo(map);
        }

        map.fitBounds(
          [
            [-32.2, -62.4],
            [-34.75, -58.15],
          ],
          { padding: [28, 28], maxZoom: 8 },
        );

        mapObjRef.current = map;
        setTimeout(() => map.invalidateSize(), 160);
        setReady(true);

        onMessage = (ev: MessageEvent) => {
          const data = ev.data;
          if (!data || data.type !== "sol-tracking" || !mapObjRef.current) return;
          if (data.action === "center") {
            mapObjRef.current.setView([WALTER.lat, WALTER.lng], 12, { animate: true });
          }
          if (data.action === "zoom") {
            mapObjRef.current.setZoom(mapObjRef.current.getZoom() + (data.dir === -1 ? -1 : 1));
          }
        };
        window.addEventListener("message", onMessage);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar el mapa");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (onMessage) window.removeEventListener("message", onMessage);
      mapObjRef.current?.remove();
      mapObjRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef2f6]">
      <style>{`
        .sol-tracking-city {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #334155;
          font: 600 11px/1.2 "Plus Jakarta Sans", system-ui, sans-serif;
          padding: 0 !important;
        }
        .leaflet-tooltip-right.sol-tracking-city::before { display: none; }
      `}</style>
      <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-[11px] text-slate-500">
          Cargando mapa…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-[11px] text-amber-700">
          No se pudo cargar el mapa: {error}
        </div>
      )}
    </div>
  );
}
