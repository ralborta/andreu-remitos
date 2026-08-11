"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCheck, Loader2, Send, Sparkles } from "lucide-react";
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

export type AgentChatHandle = {
  send: (text: string) => void;
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
  /** Si true, no muestra chips dentro del chat (van en la guía lateral). */
  hideSuggestions?: boolean;
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
          "max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-[#DCF8C6] text-[#111b21]"
            : "rounded-bl-md bg-white/[0.07] text-[var(--text)] ring-1 ring-white/10",
        )}
      >
        <p className="whitespace-pre-wrap leading-snug">{m.text}</p>
        <div
          className={clsx(
            "mt-1 flex flex-wrap items-center gap-1.5 text-[10px]",
            mine ? "justify-end text-[#667781]" : "text-[var(--text-faint)]",
          )}
        >
          {formatTime(m.at)}
          {mine && <CheckCheck size={12} className="text-[#53bdeb]" />}
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
 * Altura fija: solo el hilo scrollea; header / chips / input no crecen.
 */
export const AgentChat = forwardRef<AgentChatHandle, AgentChatProps>(function AgentChat(
  {
    agentId,
    agentLabel,
    tenant,
    onSend,
    suggestions = [],
    hideSuggestions = false,
    placeholder = "Escribí tu consulta…",
    className,
    emptyHint,
  },
  ref,
) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busyRef.current) return;
    setError(null);
    setDraft("");
    const at = new Date().toISOString();
    setMessages((prev) => [...prev, { role: "user", text: message, at }]);
    setBusy(true);
    busyRef.current = true;
    try {
      const res = await onSend({
        message,
        conversationId: conversationIdRef.current,
        agentId,
        tenant,
      });
      setConversationId(res.conversationId);
      conversationIdRef.current = res.conversationId;
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
      busyRef.current = false;
    }
  }

  useImperativeHandle(ref, () => ({
    send: (text: string) => {
      void send(text);
    },
  }));

  const showChips = !hideSuggestions && suggestions.length > 0;

  return (
    <Card
      className={clsx(
        "flex h-[min(560px,calc(100vh-12rem))] flex-col overflow-hidden p-4",
        className,
      )}
    >
      <div className="shrink-0 border-b border-[var(--border)] pb-3">
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--violet)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--violet-2)]">
              <Sparkles size={12} />
              {agentLabel}
            </span>
          }
        >
          Chat del agente
        </SectionTitle>
        <p className="mt-1 text-xs text-[var(--text-dim)]">
          Consultas sobre datos reales del módulo. Sin acciones de mesa desde el chat.
        </p>
      </div>

      <div
        ref={threadRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain py-3 pr-1 [scrollbar-gutter:stable]"
      >
        {messages.length === 0 && (
          <Bubble
            m={{
              role: "assistant",
              text:
                emptyHint ||
                `Hola. Soy el asistente de ${agentLabel}. Preguntame por el estado del módulo.`,
              at: new Date().toISOString(),
            }}
          />
        )}
        {messages.map((m, i) => (
          <Bubble key={m.id || `${m.role}-${i}-${m.at}`} m={m} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-faint)]">
            <Loader2 size={14} className="animate-spin" />
            Consultando {agentLabel}…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showChips && (
        <div className="shrink-0 space-y-1.5 border-t border-[var(--border)] pt-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void send(s)}
                className="rounded-full border border-[var(--violet)]/35 bg-[var(--violet)]/10 px-2.5 py-1 text-left text-[11px] text-[var(--violet-2)] hover:bg-[var(--violet)]/20 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="mt-2 flex shrink-0 items-center gap-2 border-t border-[var(--border)] pt-2"
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
          className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--violet)]/50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--violet)] text-white disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send size={16} />
        </button>
      </form>

      {error && <p className="mt-2 shrink-0 text-xs text-rose-300">{error}</p>}
    </Card>
  );
});
