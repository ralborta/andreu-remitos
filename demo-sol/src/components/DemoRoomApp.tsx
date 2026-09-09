"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChevronRight,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Moon,
  Navigation,
  PackageCheck,
  Radio,
  Sun,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";
import type { DemoRoom } from "../lib/rooms";
import { DEMO_AGENTS, FAQ_INTRO, FAQ_ITEMS } from "../lib/agents";
import {
  DEMO_TRIPS,
  STATUS_COLOR,
  STATUS_LABEL,
  diagnosticBullets,
} from "../lib/seed";
import { DemoMap } from "./DemoMap";

type View =
  | "torre"
  | "viajes"
  | "monitor"
  | "faq"
  | "whatsapp"
  | `agent:${string}`;

const ACTIVITY = [
  {
    t: "hace 2 min",
    who: "Tracking",
    text: "Link WhatsApp abierto · VJ-DEM-002 · Lucía Fernández",
  },
  {
    t: "hace 6 min",
    who: "Remitos",
    text: "Remito leído 97% confianza · TransitOne · foto chofer",
  },
  {
    t: "hace 11 min",
    who: "Incidencias",
    text: "Demora clasificada: cola en peaje · VJ-DEM-003",
  },
  {
    t: "hace 18 min",
    who: "ETA",
    text: "ETA actualizado 21:05 · aviso enviado a cliente Cuyo",
  },
  {
    t: "hace 24 min",
    who: "Destinos",
    text: "Dirección confirmada por WhatsApp · Campana",
  },
  {
    t: "hace 31 min",
    who: "POP/POD",
    text: "Evidencia de entrega cargada · VJ-DEM-006",
  },
];

