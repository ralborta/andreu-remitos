"use client";

import { useRef, type ReactNode } from "react";
import { BookOpen, ListChecks, MessageSquareText, Shield } from "lucide-react";
import { SpecialistAgentChat } from "./SpecialistAgentChat";
import {
  AGENT_CHAT_PANEL_CLASS,
  AGENT_CHAT_PANEL_HEIGHT,
  type AgentChatHandle,
} from "./AgentChat";
import { Card, SectionTitle } from "./ui";

type GuideSection = { title: string; items: string[] };

type ModuleWithChatProps = {
  agentId: string;
  agentLabel: string;
  suggestions: string[];
  guideSections: GuideSection[];
  emptyHint?: string;
  children: ReactNode;
};

function ChatGuide({
  agentLabel,
  sections,
  suggestions,
  onAsk,
}: {
  agentLabel: string;
  sections: GuideSection[];
  suggestions: string[];
  onAsk: (q: string) => void;
}) {
  return (
    <Card className={AGENT_CHAT_PANEL_CLASS} style={AGENT_CHAT_PANEL_HEIGHT}>
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
          El chat consulta datos reales de {agentLabel}. Tocá un ejemplo para enviarlo.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1 [scrollbar-gutter:stable]">
        {sections.map((section) => (
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
            {suggestions.map((s) => (
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
          En esta fase el chat no aprueba, rechaza ni envía WhatsApp. Eso sigue en el panel.
        </div>
      </div>
    </Card>
  );
}

/** Panel operativo → chat → guía (prioridad a operación y conversación). */
export function ModuleWithChat({
  agentId,
  agentLabel,
  suggestions,
  guideSections,
  emptyHint,
  children,
}: ModuleWithChatProps) {
  const chatRef = useRef<AgentChatHandle>(null);

  return (
    <div className="space-y-6">
      {children}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <SpecialistAgentChat
            ref={chatRef}
            agentId={agentId}
            agentLabel={agentLabel}
            suggestions={suggestions}
            emptyHint={emptyHint}
            hideSuggestions
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ChatGuide
            agentLabel={agentLabel}
            sections={guideSections}
            suggestions={suggestions}
            onAsk={(q) => chatRef.current?.send(q)}
          />
        </div>
      </div>
    </div>
  );
}
