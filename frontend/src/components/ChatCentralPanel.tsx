"use client";

/**
 * Chat Central / asistentes — solo presentación visual (lógica intacta).
 * Referencia: captura ChatGPT-like SOL (mensajes abiertos + compositor pill).
 */
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
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  History,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  ReceiptText,
  Route,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { postAgentChat } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { getAgent } from "@/lib/agents";
import { AgentIcon } from "./Icon";
import type { AgentChatHandle, AgentChatMessage } from "./AgentChat";

const C = {
  white: "#FFFFFF",
  exterior: "#F7F5FC",
  text: "#17172F",
  textSec: "#77728F",
  violet: "#6D35F2",
  violetHover: "#5B27D8",
  violetLight: "#F3EEFF",
  userBg: "#F6F3FC",
  border: "#E4DCF7",
  borderSoft: "#EEEAF6",
  green: "#12B76A",
  greenBg: "#ECFDF3",
  placeholder: "#918AA8",
  liveText: "#3D3951",
  sendDisabled: "#D8C8FA",
} as const;

export const ASSISTANT_CHAT_PANEL_HEIGHT: CSSProperties = {
  height: "min(640px, calc(100vh - 10rem))",
  maxHeight: "min(640px, calc(100vh - 10rem))",
};

export const CHAT_CENTRAL_PANEL_HEIGHT = ASSISTANT_CHAT_PANEL_HEIGHT;

const CARD_TONES: CSSProperties[] = [
  { background: C.violetLight, color: C.violet },
  { background: "#E8F4FF", color: "#0284C7" },
  { background: "#FFF8E8", color: "#D97706" },
  { background: C.greenBg, color: C.green },
];

const AGENT_CARD_ICONS: Record<string, ReactNode[]> = {
  commander: [
    <Truck key="t" size={18} />,
    <TriangleAlert key="i" size={18} />,
    <Clock key="c" size={18} />,
    <Route key="r" size={18} />,
  ],
  viajes: [
    <Route key="r" size={18} />,
    <Truck key="t" size={18} />,
    <Clock key="c" size={18} />,
    <MapPin key="m" size={18} />,
  ],
  remitos: [
    <FileText key="f" size={18} />,
    <ClipboardCheck key="c" size={18} />,
    <Truck key="t" size={18} />,
    <FileText key="f2" size={18} />,
  ],
  destinos: [
    <MapPin key="m" size={18} />,
    <Route key="r" size={18} />,
    <Clock key="c" size={18} />,
    <MapPin key="m2" size={18} />,
  ],
  incidencias: [
    <TriangleAlert key="i" size={18} />,
    <Clock key="c" size={18} />,
    <Truck key="t" size={18} />,
    <TriangleAlert key="i2" size={18} />,
  ],
  rendicion: [
    <ReceiptText key="r" size={18} />,
    <FileText key="f" size={18} />,
    <ClipboardCheck key="c" size={18} />,
    <ReceiptText key="r2" size={18} />,
  ],
  eta: [
    <Clock key="c" size={18} />,
    <Truck key="t" size={18} />,
    <TriangleAlert key="i" size={18} />,
    <Route key="r" size={18} />,
  ],
  pod: [
    <ClipboardCheck key="c" size={18} />,
    <FileText key="f" size={18} />,
    <TriangleAlert key="i" size={18} />,
    <ClipboardCheck key="c2" size={18} />,
  ],
};

const DEFAULT_COMMANDER_SUGGESTIONS = [
  "¿Cuántos camiones están por salir?",
  "¿Qué incidencias tenemos?",
  "¿Qué camiones tienen demora?",
  "¿Qué viajes están pendientes?",
];

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/** Avatar Chat Central: burbuja violeta (referencia), no Radio/OpenAI. */
function ChatAvatar({
  agentId,
  agentIcon,
  size = 38,
}: {
  agentId: string;
  agentIcon?: string;
  size?: number;
}) {
  const iconSize = Math.round(size * 0.42);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: C.violetLight,
        color: C.violet,
      }}
      aria-hidden
    >
      {agentId === "commander" || !agentIcon ? (
        <MessageCircle size={iconSize} strokeWidth={2} />
      ) : (
        <AgentIcon name={agentIcon} size={iconSize} />
      )}
    </span>
  );
}

