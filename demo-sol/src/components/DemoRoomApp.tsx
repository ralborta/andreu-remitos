"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemoRoom } from "../lib/rooms";

const SCREENS: { slug: string; label: string }[] = [
  { slug: "menu", label: "Menú" },
  { slug: "torre", label: "Torre" },
  { slug: "monitor", label: "Monitor" },
  { slug: "tracking", label: "Tracking" },
  { slug: "whatsapp", label: "WhatsApp" },
  { slug: "viajes", label: "Viajes" },
  { slug: "remitos", label: "Remitos" },
  { slug: "destinos", label: "Destinos" },
  { slug: "incidencias", label: "Incidencias" },
  { slug: "rendicion", label: "Rendición" },
  { slug: "eta", label: "ETA" },
  { slug: "pod", label: "POP/POD" },
  { slug: "reclamos", label: "Reclamos" },
  { slug: "analitica", label: "Analítica" },
  { slug: "metricas", label: "Métricas" },
];

export function DemoRoomApp({ room }: { room: DemoRoom }) {
  const [slug, setSlug] = useState("menu");
  const expiresLabel = useMemo(
    () =>
      new Date(room.expiresAt).toLocaleString("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [room.expiresAt],
  );

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.type !== "sol-demo-nav" || typeof data.slug !== "string") return;
      if (SCREENS.some((s) => s.slug === data.slug)) setSlug(data.slug);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const src = `/stitch-screens/${slug}.html?company=${encodeURIComponent(room.company)}`;

  return (
    <div className="flex h-screen flex-col bg-[#0b1c30] text-white">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0f172a] px-3 text-xs">
        <span className="rounded-full bg-[#7c3aed]/25 px-2 py-0.5 font-semibold text-[#c4b5fd]">
          100% DEMO · Stitch
        </span>
        <span className="truncate text-white/80">
          {room.company} · {room.contactName}
        </span>
        <span className="ml-auto hidden text-white/50 sm:inline">Vence {expiresLabel}</span>
        <div className="hidden gap-1 overflow-x-auto md:flex">
          {SCREENS.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSlug(s.slug)}
              className={`rounded-md px-2 py-1 whitespace-nowrap ${
                slug === s.slug
                  ? "bg-[#2563eb] text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <iframe
        key={slug}
        title={`SOL demo · ${slug}`}
        src={src}
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
