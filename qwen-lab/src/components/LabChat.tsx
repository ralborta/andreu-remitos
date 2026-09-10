"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./LabChat.css";

type Role = "system" | "user" | "assistant";
type Msg = { id: string; role: Role; content: string; meta?: string };

type Health = {
  online: boolean;
  latencyMs?: number;
  defaultModel?: string;
  host?: string;
  models?: string[];
  error?: string;
};

const DEFAULT_SYSTEM =
  "Sos un asistente útil y conciso. Respondé en español. No repitas la pregunta; andá directo a la respuesta.";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function LabChat() {
  const [health, setHealth] = useState<Health | null>(null);
  const [model, setModel] = useState("qwen2.5:1.5b");
  const [system, setSystem] = useState(DEFAULT_SYSTEM);
  const [showSystem, setShowSystem] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [temperature, setTemperature] = useState(0.3);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as Health;
      setHealth(data);
      if (data.defaultModel) setModel((m) => m || data.defaultModel!);
      if (data.models?.length && data.defaultModel && !data.models.includes(model)) {
        setModel(data.defaultModel);
      }
    } catch (e) {
      setHealth({
        online: false,
        error: e instanceof Error ? e.message : "sin conexión",
      });
    }
  }, [model]);

  useEffect(() => {
    void refreshHealth();
    const t = setInterval(() => void refreshHealth(), 20000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const statusLabel = useMemo(() => {
    if (!health) return "Chequeando…";
    if (health.online) return `Online · ${health.latencyMs ?? "—"} ms`;
    return `Offline · ${health.error || "servidor no responde"}`;
  }, [health]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const history: Array<{ role: Role; content: string }> = [
      { role: "system", content: system },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    const ac = new AbortController();
    abortRef.current = ac;
    const t0 = performance.now();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model, temperature }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let meta = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            token?: string;
            done?: boolean;
            totalMs?: number | null;
            tokensPerSec?: number | null;
            error?: string;
          };
          if (payload.error) throw new Error(payload.error);
          if (payload.token) {
            full += payload.token;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
            );
          }
          if (payload.done) {
            const wall = Math.round(performance.now() - t0);
            const parts = [`${wall} ms wall`];
            if (payload.totalMs) parts.push(`${payload.totalMs} ms ollama`);
            if (payload.tokensPerSec) parts.push(`${payload.tokensPerSec} tok/s`);
            meta = parts.join(" · ");
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: full || "(sin respuesta)", meta }
            : m,
        ),
      );
      void refreshHealth();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "(cancelado)", meta: "abort" }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Error: ${err instanceof Error ? err.message : "falló"}`,
                  meta: "error",
                }
              : m,
          ),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function clearChat() {
    if (busy) abortRef.current?.abort();
    setMessages([]);
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <img
            src="/sol-lab-logo.png"
            alt="SOL Lab · Empliados LLM Server"
            className="logo"
            width={320}
            height={128}
          />
        </div>
        <div className="status">
          <span className={`dot ${health?.online ? "on" : "off"}`} />
          <span>{statusLabel}</span>
          <button type="button" className="ghost" onClick={() => void refreshHealth()}>
            Ping
          </button>
        </div>
      </header>

      <aside className="rail">
        <label>
          Modelo
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {(health?.models?.length ? health.models : [model]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temperatura
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
          <span className="hint">{temperature.toFixed(2)}</span>
        </label>
        <button type="button" className="ghost wide" onClick={() => setShowSystem((v) => !v)}>
          {showSystem ? "Ocultar system prompt" : "System prompt"}
        </button>
        {showSystem && (
          <textarea
            className="system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={6}
          />
        )}
        <button type="button" className="ghost wide" onClick={clearChat} disabled={!messages.length && !busy}>
          Limpiar chat
        </button>
        <p className="foot">Empliados LLM Server · chat de prueba</p>
      </aside>

      <main className="stage">
        {!messages.length && (
          <div className="hero">
            <h2>SOL Lab</h2>
            <p>
              Empliados LLM Server · modelo <strong>{model}</strong>
            </p>
            <div className="suggestions">
              {[
                "Explicá en 3 bullets qué es Ollama.",
                "Escribí un saludo breve para un demo de logística.",
                "2 + 2 = ?",
              ].map((s) => (
                <button key={s} type="button" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="thread">
          {messages.map((m) => (
            <article key={m.id} className={`bubble ${m.role}`}>
              <header>{m.role === "user" ? "Vos" : "SOL"}</header>
              <div className="body">{m.content || (busy ? "…" : "")}</div>
              {m.meta && <footer>{m.meta}</footer>}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={health?.online ? "Escribí un prompt…" : "Servidor offline — igual podés redactar"}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="actions">
            {busy ? (
              <button type="button" className="danger" onClick={() => abortRef.current?.abort()}>
                Detener
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}>
                Enviar
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
