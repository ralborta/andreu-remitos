"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "./ui";

export type AgentChatMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  text: string;
  at?: string;
  meta?: {
    engine?: string;
    dataSources?: string[];
    citedIds?: string[];
  };
};

type AgentChatProps = {
  agentId: string;
  agentLabel: string;
  tenant?: string | null;
  /** Envía mensaje al backend; debe devolver texto assistant + conversationId */
  onSend: (input: {
    message: string;
    conversationId: string | null;
    agentId: string;
    tenant?: string | null;
  }) => Promise<{
    conversationId: string;
    text: string;
    engine?: string;
    dataSources?: string[];
    citedIds?: string[];
  }>;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  emptyHint?: string;
};

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function Bubble({ m }: { m: AgentChatMessage }) {
  const mine = m.role === "user";
  return (
    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-[var(--violet)] text-white"
            : "rounded-bl-md bg-emerald-950/45 text-emerald-50 ring-1 ring-emerald-800/35",
        )}
      >
        {!mine && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">
            Agente
          </p>
        )}
        <p className="whitespace-pre-wrap leading-snug">{m.text}</p>
        <div
          className={clsx(
            "mt-1 flex flex-wrap items-center gap-2 text-[10px]",
            mine ? "justify-end text-white/55" : "text-emerald-200/55",
          )}
        >
          {formatTime(m.at)}
          {!mine && m.meta?.engine && <span>· {m.meta.engine}</span>}
          {!mine && m.meta?.dataSources?.includes("demo") && (
            <span className="rounded bg-amber-500/20 px-1 text-amber-200">demo</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chat reutilizable operador ↔ agente especialista (web).
 * Sin lógica de negocio: solo UI + callback onSend.
 */
export function AgentChat({
  agentId,
  agentLabel,
  tenant,
  onSend,
  suggestions = [],
  placeholder = "Escribí una pregunta…",
  className,
  emptyHint,
}: AgentChatProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setDraft("");
    const at = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", text: message, at }]);
    setBusy(true);
    try {
      const res = await onSend({ message, conversationId, agentId, tenant });
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.text,
          at: new Date().toISOString(),
          meta: {
            engine: res.engine,
            dataSources: res.dataSources,
            citedIds: res.citedIds,
          },
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al consultar el agente";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `No pude responder: ${msg}`,
          at: new Date().toISOString(),
          meta: { engine: "error", dataSources: [] },
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={clsx("flex min-h-[420px] flex-col", className)}>
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1 text-xs text-[var(--violet-2)]">
            <Sparkles size={13} />
            {agentLabel}
          </span>
        }
      >
        Chat del agente
      </SectionTitle>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Consultas sobre datos reales del módulo. Sin acciones de mesa desde el chat.
      </p>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-black/20">
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="text-sm text-[var(--text-faint)]">
              {emptyHint || `Preguntale al agente ${agentLabel} sobre el estado del módulo.`}
            </p>
          )}
          {messages.map((m, i) => (
            <Bubble key={m.id || `${m.role}-${i}-${m.at}`} m={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
              <Loader2 size={14} className="animate-spin" />
              Consultando {agentLabel}…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] px-3 py-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void send(s)}
                className="rounded-lg border border-[var(--border)] bg-white/5 px-2 py-1 text-left text-[11px] text-[var(--text-dim)] hover:border-[var(--violet)]/40 hover:text-white disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2 border-t border-[var(--border)] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--violet)]/50"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--violet)] px-3 text-white disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {conversationId && (
        <p className="mt-2 truncate text-[10px] text-[var(--text-faint)]">
          Conversación {conversationId}
        </p>
      )}
    </Card>
  );
}
