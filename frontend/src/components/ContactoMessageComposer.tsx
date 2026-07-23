"use client";

import { useEffect, useRef, useState } from "react";
import { Send, PauseCircle, PlayCircle } from "lucide-react";
import { enviarMensajeConversacion, enviarTypingConversacion, setBotPausado } from "@/lib/api";

const TYPING_DEBOUNCE_MS = 400;
const TYPING_REFRESH_MS = 8000;

export function ContactoMessageComposer({
  telefono,
  botPausado,
  onSent,
  onBotToggle,
  onTypingChange,
}: {
  telefono: string;
  botPausado: boolean;
  onSent: () => void;
  onBotToggle: (pausado: boolean) => void;
  onTypingChange?: (active: boolean) => void;
}) {
  const [texto, setTexto] = useState("");
  const [notaInterna, setNotaInterna] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTyping() {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    onTypingChange?.(false);
  }

  function startTypingLoop() {
    onTypingChange?.(true);
    enviarTypingConversacion(telefono);
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = setInterval(() => {
      enviarTypingConversacion(telefono);
    }, TYPING_REFRESH_MS);
  }

  function handleTextChange(value: string) {
    setTexto(value);
    if (notaInterna || !value.trim()) {
      stopTyping();
      return;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      startTypingLoop();
    }, TYPING_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => stopTyping();
  }, [telefono]);

  useEffect(() => {
    if (notaInterna) stopTyping();
  }, [notaInterna]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    stopTyping();
    setLoading(true);
    setError(null);
    try {
      await enviarMensajeConversacion(telefono, { texto: texto.trim(), nota_interna: notaInterna });
      setTexto("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBot() {
    setTogglingBot(true);
    setError(null);
    try {
      const next = !botPausado;
      await setBotPausado(telefono, next);
      onBotToggle(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar bot");
    } finally {
      setTogglingBot(false);
    }
  }

  return (
    <form onSubmit={enviar} className="border-t border-[var(--border)] bg-[#202c33] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
          <input
            type="checkbox"
            checked={notaInterna}
            onChange={(e) => setNotaInterna(e.target.checked)}
            className="rounded"
          />
          Nota interna (no va a WhatsApp)
        </label>
        <button
          type="button"
          onClick={toggleBot}
          disabled={togglingBot}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            botPausado
              ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
              : "bg-white/5 text-[var(--text-dim)] hover:text-white"
          }`}
        >
          {botPausado ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
          {botPausado ? "Reactivar bot ya" : "Pausar bot"}
        </button>
      </div>
      {botPausado && (
        <p className="mb-2 text-[10px] text-amber-400/90">
          Bot pausado — vos respondés al chofer. Se reactiva solo tras 5 min sin mensajes (operador o chofer).
        </p>
      )}
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={texto}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={stopTyping}
          placeholder={notaInterna ? "Nota para el equipo…" : "Escribí al chofer por WhatsApp…"}
          className="surface-dark flex-1 resize-none rounded-xl border border-[var(--border)] bg-[#2a3942] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
        />
        <button
          type="submit"
          disabled={loading || !texto.trim()}
          className="flex h-auto items-center justify-center rounded-xl bg-[#00a884] px-4 text-white hover:bg-[#00a884]/90 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--red)]">{error}</p>}
    </form>
  );
}