function MessageActions({ text, at }: { text: string; at?: string }) {
  const btn =
    "inline-flex h-[30px] w-[30px] items-center justify-center text-[#77728F] transition-colors hover:text-[#6D35F2]";
  return (
    <div className="mt-3.5 flex flex-wrap items-center" style={{ gap: 14 }}>
      <button
        type="button"
        title="Copiar"
        aria-label="Copiar"
        className={btn}
        onClick={() => {
          void navigator.clipboard?.writeText(text).catch(() => {});
        }}
      >
        <Copy size={17} strokeWidth={1.75} />
      </button>
      <button type="button" title="Útil" aria-label="Útil" className={btn}>
        <ThumbsUp size={17} strokeWidth={1.75} />
      </button>
      <button type="button" title="No útil" aria-label="No útil" className={btn}>
        <ThumbsDown size={17} strokeWidth={1.75} />
      </button>
      <span className="text-[11px] leading-none" style={{ color: C.placeholder }}>
        {formatTime(at)}
      </span>
    </div>
  );
}

function LiveDataIndicator() {
  return (
    <p
      className="flex items-center gap-2 leading-none"
      style={{ marginTop: 14, fontSize: 12, color: C.textSec }}
    >
      <span
        className="inline-block shrink-0 rounded-full"
        style={{ width: 7, height: 7, background: C.green }}
      />
      Datos operativos conectados
    </p>
  );
}

