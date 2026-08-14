"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import {
  ArrowRight,
  CheckCheck,
  ChevronDown,
  Clock,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Route,
  Send,
  Sparkles,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { postAgentChat } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import type { AgentChatHandle, AgentChatMessage } from "./AgentChat";

export const CHAT_CENTRAL_PANEL_HEIGHT: CSSProperties = {
  height: "min(640px, calc(100vh - 10rem))",
  maxHeight: "min(640px, calc(100vh - 10rem))",
};

const DEFAULT_SUGGESTIONS: Array<{
  text: string;
  icon: ReactNode;
  tone: string;
}> = [
  {
    text: "¿Cuántos camiones están por salir?",
    icon: <Truck size={18} />,
    tone: "bg-[#7c3aed]/12 text-[#7c3aed]",
  },
  {
    text: "¿Qué incidencias tenemos?",
    icon: <TriangleAlert size={18} />,
    tone: "bg-sky-500/15 text-sky-600",
  },
  {
    text: "¿Qué camiones tienen demora?",
    icon: <Clock size={18} />,
    tone: "bg-amber-500/15 text-amber-600",
  },
  {
    text: "¿Qué viajes están pendientes?",
    icon: <Route size={18} />,
    tone: "bg-emerald-500/15 text-emerald-600",
  },
];

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
          "max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-[var(--violet)] text-white"
            : "rounded-bl-md border border-[var(--border)] bg-[var(--panel)] text-[var(--text)]",
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
        <div
          className={clsx(
            "mt-1.5 flex items-center gap-1.5 text-[10px]",
            mine ? "justify-end text-white/70" : "text-[var(--text-faint)]",
          )}
        >
          {formatTime(m.at)}
          {mine && <CheckCheck size={12} className="opacity-80" />}
        </div>
      </div>
    </div>
  );
}

type ChatCentralPanelProps = {
  className?: string;
  tenant?: string | null;
  suggestions?: string[];
};

/**
 * Chat Central — UX tipo asistente (hero + cards + input), mismo runtime desk-chat.
 * Caja de altura fija: el hilo scrollea adentro.
 */
export const ChatCentralPanel = forwardRef<AgentChatHandle, ChatCentralPanelProps>(
  function ChatCentralPanel({ className, tenant, suggestions }, ref) {
    const cards =
      suggestions?.length
        ? DEFAULT_SUGGESTIONS.map((s, i) => ({
            ...s,
            text: suggestions[i] ?? s.text,
          })).slice(0, 4)
        : DEFAULT_SUGGESTIONS;

    const [messages, setMessages] = useState<AgentChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const threadRef = useRef<HTMLDivElement>(null);
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

    function resetConversation() {
      setMessages([]);
      setConversationId(null);
      conversationIdRef.current = null;
      setDraft("");
      setError(null);
    }

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
        const res = await postAgentChat({
          agentId: "commander",
          message,
          conversationId: conversationIdRef.current || undefined,
          tenant: (tenant ?? BRAND.remitoTenantSlug) || undefined,
        });
        setConversationId(res.conversationId);
        conversationIdRef.current = res.conversationId;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: res.message.text,
            at: new Date().toISOString(),
            meta: {
              engine: res.message.engine,
              dataSources: res.message.dataSources,
              citedIds: res.message.citedIds,
            },
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al consultar el Chat Central";
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

    const empty = messages.length === 0;

    return (
      <div
        className={clsx(
          "flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[0_12px_40px_rgba(15,10,40,0.06)]",
          className,
        )}
        style={CHAT_CENTRAL_PANEL_HEIGHT}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--violet)] text-white shadow-sm">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text)]">Chat Central</p>
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
                En línea
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
              title="Historial (próximamente)"
            >
              <History size={14} />
              <span className="hidden sm:inline">Historial</span>
            </button>
            <button
              type="button"
              onClick={resetConversation}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--violet)]/40"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Nueva conversación</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          ref={threadRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 [scrollbar-gutter:stable]"
        >
          {empty ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
              <div className="mb-6 text-center">
                <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--violet)]/12 text-[var(--violet)]">
                  <MessageCircle size={18} />
                </span>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                  ¿Qué necesitás saber de la operación?
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-dim)]">
                  Consultá viajes, incidencias, ETA, POD, remitos y rendiciones con datos en tiempo
                  real.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {cards.map((c) => (
                  <button
                    key={c.text}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(c.text)}
                    className="group flex h-[4.5rem] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3.5 text-left shadow-sm transition hover:border-[var(--violet)]/35 hover:shadow-md disabled:opacity-50"
                  >
                    <span
                      className={clsx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        c.tone,
                      )}
                    >
                      {c.icon}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--text)]">
                      {c.text}
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-[var(--text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--violet)]"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-3 pb-2">
              {messages.map((m, i) => (
                <Bubble key={m.id || `${m.role}-${i}-${m.at}`} m={m} />
              ))}
              {busy && (
                <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-faint)]">
                  <Loader2 size={14} className="animate-spin" />
                  Pensando…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-[var(--border)] px-4 pb-3 pt-3 sm:px-5">
          <form
            className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 shadow-sm focus-within:border-[var(--violet)]/45 focus-within:ring-2 focus-within:ring-[var(--violet)]/15"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-dim)] hover:bg-[var(--panel)]"
              title="Adjuntar (próximamente)"
              aria-label="Adjuntar"
            >
              <Plus size={18} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Preguntá algo sobre la operación..."
              disabled={busy}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
            <span className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-dim)] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
              Operación en vivo
              <ChevronDown size={12} className="opacity-60" />
            </span>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--violet)] text-white disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={15} />
            </button>
          </form>
          {error ? (
            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-rose-500">{error}</p>
          ) : (
            <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1.5 text-center text-[11px] text-[var(--text-faint)]">
              <Lock size={11} />
              Las respuestas se generan con datos reales de tus módulos activos.
            </p>
          )}
        </div>
      </div>
    );
  },
);
