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
import { apiBase } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1625" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1625" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b849c" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4c3a85" }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#8b5cf6" }, { weight: 1.2 }],
  },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2438" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1625" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b3354" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c0a18" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4c3a85" }] },
];

declare global {
  interface Window {
    google?: any;
    __andreuMapsReady?: Promise<any>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  if (!window.__andreuMapsReady) {
    window.__andreuMapsReady = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-andreu-maps]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google.maps));
        existing.addEventListener("error", () => reject(new Error("Maps script error")));
        return;
      }
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      s.async = true;
      s.defer = true;
      s.dataset.andreuMaps = "1";
      s.onload = () => resolve(window.google.maps);
      s.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
      document.head.appendChild(s);
    });
  }

  return window.__andreuMapsReady;
}

function markerIcon(maps: any, color: string, pulse: boolean) {
  const size = pulse ? 18 : 14;
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0c0a18",
    strokeWeight: 2,
    scale: size / 3,
  };
}

function infoHtml(t: Trip) {
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
  const mapObj = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const detenidos = trips.filter((t) => t.estado === "detenido").length;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
        if (!apiKey) {
          const res = await fetch(`${apiBase()}/api/config/client`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) throw new Error("No se pudo obtener la clave de Maps");
          const data = (await res.json()) as { googleMapsApiKey?: string };
          apiKey = data.googleMapsApiKey?.trim() || "";
        }
        if (!apiKey) {
          throw new Error("Falta GOOGLE_MAPS_API_KEY en el backend");
        }

        const maps = await loadGoogleMaps(apiKey);
        if (cancelled || !mapRef.current) return;

        const map = new maps.Map(mapRef.current, {
          center: { lat: -34.6, lng: -64.0 },
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: DARK_STYLE,
          backgroundColor: "#0c0a18",
          gestureHandling: "greedy",
        });
        mapObj.current = map;
        infoRef.current = new maps.InfoWindow();

        const bounds = new maps.LatLngBounds();

        for (const [name, p] of Object.entries(CIUDADES)) {
          const m = new maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: name,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: "#6f6796",
              fillOpacity: 0.9,
              strokeWeight: 0,
              scale: 3,
            },
            zIndex: 1,
          });
          overlays.current.push(m);
          bounds.extend({ lat: p.lat, lng: p.lng });
        }

        for (const t of trips.filter((x) => x.estado === "en_curso" || x.estado === "detenido")) {
          const o = CIUDADES[t.origen];
          const d = CIUDADES[t.destino];
          if (!o || !d) continue;
          const line = new maps.Polyline({
            map,
            path: [
              { lat: o.lat, lng: o.lng },
              { lat: d.lat, lng: d.lng },
            ],
            strokeColor: "#6f5aad",
            strokeOpacity: 0.55,
            strokeWeight: 2,
            geodesic: true,
            zIndex: 2,
          });
          overlays.current.push(line);
        }

        for (const t of trips) {
          const pos = tripLatLng(t);
          if (!pos) continue;
          const color = TRIP_STATUS_COLOR[t.estado];
          const m = new maps.Marker({
            map,
            position: pos,
            title: `${t.id} · ${t.cliente}`,
            icon: markerIcon(maps, color, t.estado === "en_curso"),
            zIndex: 10,
          });
          m.addListener("mouseover", () => {
            setHover(t.id);
            infoRef.current.setContent(infoHtml(t));
            infoRef.current.setPosition(pos);
            infoRef.current.open({ map });
          });
          m.addListener("mouseout", () => {
            setHover(null);
            infoRef.current.close();
          });
          m.addListener("click", () => {
            setHover(t.id);
            infoRef.current.setContent(infoHtml(t));
            infoRef.current.setPosition(pos);
            infoRef.current.open({ map });
          });
          overlays.current.push(m);
          bounds.extend(pos);
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 48);
          const listener = maps.event.addListenerOnce(map, "bounds_changed", () => {
            const z = map.getZoom();
            if (typeof z === "number" && z > 7) map.setZoom(7);
          });
          overlays.current.push({ setMap: () => maps.event.removeListener(listener) });
        }

        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el mapa");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      for (const o of overlays.current) {
        try {
          o?.setMap?.(null);
        } catch {
          /* ignore */
        }
      }
      overlays.current = [];
      infoRef.current?.close?.();
      mapObj.current = null;
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
        <div ref={mapRef} className="absolute inset-0 h-full w-full" />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-faint)]">
            Cargando Google Maps…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-[var(--amber)]">
            No se pudo cargar Google Maps: {error}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)] backdrop-blur">
          Flota en tiempo real · Google Maps · Argentina
        </div>
      </div>
    </div>
  );
}