function UserMessage({ m }: { m: AgentChatMessage }) {
  return (
    <div className="flex w-full justify-end">
      <div className="sol-user-msg max-w-[70%]">
        <div
          className="inline-block max-w-full"
          style={{
            background: C.userBg,
            color: C.text,
            borderRadius: 18,
            padding: "11px 16px",
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.45,
          }}
        >
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
        <div
          className="mt-1.5 flex items-center justify-end gap-1.5"
          style={{ fontSize: 11, color: C.placeholder }}
        >
          {formatTime(m.at)}
          <CheckCheck size={12} style={{ color: C.violet }} strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({
  m,
  agentId,
  agentLabel,
  agentIcon,
}: {
  m: AgentChatMessage;
  agentId: string;
  agentLabel: string;
  agentIcon?: string;
}) {
  const paragraphs = m.text.split(/\n\n+/).filter(Boolean);
  return (
    <div className="flex w-full max-w-[720px] items-start" style={{ gap: 14 }}>
      <ChatAvatar agentId={agentId} agentIcon={agentIcon} size={38} />
      <div className="min-w-0 max-w-[660px] flex-1">
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {agentLabel}
        </p>
        <div
          style={{
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.65,
            color: C.text,
          }}
        >
          {paragraphs.map((para, i) => (
            <p key={i} className={i > 0 ? "mt-3 whitespace-pre-wrap" : "whitespace-pre-wrap"}>
              {para}
            </p>
          ))}
        </div>
        <MessageActions text={m.text} at={m.at} />
        <LiveDataIndicator />
      </div>
    </div>
  );
}

function ChatComposer({
  draft,
  setDraft,
  busy,
  onSubmit,
  placeholder,
  liveLabel,
  error,
  footer,
}: {
  draft: string;
  setDraft: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
  placeholder: string;
  liveLabel: string;
  error: string | null;
  footer: string;
}) {
  const canSend = !busy && Boolean(draft.trim());
  return (
    <div className="sol-chat-composer shrink-0">
      <form
        className="sol-composer-form mx-auto flex w-full max-w-[720px] items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <button
          type="button"
          title="Adjuntar"
          aria-label="Adjuntar"
          className="sol-composer-plus flex shrink-0 items-center justify-center rounded-full"
        >
          <Plus size={20} strokeWidth={1.75} />
        </button>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          className="sol-composer-input min-w-0 flex-1 border-0 bg-transparent outline-none ring-0"
        />

        <button type="button" className="sol-live-chip shrink-0 items-center gap-1.5">
          <span className="sol-live-dot" />
          <span className="sol-live-text">{liveLabel}</span>
          <ChevronDown size={12} style={{ color: C.textSec }} />
        </button>

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar"
          className={clsx("sol-send-btn flex shrink-0 items-center justify-center rounded-full text-white", !canSend && "is-disabled")}
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </form>

      {error ? (
        <p className="mx-auto mt-2 max-w-[720px] text-center text-xs text-rose-500">{error}</p>
      ) : (
        <p className="sol-chat-footer-safe mx-auto flex max-w-[720px] items-center justify-center gap-1.5 text-center">
          <Lock size={13} strokeWidth={1.75} />
          {footer}
        </p>
      )}
    </div>
  );
}

function heroForAgent(agentId: string, agentLabel: string) {
  if (agentId === "commander") {
    return {
      title: "¿Qué necesitás saber de la operación?",
      subtitle:
        "Consultá viajes, incidencias, ETA, POD, remitos y rendiciones con datos en tiempo real.",
      live: "Operación en vivo",
      placeholder: "Preguntá algo sobre la operación…",
      footer: "Las respuestas se generan con datos reales de tus módulos activos.",
    };
  }
  return {
    title: `¿Qué necesitás saber de ${agentLabel}?`,
    subtitle: `Consultá datos reales del módulo ${agentLabel}. Solo lectura desde el chat.`,
    live: `${agentLabel} en vivo`,
    placeholder: `Preguntá algo sobre ${agentLabel}…`,
    footer: `Las respuestas se generan con datos reales de ${agentLabel}.`,
  };
}

export type AssistantChatPanelProps = {
  agentId: string;
  agentLabel: string;
  suggestions?: string[];
  className?: string;
  tenant?: string | null;
  heroTitle?: string;
  heroSubtitle?: string;
  placeholder?: string;
};

export const AssistantChatPanel = forwardRef<AgentChatHandle, AssistantChatPanelProps>(
  function AssistantChatPanel(
    {
      agentId,
      agentLabel,
      suggestions,
      className,
      tenant,
      heroTitle,
      heroSubtitle,
      placeholder,
    },
    ref,
  ) {
    const meta = heroForAgent(agentId, agentLabel);
    const catalog = getAgent(agentId);
    const texts =
      suggestions?.filter(Boolean).slice(0, 4) ||
      (agentId === "commander" ? DEFAULT_COMMANDER_SUGGESTIONS : []);
    const icons = AGENT_CARD_ICONS[agentId] || [
      <Sparkles key="1" size={18} />,
      <MessageCircle key="2" size={18} />,
      <FileText key="3" size={18} />,
      <Route key="4" size={18} />,
    ];
    const cards = texts.map((text, i) => ({
      text,
      icon: icons[i] ?? icons[0],
      tone: CARD_TONES[i % CARD_TONES.length],
    }));

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
          agentId,
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
        const msg = e instanceof Error ? e.message : `Error al consultar ${agentLabel}`;
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
    const title = heroTitle || meta.title;
    const subtitle = heroSubtitle || meta.subtitle;
    const inputPlaceholder = placeholder || meta.placeholder;

    return (
      <div
        className={clsx("sol-chat-root relative flex w-full flex-col overflow-hidden", className)}
        style={{
          ...ASSISTANT_CHAT_PANEL_HEIGHT,
          background: C.white,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
        }}
      >
        <style>{`
          .sol-chat-root {
            --sol-violet: ${C.violet};
            --sol-violet-hover: ${C.violetHover};
            --sol-border: ${C.border};
            --sol-text: ${C.text};
            --sol-sec: ${C.textSec};
            --sol-ph: ${C.placeholder};
          }
          .sol-chat-thread {
            display: flex;
            flex-direction: column;
            padding: 32px 40px 24px;
            gap: 30px;
            background: ${C.white};
            overflow-y: auto;
            overscroll-behavior: contain;
          }
          @media (max-width: 900px) {
            .sol-chat-thread { padding: 24px 20px 20px; }
            .sol-user-msg { max-width: 85% !important; }
            .sol-live-text { display: none; }
          }
          @media (max-width: 640px) {
            .sol-chat-thread { padding: 20px 14px 16px; }
            .sol-composer-form { border-radius: 24px !important; }
            .sol-chat-footer-safe { display: none; }
            .sol-chat-composer { padding: 0 14px 12px !important; }
          }
          .sol-chat-composer {
            padding: 0 20px 16px;
            background: ${C.white};
          }
          .sol-composer-form {
            min-height: 58px;
            background: ${C.white};
            border: 1px solid ${C.border};
            border-radius: 30px;
            padding: 7px 9px 7px 12px;
            box-shadow: 0 6px 20px rgba(46, 32, 91, 0.10);
            gap: 10px;
          }
          .sol-composer-plus {
            width: 40px;
            height: 40px;
            color: ${C.textSec};
            background: transparent;
          }
          .sol-composer-plus:hover {
            background: ${C.violetLight};
            color: ${C.violet};
          }
          .sol-composer-input {
            font-size: 14px;
            color: ${C.text};
          }
          .sol-composer-input::placeholder {
            color: ${C.placeholder};
            opacity: 1;
          }
          .sol-live-chip {
            display: none;
            height: 34px;
            background: ${C.white};
            border: 1px solid ${C.border};
            border-radius: 17px;
            padding: 0 12px;
            font-size: 12px;
            color: ${C.liveText};
          }
          @media (min-width: 640px) {
            .sol-live-chip { display: inline-flex; }
          }
          .sol-live-chip:hover { background: ${C.exterior}; }
          .sol-live-dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: ${C.green};
            display: inline-block;
          }
          .sol-send-btn {
            width: 44px;
            height: 44px;
            background: ${C.violet};
            border: none;
            box-shadow: 0 4px 10px rgba(109, 53, 242, 0.22);
            cursor: pointer;
          }
          .sol-send-btn:hover:not(.is-disabled) {
            background: ${C.violetHover};
          }
          .sol-send-btn.is-disabled {
            background: ${C.sendDisabled};
            box-shadow: none;
            cursor: not-allowed;
          }
          .sol-chat-footer-safe {
            margin-top: 8px;
            font-size: 11px;
            color: ${C.placeholder};
          }
        `}</style>

        {/* Header solo en empty state (como mock empty). En conversación: superficie limpia. */}
        {empty && (
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 max-md:px-3.5"
            style={{ borderBottom: `1px solid ${C.borderSoft}` }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex shrink-0 items-center justify-center rounded-full text-white"
                style={{ width: 36, height: 36, background: C.violet }}
              >
                {catalog?.icon ? <AgentIcon name={catalog.icon} size={16} /> : <Sparkles size={16} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: C.text }}>
                  {agentLabel}
                </p>
                <p className="flex items-center gap-1.5 text-[11px]" style={{ color: C.textSec }}>
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: C.green }}
                  />
                  En línea
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium"
                style={{ color: C.textSec }}
                title="Historial (próximamente)"
              >
                <History size={14} />
                <span className="hidden sm:inline">Historial</span>
              </button>
              <span className="mx-1 hidden h-4 w-px sm:block" style={{ background: C.borderSoft }} />
              <button
                type="button"
                onClick={resetConversation}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium"
                style={{ color: C.text }}
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Nueva conversación</span>
              </button>
            </div>
          </div>
        )}

        {!empty && (
          <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
            <button
              type="button"
              onClick={resetConversation}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
              style={{ color: C.textSec, background: C.white, border: `1px solid ${C.borderSoft}` }}
              title="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        <div ref={threadRef} className="sol-chat-thread relative min-h-0 flex-1">
          {empty ? (
            <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center">
              <div className="mb-6 text-center">
                <span
                  className="mx-auto mb-3 flex items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, background: C.violetLight, color: C.violet }}
                >
                  <MessageCircle size={22} />
                </span>
                <h2
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                  style={{ color: C.text }}
                >
                  {title}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: C.textSec }}>
                  {subtitle}
                </p>
              </div>
              {cards.length > 0 && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {cards.map((c) => (
                    <button
                      key={c.text}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(c.text)}
                      className="group flex min-h-[4.5rem] items-center gap-3 rounded-[16px] px-3.5 text-left transition disabled:opacity-50"
                      style={{ background: C.white, border: `1px solid ${C.border}` }}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={c.tone}
                      >
                        {c.icon}
                      </span>
                      <span
                        className="min-w-0 flex-1 text-sm font-medium leading-snug"
                        style={{ color: C.text }}
                      >
                        {c.text}
                      </span>
                      <ArrowRight
                        size={16}
                        className="shrink-0 transition group-hover:translate-x-0.5"
                        style={{ color: C.textSec }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[720px] flex-col" style={{ gap: 30 }}>
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserMessage key={m.id || `u-${i}-${m.at}`} m={m} />
                ) : (
                  <AssistantMessage
                    key={m.id || `a-${i}-${m.at}`}
                    m={m}
                    agentId={agentId}
                    agentLabel={agentLabel}
                    agentIcon={catalog?.icon}
                  />
                ),
              )}
              {busy && (
                <div className="flex max-w-[720px] items-start" style={{ gap: 14 }}>
                  <ChatAvatar agentId={agentId} agentIcon={catalog?.icon} size={38} />
                  <div
                    className="flex items-center gap-2 pt-2"
                    style={{ fontSize: 12, color: C.textSec }}
                  >
                    <Loader2 size={14} className="animate-spin" />
                    Pensando…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ChatComposer
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onSubmit={() => void send(draft)}
          placeholder={inputPlaceholder}
          liveLabel={meta.live}
          error={error}
          footer={meta.footer}
        />
      </div>
    );
  },
);

export const ChatCentralPanel = forwardRef<
  AgentChatHandle,
  { className?: string; tenant?: string | null; suggestions?: string[] }
>(function ChatCentralPanel({ className, tenant, suggestions }, ref) {
  return (
    <AssistantChatPanel
      ref={ref}
      agentId="commander"
      agentLabel="Chat Central"
      className={className}
      tenant={tenant}
      suggestions={suggestions?.length ? suggestions : DEFAULT_COMMANDER_SUGGESTIONS}
    />
  );
});
