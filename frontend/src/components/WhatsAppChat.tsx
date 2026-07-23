"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  CheckCheck,
  FileText,
  MapPin,
  ReceiptText,
  Paperclip,
  Smile,
  Mic,
  Mail,
} from "lucide-react";
import type { Conversation, ChatMessage } from "@/lib/data";

function Attachment({ type }: { type: NonNullable<ChatMessage["attachment"]> }) {
  if (type === "ubicacion") {
    return (
      <div className="mb-1 overflow-hidden rounded-lg">
        <div className="relative flex h-28 w-56 items-center justify-center bg-[#1d2b22]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <MapPin className="relative text-[#34d399]" size={28} />
        </div>
        <div className="bg-black/20 px-2 py-1 text-[11px] text-white/80">
          Ubicación de entrega · Avellaneda
        </div>
      </div>
    );
  }
  const label = type === "remito" ? "Remito.jpg" : "Comprobante.jpg";
  const Icon = type === "remito" ? FileText : ReceiptText;
  return (
    <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/20 p-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white/80">
        <Icon size={18} />
      </div>
      <div className="leading-tight">
        <p className="text-xs font-medium text-white/90">{label}</p>
        <p className="text-[10px] text-white/50">imagen · 1,2 MB</p>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.from === "agent";
  return (
    <div className={clsx("flex animate-in", mine ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-[#144d3c] text-white"
            : "rounded-bl-md bg-[#202b39] text-[#e9edf0]",
        )}
      >
        {m.attachment && <Attachment type={m.attachment} />}
        {m.text && <p className="whitespace-pre-wrap leading-snug">{m.text}</p>}
        <div
          className={clsx(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-white/55" : "text-white/40",
          )}
        >
          {m.time}
          {mine && <CheckCheck size={13} className="text-[#53bdeb]" />}
        </div>
      </div>
    </div>
  );
}

export function WhatsAppChat({ conversation }: { conversation: Conversation }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // Pequeño ciclo de "escribiendo…" para dar sensación de actividad.
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setTyping(true);
      setTimeout(() => alive && setTyping(false), 2200);
    };
    const t = setInterval(loop, 9000);
    const first = setTimeout(loop, 3500);
    return () => {
      alive = false;
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, []);

  const isEmail = conversation.channel === "Email";

  return (
    <div className="surface-dark flex h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0b141a]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-black/40 bg-[#202c33] px-4 py-2.5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6d28d9] to-[#d946ef] text-sm font-bold text-white">
          {conversation.contactName
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {conversation.contactName}
          </p>
          <p className="truncate text-[11px] text-[#8696a0]">
            {typing ? (
              <span className="text-[#53bdeb]">escribiendo…</span>
            ) : (
              conversation.contactRole
            )}
          </p>
        </div>
        <span
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold",
            isEmail ? "bg-[#38bdf8]/15 text-[#38bdf8]" : "bg-[#25d366]/15 text-[#25d366]",
          )}
        >
          {isEmail ? <Mail size={12} /> : <WhatsAppGlyph />}
          {conversation.channel}
        </span>
      </div>

      {/* messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto scroll-thin px-4 py-4"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="mx-auto mb-2 w-fit rounded-md bg-black/30 px-2.5 py-0.5 text-[10px] text-white/50">
          Hoy
        </div>
        {conversation.messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#202b39] px-3 py-2.5">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </div>
          </div>
        )}
      </div>

      {/* input (decorativo) */}
      <div className="flex items-center gap-2 border-t border-black/40 bg-[#202c33] px-3 py-2.5">
        <Smile size={20} className="text-[#8696a0]" />
        <Paperclip size={20} className="text-[#8696a0]" />
        <div className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm text-[#8696a0]">
          Escribí un mensaje
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white">
          <Mic size={18} />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.07c-.25.69-1.45 1.32-1.99 1.36-.53.05-1.02.24-3.44-.72-2.91-1.15-4.76-4.12-4.9-4.31-.14-.19-1.17-1.56-1.17-2.97s.74-2.11 1-2.4c.25-.29.55-.36.73-.36.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.83 2.07.9 2.22.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.35 1.45.29.15.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.15.27.1 1.71.81 2 .96.29.15.49.22.56.34.07.12.07.69-.18 1.38Z" />
    </svg>
  );
}
