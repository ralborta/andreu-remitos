"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, MessageCircle, Truck } from "lucide-react";
import {
  autocompleteDestino,
  getDestino,
  validarDestino,
  type DestinoValidacion,
} from "@/lib/api";
import { Card, Pill, SectionTitle } from "./ui";

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function estadoColor(estado: string) {
  const map: Record<string, string> = {
    borrador: "#a79fc9",
    geocodificado: "#38bdf8",
    esperando_cliente: "#f59e0b",
    confirmado: "#22c55e",
    corregido: "#fb923c",
  };
  return map[estado] ?? "#a79fc9";
}

function estadoLabel(estado: string) {
  const map: Record<string, string> = {
    esperando_cliente: "Esperando cliente",
    confirmado: "Confirmado",
  };
  return map[estado] ?? estado;
}

export function DestinosDemoPanel() {
  const [modo, setModo] = useState<"direccion" | "coordenadas">("direccion");
  const [input, setInput] = useState("");
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [cliente, setCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [telefonoChofer, setTelefonoChofer] = useState("");
  const [destino, setDestino] = useState<DestinoValidacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    { placeId: string; description: string; mainText: string; secondaryText: string }[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputWrapRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    if (modo !== "direccion" || input.trim().length < 3 || placeId) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await autocompleteDestino(input);
        setSuggestions(items);
        setSuggestionsOpen(items.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, modo, placeId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!destino?.id || destino.estado !== "esperando_cliente") return;
    const id = destino.id;
    const timer = setInterval(async () => {
      try {
        const fresh = await getDestino(id);
        setDestino(fresh);
      } catch {
        /* ignore poll errors */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [destino?.id, destino?.estado]);

  async function enviarValidacion(query: string, opts?: { placeId?: string }) {
    if (!telefonoCliente.trim()) {
      setError("Ingresá el WhatsApp del cliente (ej: 5492616168767)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await validarDestino({
        query,
        mode: modo,
        placeId: opts?.placeId ?? placeId,
        cliente: cliente.trim() || undefined,
        telefonoCliente: telefonoCliente.trim(),
        telefonoChofer: telefonoChofer.trim() || undefined,
      });
      setDestino(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar validación");
    } finally {
      setLoading(false);
    }
  }

  function geocodificar() {
    if (!input.trim()) return;
    void enviarValidacion(input.trim());
  }

  function elegirSugerencia(s: { placeId: string; description: string }) {
    setInput(s.description);
    setPlaceId(s.placeId);
    setSuggestionsOpen(false);
    void enviarValidacion(s.description, { placeId: s.placeId });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle>Validar destino — WhatsApp real</SectionTitle>
        <p className="mb-4 text-xs text-[var(--text-faint)]">
          Geocodifica con Google Maps y envía WhatsApp al cliente vía BuilderBot. El cliente puede
          responder <strong className="text-white/80">SÍ</strong>, corregir la dirección por texto,
          o mandar su <strong className="text-white/80">ubicación</strong> (pin 📌 — en BB:
          @Latitud / @Longitud).
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setModo("direccion");
              setPlaceId(undefined);
            }}
            className={
              modo === "direccion"
                ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm text-white ring-1 ring-[var(--violet)]/50"
                : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)]"
            }
          >
            Dirección
          </button>
          <button
            type="button"
            onClick={() => {
              setModo("coordenadas");
              setPlaceId(undefined);
              setSuggestions([]);
            }}
            className={
              modo === "coordenadas"
                ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm text-white ring-1 ring-[var(--violet)]/50"
                : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)]"
            }
          >
            Coordenadas (lat, lng)
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative block sm:col-span-2" ref={inputWrapRef}>
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              {modo === "direccion" ? "Dirección (autocompletado Google)" : "Latitud, longitud"}
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder={
                modo === "direccion"
                  ? "Ej: Miguel de Cervantes 2289, Godoy Cruz, Mendoza"
                  : "Ej: -32.8901, -68.8442"
              }
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setPlaceId(undefined);
              }}
              onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            />
            {modo === "direccion" && suggestionsOpen && suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[#1a1528] shadow-xl">
                {suggestions.map((s) => (
                  <li key={s.placeId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                      onClick={() => elegirSugerencia(s)}
                    >
                      <span className="text-white">{s.mainText}</span>
                      {s.secondaryText && (
                        <span className="ml-1 text-xs text-[var(--text-faint)]">{s.secondaryText}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              Cliente
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Nombre del cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              WhatsApp cliente *
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="5492616168767"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              WhatsApp chofer (opcional — recibe destino al confirmar)
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="5492615550000"
              value={telefonoChofer}
              onChange={(e) => setTelefonoChofer(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <button
          type="button"
          onClick={geocodificar}
          disabled={!input.trim() || loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
          {loading ? "Enviando…" : "Geocodificar y enviar WhatsApp al cliente"}
        </button>
      </Card>

      {destino && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{destino.id}</span>
              <Pill color={estadoColor(destino.estado)}>{estadoLabel(destino.estado)}</Pill>
              {destino.partial && <Pill color="#f59e0b">Aproximado</Pill>}
              {destino.correccion && <Pill color="#fb923c">Corregido</Pill>}
              {destino.whatsappSent && destino.estado === "esperando_cliente" && (
                <Pill color="#25d366">WhatsApp enviado</Pill>
              )}
            </div>
            <p className="text-sm text-white">{destino.formattedAddress}</p>
            <p className="mt-1 text-xs tabular-nums text-[var(--text-dim)]">
              {destino.lat.toFixed(5)}, {destino.lng.toFixed(5)}
            </p>
            <a
              href={mapsUrl(destino.lat, destino.lng)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-[var(--violet-2)] hover:underline"
            >
              Abrir en Google Maps
            </a>
            {destino.historial.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-[var(--border-soft)] pt-3 text-[11px] text-[var(--text-faint)]">
                {destino.historial.map((h, i) => (
                  <li key={`${h}-${i}`}>{h}</li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-4">
            {destino.mensajeCliente && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-[#25d366]">
                  <MessageCircle size={14} />
                  WhatsApp → {destino.telefonoCliente}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-dim)]">
                  {destino.mensajeCliente}
                </pre>
              </Card>
            )}

            {destino.estado === "esperando_cliente" && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--amber)]">
                  <Loader2 size={16} className="animate-spin" />
                  Esperando respuesta del cliente por WhatsApp…
                </div>
                <p className="mt-2 text-xs text-[var(--text-faint)]">
                  Puede responder SÍ, escribir otra dirección, o compartir ubicación 📌
                </p>
              </Card>
            )}

            {destino.estado === "confirmado" && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-[#22c55e]">
                  <CheckCircle2 size={16} />
                  Destino confirmado por el cliente
                </div>
                {destino.telefonoChofer ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--violet-2)]">
                    <Truck size={14} />
                    WhatsApp enviado al chofer {destino.telefonoChofer}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-faint)]">
                    Sin teléfono de chofer — no se envió aviso al conductor.
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
