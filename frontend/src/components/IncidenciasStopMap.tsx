"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Panamericana km 35 · Ramal Campana */
const POINT = { lat: -34.425, lng: -58.5798 };

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

export function IncidenciasStopMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: any = null;

    async function boot() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        mapRef.current.innerHTML = "";

        map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: true,
        }).setView([POINT.lat, POINT.lng], 14);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:14px;height:14px;border-radius:99px;background:#e11d48;border:2px solid #fff;box-shadow:0 0 0 6px #e11d4833"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([POINT.lat, POINT.lng], { icon }).addTo(map);

        function show(lat: number, lng: number) {
          marker.setLatLng([lat, lng]);
          map.setView([lat, lng], 14);
        }

        function onMsg(ev: MessageEvent) {
          const data = ev.data;
          if (!data || data.type !== "sol-incidencias" || data.action !== "point") return;
          const lat = Number(data.lat);
          const lng = Number(data.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          show(lat, lng);
        }

        window.addEventListener("message", onMsg);
        window.parent?.postMessage({ type: "sol-incidencias", action: "ready" }, "*");

        setTimeout(() => map.invalidateSize(), 160);
        setReady(true);
        return () => window.removeEventListener("message", onMsg);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar el mapa");
        }
        return undefined;
      }
    }

    let detach: (() => void) | undefined;
    void boot().then((off) => {
      detach = off;
    });
    return () => {
      cancelled = true;
      detach?.();
      map?.remove();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0e1738]">
      <div ref={mapRef} className="absolute inset-0 z-0 h-full w-full" />
      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-[11px] text-slate-300">
          Cargando mapa…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-[11px] text-amber-200">
          No se pudo cargar el mapa: {error}
        </div>
      )}
    </div>
  );
}
