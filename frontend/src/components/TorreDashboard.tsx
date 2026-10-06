"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  FileText,
  Gauge,
  PackageCheck,
  TriangleAlert,
  Truck,
  Bot,
} from "lucide-react";
import { FleetMap } from "@/components/FleetMap";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ViajesArea, IncidenciasDonut, SlaBars } from "@/components/Charts";
import { LiveCounter } from "@/components/LiveCounter";
import { AgentIcon } from "@/components/Icon";
import { TorreSearch } from "@/components/TorreSearch";
import { TorreChat } from "@/components/TorreChat";
import { StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { agents } from "@/lib/agents";
import {
  trips,
  incidencias,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  viajesPorDia,
  incidenciasPorTipo,
  slaPorZona,
} from "@/lib/data";
import { Suspense } from "react";

function firstName(nombre?: string | null, username?: string | null) {
  const raw = (nombre || username || "equipo").trim();
  return raw.split(/\s+/)[0] || "equipo";
}

export function TorreDashboard() {
  const { user } = useAuth();
  const activos = trips.filter((t) => t.estado === "en_curso").length;
  const incidenciasAbiertas = incidencias.filter((i) => i.estado !== "Resuelta").length;
  const incidenciasAltas = incidencias.filter(
    (i) => i.estado !== "Resuelta" && i.criticidad === "Alta",
  ).length;
  const agentesActivos = agents.filter((a) => a.status === "operativo" || a.status === "pruebas").length;
  const suiteAgents = agents.filter((a) => a.slug !== "commander");

  return (
    <div className="space-y-5">
      {/* Hero Stitch */}
      <section className="hero-sol relative overflow-hidden rounded-2xl p-6 text-white sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-[#39b8fd]/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono-label text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Torre de Control · {user ? "Sesión activa" : "SOL"}
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight sm:text-4xl">
              Hola, {firstName(user?.nombre, user?.username)}
            </h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-white/80 sm:text-[15px]">
              Telemetría, flota, remitos y agentes en un solo panel. Misma información operativa;
              diseño borrador Stitch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-md ring-1 ring-white/20">
              <div className="flex items-center gap-2">
                <Bot size={16} />
                <span className="text-sm font-bold">{agentesActivos} agentes activos</span>
                <span className="h-2 w-2 rounded-full bg-[#6ffbbe]" />
              </div>
              <p className="mt-1 font-mono-label text-[10px] text-white/70">
                Suite Empliados · motor SOL
              </p>
            </div>
            <Link
              href="/agentes/commander"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[var(--violet-2)] shadow-sm hover:bg-white/95"
            >
              Chat Central <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="panel h-20 animate-pulse" />}>
        <TorreSearch />
      </Suspense>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            label: "Viajes Activos",
            value: String(activos),
            hint: `de ${trips.length} en gestión`,
            icon: Truck,
            tone: "bg-[#e6deff] text-[var(--violet)]",
          },
          {
            label: "Entregas Hoy",
            value: null as string | null,
            live: 241,
            hint: "+16% vs. ayer",
            hintTone: "text-[var(--green)]",
            icon: PackageCheck,
            tone: "bg-[#c9e6ff] text-[var(--blue)]",
          },
          {
            label: "Remitos Procesados",
            value: null as string | null,
            live: 412,
            hint: "97,1% lectura auto",
            icon: FileText,
            tone: "bg-[var(--panel-2)] text-[var(--violet)]",
          },
          {
            label: "SLA de Entrega",
            value: "94,2%",
            hint: "+2,4 pts",
            hintTone: "text-[var(--green)]",
            icon: Gauge,
            tone: "bg-[#6ffbbe]/30 text-[var(--green)]",
          },
          {
            label: "Incidencias",
            value: String(incidenciasAbiertas),
            hint: `${incidenciasAltas} de criticidad alta`,
            hintTone: "text-[var(--amber)]",
            icon: TriangleAlert,
            tone: "bg-[#ffdad6] text-[var(--red)]",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="panel panel-hover p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                {kpi.label}
              </p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.tone}`}>
                <kpi.icon size={18} />
              </span>
            </div>
            <p className="mt-3 font-[var(--font-display)] text-2xl font-extrabold tabular-nums text-[var(--text)]">
              {"live" in kpi && kpi.live != null ? (
                <LiveCounter start={kpi.live} stepMax={2} intervalMs={8000} />
              ) : (
                kpi.value
              )}
            </p>
            <p className={`mt-1 text-xs ${kpi.hintTone || "text-[var(--text-faint)]"}`}>{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Chat + Mapa + Flota */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text)]">Viajes en tiempo real</h2>
              <Link href="/monitor" className="text-xs font-semibold text-[var(--violet)] hover:underline">
                Ver mapa
              </Link>
            </div>
            <FleetMap />
          </div>
        </div>
        <div className="min-w-0 xl:col-span-4">
          <div className="panel flex h-full flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text)]">Últimos eventos</h2>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                <span className="relative flex h-2 w-2">
                  <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                </span>
                En vivo
              </span>
            </div>
            <div className="-mx-1 max-h-[420px] flex-1 overflow-y-auto scroll-thin">
              <ActivityFeed />
            </div>
          </div>
        </div>
        <div className="min-w-0 xl:col-span-3">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text)]">Flota activa</h2>
              <Link href="/monitor" className="text-xs font-semibold text-[var(--violet)] hover:underline">
                Ver flota ({trips.length})
              </Link>
            </div>
            <div className="space-y-2">
              {trips.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-[var(--bg-2)] p-3 ring-1 ring-[var(--border-soft)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-label text-xs font-semibold text-[var(--text)]">
                      {t.id}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: TRIP_STATUS_COLOR[t.estado],
                        background: `${TRIP_STATUS_COLOR[t.estado]}22`,
                      }}
                    >
                      {TRIP_STATUS_LABEL[t.estado]}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                    {t.origen} → {t.destino}
                  </p>
                  <p className="mt-0.5 font-mono-label text-[10px] text-[var(--text-faint)]">
                    ETA {t.eta} · {t.progreso}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Central */}
      <div className="min-w-0">
        <TorreChat />
      </div>

      {/* Agentes */}
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text)]">Actividad de agentes IA</h2>
              <span className="rounded-full bg-[#6ffbbe]/35 px-2 py-0.5 font-mono-label text-[10px] font-semibold uppercase text-[#005236]">
                Suite
              </span>
            </div>
            <p className="text-xs text-[var(--text-dim)]">
              Misma suite operativa — links reales a cada agente.
            </p>
          </div>
          <Link
            href="/agentes/commander"
            className="text-xs font-semibold text-[var(--violet)] hover:underline"
          >
            Gestionar agentes
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {suiteAgents.map((a) => (
            <Link
              key={a.slug}
              href={`/agentes/${a.slug}`}
              className="group rounded-xl bg-[var(--bg-2)] p-4 ring-1 ring-[var(--border-soft)] transition hover:ring-[var(--violet)]/40"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6deff] text-[var(--violet)]">
                  <AgentIcon name={a.icon} size={18} />
                </span>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-3 text-sm font-bold text-[var(--text)]">{a.short}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">{a.subtitle}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--violet)] opacity-0 transition group-hover:opacity-100">
                Abrir <ChevronRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-1">
          <h2 className="mb-3 text-base font-bold text-[var(--text)]">Viajes por día</h2>
          <ViajesArea data={viajesPorDia} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-1 text-base font-bold text-[var(--text)]">Incidencias por tipo</h2>
          <p className="mb-3 text-xs text-[var(--text-dim)]">Diagnóstico de alertas</p>
          <IncidenciasDonut data={incidenciasPorTipo} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-1 text-base font-bold text-[var(--text)]">SLA por zona</h2>
          <p className="mb-3 text-xs text-[var(--text-dim)]">Puntualidad comprometida</p>
          <SlaBars data={slaPorZona} />
        </div>
      </div>

      {/* Tabla viajes */}
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
            <Activity size={18} className="text-[var(--violet)]" />
            Viajes en gestión
          </h2>
          <Link href="/backoffice" className="text-xs font-semibold text-[var(--violet)] hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono-label text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-3 py-2 font-semibold">Viaje</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Ruta</th>
                <th className="px-3 py-2 font-semibold">Chofer</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Avance</th>
                <th className="px-3 py-2 font-semibold">ETA</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-[var(--border-soft)] transition-colors hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-3 font-mono-label font-semibold text-[var(--text)]">
                    {t.id}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">{t.cliente}</td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">
                    {t.origen} → {t.destino}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-dim)]">{t.chofer}</td>
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: TRIP_STATUS_COLOR[t.estado],
                        background: `${TRIP_STATUS_COLOR[t.estado]}1a`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: TRIP_STATUS_COLOR[t.estado] }}
                      />
                      {TRIP_STATUS_LABEL[t.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--panel-2)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${t.progreso}%`,
                            background: "linear-gradient(90deg,#633bf3,#39b8fd)",
                          }}
                        />
                      </div>
                      <span className="font-mono-label text-xs text-[var(--text-faint)]">
                        {t.progreso}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono-label text-[var(--text-dim)]">{t.eta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
