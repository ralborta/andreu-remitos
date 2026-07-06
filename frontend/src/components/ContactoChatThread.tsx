"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { Mic, Image as ImageIcon } from "lucide-react";
import type { ConversacionMensaje } from "@/lib/conversaciones-types";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function actorLabel(from?: string) {
  if (from === "human") return "Operador";
  if (from === "bot") return "Bot";
  return "Chofer";
}

function Bubble({ msg }: { msg: ConversacionMensaje }) {
  const mine = msg.from === "human" || (msg.dir === "out" && msg.from !== "bot");
  const isBot = msg.from === "bot" || (msg.dir === "out" && msg.from !== "human");

  return (
    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "rounded-br-md bg-[var(--violet)] text-white"
            : isBot
              ? "rounded-bl-md bg-emerald-950/50 text-emerald-100 ring-1 ring-emerald-800/40"
              : "rounded-bl-md bg-[#202b39] text-[#e9edf0]",
        )}
      >
        <p className="mb-1 text-[10px] font-medium opacity-70">{actorLabel(msg.from)}</p>
        {msg.tipo === "image" && msg.imagen_url && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
            <ImageIcon size={16} />
            Foto remito
          </div>
        )}
        {msg.tipo === "audio" && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs">
            <Mic size={16} />
            Nota de voz
          </div>
        )}
        {msg.texto && <p className="whitespace-pre-wrap leading-snug">{msg.texto}</p>}
        {msg.transcripcion && msg.tipo === "audio" && msg.texto !== msg.transcripcion && (
          <p className="mt-1 text-xs opacity-75">Transcripción: {msg.transcripcion}</p>
        )}
        <p className="mt-1 text-right text-[10px] opacity-50">{formatTime(msg.at)}</p>
      </div>
    </div>
  );
}

export function ContactoChatThread({
  mensajes,
  scrollKey = 0,
}: {
  mensajes: ConversacionMensaje[];
  scrollKey?: number;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, scrollKey]);

  if (mensajes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-dim)]">
        Sin mensajes todavía. Cuando el chofer escriba por WhatsApp aparecerán acá.
      </p>
    );
  }

  return (
    <div
      className="flex-1 space-y-2 overflow-y-auto scroll-thin px-3 py-3"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {mensajes.map((m) => (
        <Bubble key={m.id} msg={m} />
      ))}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
