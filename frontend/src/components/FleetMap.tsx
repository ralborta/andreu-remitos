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

/** Key de Maps JS del proyecto kiev-prueba (Maps JavaScript API). */
const BUILTIN_MAPS_JS_KEY = "AIzaSyCo-aVtxOjow0alGxWvjJmBaT4lJDjfcVs";

declare global {
  interface Window {
    google?: any;
    __andreuMapsReady?: Promise<any>;
    gm_authFailure?: () => void;
  }
}

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);

  if (!window.__andreuMapsReady) {
    window.__andreuMapsReady = new Promise((resolve, reject) => {
      const fail = (msg: string) => {
        window.__andreuMapsReady = undefined;
        reject(new Error(msg));
      };

      window.gm_authFailure = () => {
        fail("Google Maps: key inválida o API no habilitada (billing/restricciones)");
      };

      const existing = document.querySelector<HTMLScriptElement>("script[data-andreu-maps]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google?.maps));
        existing.addEventListener("error", () => fail("Maps script error"));
        return;
      }
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      s.async = true;
      s.defer = true;
      s.dataset.andreuMaps = "1";
      s.onload = () => {
        if (!window.google?.maps) fail("Google Maps no disponible");
        else resolve(window.google.maps);
      };
      s.onerror = () => fail("No se pudo cargar Google Maps");
      document.head.appendChild(s);
    });
  }

  return window.__andreuMapsReady;
}

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
    s.onerror = () => reject(new Error("No se pudo cargar Leaflet"));
    document.head.appendChild(s);
  });
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

function leafletDivIcon(L: any, color: string, pulse: boolean) {
  const size = pulse ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid #0c0a18;box-shadow:0 0 0 ${pulse ? 6 : 0}px ${color}44"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function FleetMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [provider, setProvider] = useState<"google" | "osm" | null>(null);

  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const detenidos = trips.filter((t) => t.estado === "detenido").length;

  useEffect(() => {
    let cancelled = false;

    async function resolveApiKey() {
      let apiKey =
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || BUILTIN_MAPS_JS_KEY;
      try {
        const res = await fetch(`${apiBase()}/api/config/client`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { googleMapsApiKey?: string };
          if (data.googleMapsApiKey?.trim()) apiKey = data.googleMapsApiKey.trim();
        }
      } catch {
        /* usamos builtin */
      }
      return apiKey;
    }

    async function bootGoogle(apiKey: string) {
      const maps = await loadGoogleMaps(apiKey);
      if (cancelled || !mapRef.current) return;

      // Esperar un tick: gm_authFailure puede dispararse al crear el Map
      await new Promise((r) => setTimeout(r, 50));

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

      const info = new maps.InfoWindow();
      const overlays: any[] = [];
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
        overlays.push(m);
        bounds.extend({ lat: p.lat, lng: p.lng });
      }

      for (const t of trips.filter((x) => x.estado === "en_curso" || x.estado === "detenido")) {
        const o = CIUDADES[t.origen];
        const d = CIUDADES[t.destino];
        if (!o || !d) continue;
        overlays.push(
          new maps.Polyline({
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
          }),
        );
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
          info.setContent(infoHtml(t));
          info.setPosition(pos);
          info.open({ map });
        });
        m.addListener("mouseout", () => {
          setHover(null);
          info.close();
        });
        m.addListener("click", () => {
          setHover(t.id);
          info.setContent(infoHtml(t));
          info.setPosition(pos);
          info.open({ map });
        });
        overlays.push(m);
        bounds.extend(pos);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 48);
        maps.event.addListenerOnce(map, "bounds_changed", () => {
          const z = map.getZoom();
          if (typeof z === "number" && z > 7) map.setZoom(7);
        });
      }

      // Si Google pinta el overlay de error, el map div suele quedar gris —
      // damos 1.2s y si gm_authFailure no corrió pero hay error DOM, fallamos.
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      const errNode = mapRef.current?.querySelector(".gm-err-container, .dismissButton");
      if (errNode) throw new Error("Google Maps rechazó la key (activar Maps JavaScript API)");

      cleanupRef.current = () => {
        for (const o of overlays) {
          try {
            o?.setMap?.(null);
          } catch {
            /* ignore */
          }
        }
        info.close();
      };
      setProvider("google");
      setReady(true);
    }

    async function bootLeaflet() {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;
      mapRef.current.innerHTML = "";

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([-34.6, -64.0], 5);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 18,
      }).addTo(map);

      const bounds: any[] = [];

      for (const [name, p] of Object.entries(CIUDADES)) {
        L.circleMarker([p.lat, p.lng], {
          radius: 3,
          color: "#6f6796",
          fillColor: "#6f6796",
          fillOpacity: 0.9,
          weight: 0,
        })
          .bindTooltip(name, { direction: "top" })
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
          { color: "#6f5aad", weight: 2, opacity: 0.6 },
        ).addTo(map);
      }

      for (const t of trips) {
        const pos = tripLatLng(t);
        if (!pos) continue;
        const color = TRIP_STATUS_COLOR[t.estado];
        const m = L.marker([pos.lat, pos.lng], {
          icon: leafletDivIcon(L, color, t.estado === "en_curso"),
        }).addTo(map);
        m.bindPopup(infoHtml(t));
        m.on("mouseover", () => {
          setHover(t.id);
          m.openPopup();
        });
        m.on("mouseout", () => setHover(null));
        bounds.push([pos.lat, pos.lng]);
      }

      if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });

      cleanupRef.current = () => {
        map.remove();
      };
      setProvider("osm");
      setReady(true);
    }

    async function boot() {
      try {
        const apiKey = await resolveApiKey();
        await bootGoogle(apiKey);
      } catch (err) {
        console.warn("[FleetMap] Google Maps falló, usando mapa OSM:", err);
        try {
          if (mapRef.current) mapRef.current.innerHTML = "";
          await bootLeaflet();
          setError(null);
        } catch (err2) {
          if (!cancelled) {
            setError(err2 instanceof Error ? err2.message : "Error al cargar el mapa");
          }
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
          Flota en tiempo real ·{" "}
          {provider === "google" ? "Google Maps" : provider === "osm" ? "Mapa" : "…"} · Argentina
        </div>
      </div>
    </div>
  );
}
