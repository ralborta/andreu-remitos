"use client";

import { useState } from "react";
import { trips, CIUDADES, TRIP_STATUS_COLOR, TRIP_STATUS_LABEL } from "@/lib/data";

// Silueta estilizada de Argentina (aproximada) en viewBox 0..100
const ARG_PATH =
  "M44 6 L52 7 L55 12 L60 13 L63 18 L72 21 L70 27 L66 31 L67 37 L66 44 L64 50 L66 55 L62 59 L60 63 L57 66 L54 70 L52 75 L49 80 L47 86 L44 92 L42 97 L40 93 L41 87 L38 83 L37 77 L35 71 L33 64 L30 58 L27 53 L29 48 L33 45 L33 39 L35 33 L34 27 L37 20 L40 13 Z";

export function FleetMap() {
  const [hover, setHover] = useState<string | null>(null);

  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const detenidos = trips.filter((t) => t.estado === "detenido").length;

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
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0c0a18]">
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(139,92,246,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.06) 1px,transparent 1px)",
            backgroundSize: "5% 5%",
          }}
        />

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="argFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0.06" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d={ARG_PATH}
            fill="url(#argFill)"
            stroke="#8b5cf6"
            strokeWidth="0.5"
            strokeOpacity="0.7"
            strokeLinejoin="round"
          />

          {/* rutas de viajes en curso/detenidos */}
          {trips
            .filter((t) => t.estado === "en_curso" || t.estado === "detenido")
            .map((t) => {
              const o = CIUDADES[t.origen];
              const d = CIUDADES[t.destino];
              if (!o || !d) return null;
              return (
                <line
                  key={`r-${t.id}`}
                  x1={o.x}
                  y1={o.y}
                  x2={d.x}
                  y2={d.y}
                  stroke={hover === t.id ? "#a78bfa" : "#4c3a85"}
                  strokeWidth={hover === t.id ? 0.6 : 0.35}
                  strokeDasharray="1.2 1.2"
                  strokeOpacity={hover === t.id ? 0.9 : 0.5}
                />
              );
            })}

          {/* ciudades */}
          {Object.entries(CIUDADES).map(([name, p]) => (
            <g key={name}>
              <circle cx={p.x} cy={p.y} r="0.6" fill="#6f6796" />
            </g>
          ))}

          {/* camiones */}
          {trips.map((t) => {
            const color = TRIP_STATUS_COLOR[t.estado];
            const active = t.estado === "en_curso";
            return (
              <g
                key={t.id}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                {active && (
                  <circle cx={t.x} cy={t.y} r="2.6" fill={color} opacity="0.18">
                    <animate
                      attributeName="r"
                      values="1.4;3.4;1.4"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.35;0;0.35"
                      dur="2.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={hover === t.id ? "1.9" : "1.4"}
                  fill={color}
                  stroke="#0c0a18"
                  strokeWidth="0.4"
                  filter="url(#glow)"
                />
              </g>
            );
          })}
        </svg>

        {/* tooltip */}
        {trips.map((t) => {
          if (hover !== t.id) return null;
          return (
            <div
              key={`tt-${t.id}`}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs shadow-2xl"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              <p className="font-semibold text-white">
                {t.id} · {t.cliente}
              </p>
              <p className="text-[var(--text-dim)]">
                {t.origen} → {t.destino}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[var(--text-dim)]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: TRIP_STATUS_COLOR[t.estado] }}
                />
                {TRIP_STATUS_LABEL[t.estado]} · {t.chofer}
                {t.eta !== "—" && ` · ETA ${t.eta}`}
              </p>
            </div>
          );
        })}

        <div className="absolute bottom-3 left-3 rounded-lg bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)] backdrop-blur">
          Flota en tiempo real · Argentina
        </div>
      </div>
    </div>
  );
}