const CHAT_DEMO = [
  {
    role: "user" as const,
    text: "¿Qué viajes van demorados ahora?",
  },
  {
    role: "bot" as const,
    text: "Hay 1 viaje demorado: VJ-DEM-003 (Mendoza → Córdoba). Causa probable: cola en peaje. ETA 21:05. ¿Querés que Incidencias abra el caso?",
  },
  {
    role: "user" as const,
    text: "Sí, y avisá al cliente.",
  },
  {
    role: "bot" as const,
    text: "Listo (demo): caso abierto en Incidencias y mensaje WhatsApp preparado para Cliente Demo Cuyo. En producción esto pasa por Kernel + aprobación humana si hace falta.",
  },
];

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function BrandMark({ size = "sm" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={clsx(
          "grid shrink-0 place-items-center rounded-xl bg-[var(--violet)]/15 font-bold text-[var(--violet)]",
          box,
        )}
      >
        SOL
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-wide">Empliados</div>
        <div className="truncate text-[11px] text-[var(--text-faint)]">Mesa de control</div>
      </div>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="hidden tabular-nums text-xs text-[var(--text-dim)] sm:inline">
      {now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

export function DemoRoomApp({ room }: { room: DemoRoom }) {
  const [view, setView] = useState<View>("torre");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [chatInput, setChatInput] = useState("");

  const bullets = useMemo(
    () => diagnosticBullets(room.painPoint, room.company),
    [room.painPoint, room.company],
  );
  const expiresLabel = new Date(room.expiresAt).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const activos = DEMO_TRIPS.filter((t) => t.estado === "en_curso").length;
  const demorados = DEMO_TRIPS.filter((t) => t.estado === "demorado").length;
  const agentSlug = view.startsWith("agent:") ? view.slice(6) : null;
  const selected = DEMO_AGENTS.find((a) => a.slug === agentSlug) || DEMO_AGENTS[0];

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "dark" ? "dark" : "light",
    );
  }, [theme]);

  function go(next: View) {
    setView(next);
    setSidebarOpen(false);
  }

  const navBtn = (active: boolean) =>
    clsx(
      "group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
      active
        ? "bg-[var(--violet)]/15 text-[var(--text)] ring-1 ring-[var(--violet)]/40"
        : "text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] hover:text-[var(--text)]",
    );

  return (
    <div className="min-h-screen">
      {/* overlay mobile */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* SIDEBAR — misma estructura que frontend/Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[var(--border)] bg-[var(--bg-2)]/95 backdrop-blur-xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <BrandMark />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <button type="button" onClick={() => go("torre")} className={navBtn(view === "torre")}>
            <LayoutDashboard size={18} />
            Torre de Control
          </button>
          <button type="button" onClick={() => go("monitor")} className={navBtn(view === "monitor")}>
            <Activity size={18} />
            Monitor
          </button>
          <button
            type="button"
            onClick={() => go("agent:tracking")}
            className={navBtn(view === "agent:tracking")}
          >
            <Navigation size={18} />
            Tracking Express
          </button>
          <button
            type="button"
            onClick={() => go("whatsapp")}
            className={navBtn(view === "whatsapp")}
          >
            <MessageCircle size={18} />
            <span className="flex-1">WhatsApp</span>
            <span className="rounded-full bg-[#25d366]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#25d366]">
              Demo
            </span>
          </button>
          <button type="button" onClick={() => go("viajes")} className={navBtn(view === "viajes")}>
            <Truck size={18} />
            Viajes
          </button>
          <button type="button" onClick={() => go("faq")} className={navBtn(view === "faq")}>
            <Radio size={18} />
            FAQ demo
          </button>

          <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Agentes
          </p>
          {DEMO_AGENTS.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => go(`agent:${a.slug}`)}
              className={navBtn(view === `agent:${a.slug}`)}
            >
              <span
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                  view === `agent:${a.slug}`
                    ? "bg-[var(--violet)]/25 text-[var(--violet-2)]"
                    : "bg-[var(--overlay-strong)] text-[var(--text-dim)]",
                )}
              >
                {a.short.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{a.short}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <div className="rounded-xl bg-[var(--violet)]/10 px-3 py-2.5 text-xs leading-snug text-[var(--text-dim)]">
            <div className="font-semibold text-[var(--violet)]">100% DEMO</div>
            <div className="mt-1">
              {room.company} · {room.contactName}
            </div>
            <div className="mt-1 text-[var(--text-faint)]">Vence {expiresLabel}</div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] lg:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--text-dim)]">
              Torre y agentes · consultas en Chat Central · datos ficticios
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
              </span>
              <span className="text-xs font-medium text-[var(--text-dim)]">Sistemas activos</span>
            </div>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)]"
              title="Cambiar tema"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              type="button"
              className="relative rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)]"
            >
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--magenta)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--magenta)]" />
              </span>
            </button>
            <LiveClock />
            <div className="ml-1 hidden border-l border-[var(--border)] pl-3 sm:block">
              <div className="text-xs font-semibold">SOL</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          {view === "torre" && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[var(--violet)]">
                    <Activity size={22} />
                    <h1
                      className="text-2xl font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-display), sans-serif" }}
                    >
                      Torre de Control
                    </h1>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    Operación logística en tiempo real · agentes, flota, documentación y SLA
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--green)]">
                    10 agentes en línea
                  </span>
                </div>
              </div>

              <div className="panel p-3">
                <input
                  readOnly
                  value={`Buscar viaje, chofer o remito… · demo para ${room.company}`}
                  className="w-full bg-transparent text-sm text-[var(--text-dim)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  {
                    label: "Viajes activos",
                    value: String(activos),
                    sub: `de ${DEMO_TRIPS.length} en gestión`,
                    icon: Truck,
                  },
                  {
                    label: "Entregas hoy",
                    value: "241",
                    sub: "+16% vs. ayer",
                    subOk: true,
                    icon: PackageCheck,
                  },
                  {
                    label: "Remitos procesados",
                    value: "412",
                    sub: "97,1% lectura auto",
                    icon: FileText,
                  },
                  {
                    label: "SLA de entrega",
                    value: "94,2%",
                    sub: "+2,4 pts",
                    subOk: true,
                    icon: Gauge,
                  },
                  {
                    label: "Incidencias abiertas",
                    value: String(demorados + 2),
                    sub: `${demorados} de criticidad alta`,
                    warn: true,
                    icon: TriangleAlert,
                  },
                ].map((k) => (
                  <div key={k.label} className="panel panel-hover p-4">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium text-[var(--text-dim)]">{k.label}</p>
                      <k.icon size={16} className="text-[var(--text-faint)]" />
                    </div>
                    <p
                      className="mt-2 text-2xl font-bold tabular-nums"
                      style={{ fontFamily: "var(--font-display), sans-serif" }}
                    >
                      {k.value}
                    </p>
                    <p
                      className={clsx(
                        "mt-1.5 text-xs",
                        k.subOk
                          ? "text-[var(--green)]"
                          : k.warn
                            ? "text-[var(--amber)]"
                            : "text-[var(--text-faint)]",
                      )}
                    >
                      {k.sub}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="panel flex min-h-[420px] flex-col xl:col-span-3">
                  <div className="border-b border-[var(--border-soft)] px-4 py-3">
                    <h2 className="text-sm font-semibold">Chat Central</h2>
                    <p className="text-xs text-[var(--text-faint)]">
                      Consultas en lenguaje natural a los especialistas
                    </p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {CHAT_DEMO.map((m, i) => (
                      <div
                        key={i}
                        className={clsx(
                          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          m.role === "user"
                            ? "ml-auto bg-[var(--violet)] text-white"
                            : "bg-[var(--panel-2)] text-[var(--text)] ring-1 ring-[var(--border)]",
                        )}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <form
                    className="flex gap-2 border-t border-[var(--border-soft)] p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setChatInput("");
                    }}
                  >
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Preguntá algo… (demo sin backend)"
                      className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--violet)]"
                    />
                    <button type="submit" className="btn-primary px-4 py-2 text-sm">
                      Enviar
                    </button>
                  </form>
                </div>

                <div className="panel overflow-hidden p-4 xl:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Flota en tiempo real</h2>
                    <span className="text-xs text-[var(--text-faint)]">Leaflet · rutas demo</span>
                  </div>
                  <div className="surface-dark h-[360px] overflow-hidden rounded-xl p-1">
                    <DemoMap />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="panel p-4 xl:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Actividad de agentes</h2>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                      <span className="relative flex h-2 w-2">
                        <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--violet)]" />
                      </span>
                      En vivo
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {ACTIVITY.map((a) => (
                      <li
                        key={a.t + a.who}
                        className="flex gap-3 border-b border-[var(--border-soft)] pb-3 last:border-0"
                      >
                        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--violet)]" />
                        <div className="min-w-0">
                          <div className="text-sm">
                            <span className="font-semibold text-[var(--violet-2)]">{a.who}</span>
                            <span className="text-[var(--text-dim)]"> · {a.text}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--text-faint)]">{a.t}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="panel p-4">
                  <h2 className="mb-3 text-sm font-semibold">Diagnóstico express</h2>
                  <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                    {bullets.map((b) => (
                      <li key={b} className="leading-snug">
                        · {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <TripsTable
                title="Viajes en gestión"
                onAll={() => go("viajes")}
              />

              <div>
                <h2 className="mb-3 text-sm font-semibold">Agentes de la suite</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {DEMO_AGENTS.map((a) => (
                    <button
                      key={a.slug}
                      type="button"
                      onClick={() => go(`agent:${a.slug}`)}
                      className="panel panel-hover group flex flex-col p-4 text-left"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--violet)]/15 text-xs font-bold text-[var(--violet-2)]">
                        {a.short.slice(0, 2).toUpperCase()}
                      </span>
                      <p className="mt-3 font-semibold">{a.name}</p>
                      <p className="mt-1 line-clamp-2 flex-1 text-xs text-[var(--text-dim)]">
                        {a.blurb}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--violet-2)] opacity-0 transition-opacity group-hover:opacity-100">
                        Abrir agente <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {view === "viajes" && <TripsTable title="Viajes" full />}

          {view === "monitor" && (
            <div className="space-y-4">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Monitor
              </h1>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {["Kernel", "WhatsApp bridge", "Document AI", "Tracking", "TMS sync", "Mesa"].map(
                  (s) => (
                    <div key={s} className="panel p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s}</span>
                        <span className="rounded-full bg-[var(--green)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--green)]">
                          OK
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-faint)]">
                        Latencia demo &lt; 200 ms · sin datos reales
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {view === "whatsapp" && (
            <div className="panel max-w-2xl p-6">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                WhatsApp
              </h1>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                En producción acá vive el inbox con choferes y clientes. En esta sala solo
                mostramos el concepto: el chofer no instala app; opera por WhatsApp.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  "Martín Ríos · VJ-DEM-001 · en ruta",
                  "Lucía Fernández · pidió link tracking",
                  "Cliente Demo Cuyo · demora avisada",
                ].map((row) => (
                  <div
                    key={row}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25d366]/20 text-xs font-bold text-[#25d366]">
                      WA
                    </span>
                    {row}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === "faq" && (
            <div className="panel max-w-3xl p-6">
              <p className="text-base font-medium leading-relaxed text-[var(--violet-2)]">
                {FAQ_INTRO}
              </p>
              <div className="mt-6 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div key={item.q} className="border-t border-[var(--border-soft)] pt-4">
                    <h3 className="font-semibold">{item.q}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-dim)]">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view.startsWith("agent:") && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
                    Especialista
                  </div>
                  <h1
                    className="mt-1 text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display), sans-serif" }}
                  >
                    {selected.name}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--text-dim)]">{selected.blurb}</p>
                </div>
                <span className="rounded-full border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-1 text-xs font-semibold text-[var(--green)]">
                  Online · demo
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="panel p-5">
                  <h2 className="text-sm font-semibold">Qué verías en producción</h2>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-dim)]">
                    <li>· Panel operativo del agente con casos en cola</li>
                    <li>· Chat especializado + handoff a humano</li>
                    <li>· Integración TMS / WhatsApp / Document AI según el rol</li>
                    <li>· Auditoría de cada acción del Kernel</li>
                  </ul>
                  {selected.slug === "tracking" && (
                    <div className="surface-dark mt-4 h-[280px] overflow-hidden rounded-xl p-1">
                      <DemoMap />
                    </div>
                  )}
                </div>
                <div className="panel p-5">
                  <h2 className="text-sm font-semibold">Ejemplo de conversación</h2>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-2xl bg-[var(--violet)] px-3 py-2 text-sm text-white">
                      Estado de {selected.short.toLowerCase()} para {room.company}?
                    </div>
                    <div className="rounded-2xl bg-[var(--panel-2)] px-3 py-2 text-sm ring-1 ring-[var(--border)]">
                      Demo: el agente {selected.name} respondería con datos de tu operación.
                      Acá no hay backend ni WhatsApp real — solo la UI de mesa.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TripsTable({
  title,
  full,
  onAll,
}: {
  title: string;
  full?: boolean;
  onAll?: () => void;
}) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {onAll && (
          <button
            type="button"
            onClick={onAll}
            className="text-xs font-medium text-[var(--violet-2)] hover:underline"
          >
            Ver todos
          </button>
        )}
      </div>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
              <th className="px-3 py-2 font-medium">Viaje</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Ruta</th>
              <th className="px-3 py-2 font-medium">Chofer</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Avance</th>
              <th className="px-3 py-2 font-medium">ETA</th>
            </tr>
          </thead>
          <tbody>
            {(full ? DEMO_TRIPS : DEMO_TRIPS.slice(0, 5)).map((t) => (
              <tr
                key={t.id}
                className="border-t border-[var(--border-soft)] transition-colors hover:bg-[var(--overlay)]"
              >
                <td className="px-3 py-3 font-medium">{t.id}</td>
                <td className="px-3 py-3 text-[var(--text-dim)]">{t.cliente}</td>
                <td className="px-3 py-3 text-[var(--text-dim)]">
                  {t.origen} → {t.destino}
                </td>
                <td className="px-3 py-3 text-[var(--text-dim)]">{t.chofer}</td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: STATUS_COLOR[t.estado],
                      background: `${STATUS_COLOR[t.estado]}1a`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: STATUS_COLOR[t.estado] }}
                    />
                    {STATUS_LABEL[t.estado]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--overlay-strong)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${t.progreso}%`,
                          background: "linear-gradient(90deg,#8b5cf6,#d946ef)",
                        }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-[var(--text-faint)]">
                      {t.progreso}%
                    </span>
                  </div>
                </td>
                <td className="tabular-nums px-3 py-3 text-[var(--text-dim)]">{t.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
