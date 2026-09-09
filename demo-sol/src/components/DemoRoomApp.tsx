"use client";

import { useMemo, useState } from "react";
import type { DemoRoom } from "../lib/rooms";
import { DEMO_AGENTS, FAQ_INTRO, FAQ_ITEMS } from "../lib/agents";
import { DEMO_TRIPS, STATUS_COLOR, STATUS_LABEL, diagnosticBullets } from "../lib/seed";
import { DemoMap } from "./DemoMap";

type Tab = "mesa" | "agentes" | "viajes" | "faq";

export function DemoRoomApp({ room }: { room: DemoRoom }) {
  const [tab, setTab] = useState<Tab>("mesa");
  const [agent, setAgent] = useState(DEMO_AGENTS[0].slug);
  const selected = DEMO_AGENTS.find((a) => a.slug === agent) || DEMO_AGENTS[0];
  const bullets = useMemo(
    () => diagnosticBullets(room.painPoint, room.company),
    [room.painPoint, room.company],
  );
  const expiresLabel = new Date(room.expiresAt).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const nav: { id: Tab; label: string }[] = [
    { id: "mesa", label: "Mesa de control" },
    { id: "agentes", label: "10 Agentes" },
    { id: "viajes", label: "Viajes" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-2)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)]/15 text-sm font-bold text-[var(--accent)]">
              SOL
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">
                Empliados · Mesa demo
              </div>
              <div className="text-xs text-[var(--text-dim)]">
                {room.company} · para {room.contactName}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[var(--accent)]/15 px-3 py-1 font-medium text-[var(--accent-2)]">
              100% DEMO
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--text-dim)]">
              Vence {expiresLabel}
            </span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                tab === n.id
                  ? "bg-[var(--accent)] text-[#042026] font-semibold"
                  : "text-[var(--text-dim)] hover:bg-white/5"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Diagnóstico express
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-dim)]">
              {bullets.map((b) => (
                <li key={b} className="leading-snug">
                  · {b}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              Agentes
            </h2>
            <div className="mt-2 space-y-1">
              {DEMO_AGENTS.map((a) => (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => {
                    setAgent(a.slug);
                    setTab("agentes");
                  }}
                  className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                    agent === a.slug && tab === "agentes"
                      ? "bg-[var(--accent)]/15 text-[var(--accent-2)]"
                      : "text-[var(--text-dim)] hover:bg-white/5"
                  }`}
                >
                  {a.short}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          {tab === "mesa" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Viajes demo", v: String(DEMO_TRIPS.length) },
                  { k: "En ruta", v: String(DEMO_TRIPS.filter((t) => t.estado === "en_curso").length) },
                  { k: "Agentes", v: "10" },
                ].map((c) => (
                  <div
                    key={c.k}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
                  >
                    <div className="text-xs text-[var(--text-faint)]">{c.k}</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--accent-2)]">{c.v}</div>
                  </div>
                ))}
              </div>
              <div className="h-[520px]">
                <DemoMap />
              </div>
            </>
          )}

          {tab === "agentes" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
                Especialista
              </div>
              <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
              <p className="mt-3 max-w-2xl text-[var(--text-dim)] leading-relaxed">
                {selected.blurb}
              </p>
              <p className="mt-4 text-sm text-[var(--text-faint)]">
                En producción este agente opera integrado al Kernel SOL y a la mesa.
                Acá solo ves la ficha demo — sin WhatsApp ni datos reales.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {DEMO_AGENTS.map((a) => (
                  <button
                    key={a.slug}
                    type="button"
                    onClick={() => setAgent(a.slug)}
                    className={`rounded-xl border px-3 py-3 text-left ${
                      a.slug === selected.slug
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] hover:bg-white/5"
                    }`}
                  >
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-dim)]">{a.blurb}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "viajes" && (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
              <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-medium">
                Viajes de ejemplo
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-[var(--text-faint)]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Código</th>
                      <th className="px-4 py-2 font-medium">Cliente</th>
                      <th className="px-4 py-2 font-medium">Ruta</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                      <th className="px-4 py-2 font-medium">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_TRIPS.map((t) => (
                      <tr key={t.id} className="border-t border-[var(--border)]">
                        <td className="px-4 py-2.5 font-medium">{t.id}</td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{t.cliente}</td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">
                          {t.origen} → {t.destino}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: `${STATUS_COLOR[t.estado]}22`,
                              color: STATUS_COLOR[t.estado],
                            }}
                          >
                            {STATUS_LABEL[t.estado]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-dim)]">{t.eta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "faq" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
              <p className="text-base font-medium leading-relaxed text-[var(--accent-2)]">
                {FAQ_INTRO}
              </p>
              <div className="mt-6 space-y-4">
                {FAQ_ITEMS.map((item) => (
                  <div key={item.q} className="border-t border-[var(--border)] pt-4">
                    <h3 className="font-semibold">{item.q}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-dim)]">
                      {item.a}
                    </p>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] pt-4">
                  <h3 className="font-semibold">¿Qué hacen los 10 agentes?</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-[var(--text-dim)]">
                    {DEMO_AGENTS.map((a) => (
                      <li key={a.slug}>
                        <span className="font-medium text-[var(--text)]">{a.name}</span> — {a.blurb}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
