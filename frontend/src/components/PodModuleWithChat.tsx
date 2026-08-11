"use client";

import { useRef } from "react";
import { BookOpen, ListChecks, MessageSquareText, Shield } from "lucide-react";
import { PodPanel } from "./PodPanel";
import { PodAgentChat, POD_CHAT_SUGGESTIONS } from "./PodAgentChat";
import type { AgentChatHandle } from "./AgentChat";
import { Card, SectionTitle } from "./ui";

const GUIDE_SECTIONS = [
  {
    title: "Contadores",
    items: [
      "¿Cuántos POD recibimos hoy?",
      "¿Cuántos están pendientes / OK / rechazados?",
    ],
  },
  {
    title: "Listados",
    items: [
      "Mostrame los últimos 10",
      "¿Cuáles fueron rechazados?",
    ],
  },
  {
    title: "Detalle",
    items: [
      "¿Por qué se rechazó POD-0002?",
      "¿Qué viaje corresponde a POD-0001?",
    ],
  },
  {
    title: "Seguimiento",
    items: [
      "Después de un listado: ¿cuáles son?",
      "¿Y de esos cuáles son de Córdoba?",
    ],
  },
];

function PodChatGuide({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <Card className="flex h-[min(560px,calc(100vh-12rem))] flex-col overflow-hidden p-4">
      <div className="shrink-0 border-b border-[var(--border)] pb-3">
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-1 text-xs text-[var(--violet-2)]">
              <BookOpen size={13} />
              Guía
            </span>
          }
        >
          Qué podés preguntar
        </SectionTitle>
        <p className="mt-1 text-xs text-[var(--text-dim)]">
          El chat consulta datos reales de POD. Tocá un ejemplo para enviarlo.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1 [scrollbar-gutter:stable]">
        {GUIDE_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              <ListChecks size={12} />
              {section.title}
            </p>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li key={item} className="text-sm text-[var(--text-dim)]">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            <MessageSquareText size={12} />
            Probar ahora
          </p>
          <div className="flex flex-wrap gap-1.5">
            {POD_CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAsk(s)}
                className="rounded-full border border-[var(--violet)]/35 bg-[var(--violet)]/10 px-2.5 py-1 text-left text-[11px] text-[var(--violet-2)] hover:bg-[var(--violet)]/20"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3 text-xs text-[var(--text-dim)]">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-[var(--text)]">
            <Shield size={13} className="text-[var(--violet-2)]" />
            Solo consulta
          </p>
          En esta fase el chat no aprueba, rechaza ni envía WhatsApp. Eso sigue en la mesa de
          control.
        </div>
      </div>
    </Card>
  );
}

/** Módulo POD: registros arriba; guía + chat lado a lado. */
export function PodModuleWithChat() {
  const chatRef = useRef<AgentChatHandle>(null);

  return (
    <div className="space-y-6">
      <PodPanel />
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <PodChatGuide onAsk={(q) => chatRef.current?.send(q)} />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <PodAgentChat ref={chatRef} hideSuggestions className="h-full" />
        </div>
      </div>
    </div>
  );
}
