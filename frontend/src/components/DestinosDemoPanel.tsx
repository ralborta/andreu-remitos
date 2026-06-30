"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, MessageCircle, Send, Truck } from "lucide-react";
import { autocompleteDestino, geocodeDestino, type GeocodeResult } from "@/lib/api";
import { Card, Pill, SectionTitle } from "./ui";

type Estado = "borrador" | "geocodificado" | "esperando_cliente" | "confirmado" | "corregido";

interface DestinoDemo extends GeocodeResult {
  id: string;
  estado: Estado;
  correccion?: string;
  historial: string[];
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function esConfirmacion(texto: string) {
  const t = texto.trim().toLowerCase();
  return /^(si|sí|ok|dale|confirmo|correcto|esta bien|está bien|yes)$/i.test(t);
}

function estadoColor(estado: Estado) {
  const map: Record<Estado, string> = {
    borrador: "#a79fc9",
    geocodificado: "#38bdf8",
    esperando_cliente: "#f59e0b",
    confirmado: "#22c55e",
    corregido: "#fb923c",
  };
  return map[estado];
}

function estadoLabel(estado: Estado) {
  const map: Record<Estado, string> = {
    borrador: "Borrador",
    geocodificado: "Geocodificado",
    esperando_cliente: "Esperando cliente",
    confirmado: "Confirmado",
    corregido: "Corrección",
  };
  return map[estado];
}

export function DestinosDemoPanel() {
  const [modo, setModo] = useState<"direccion" | "coordenadas">("direccion");
  const [input, setInput] = useState("");
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [cliente, setCliente] = useState("Cliente demo");
  const [telefonoCliente, setTelefonoCliente] = useState("+54 9 261 555-0101");
  const [respuestaCliente, setRespuestaCliente] = useState("");
  const [destino, setDestino] = useState<DestinoDemo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRespuesta, setLoadingRespuesta] = useState(false);
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

  const mensajeAlCliente = useMemo(() => {
    if (!destino || destino.estado === "borrador") return null;
    return (
      `📍 Destino propuesto para entrega:\n\n` +
      `${destino.formattedAddress}\n` +
      `${mapsUrl(destino.lat, destino.lng)}\n\n` +
      `¿Es correcto?\nRespondé *SÍ* para confirmar, o escribí la dirección corregida / enviá ubicación por WhatsApp.`
    );
  }, [destino]);

  async function aplicarGeocode(query: string, opts?: { placeId?: string; mode?: "direccion" | "coordenadas" }) {
    const mode = opts?.mode ?? modo;
    setLoading(true);
    setError(null);
    try {
      const geo = await geocodeDestino({ query, mode, placeId: opts?.placeId ?? placeId });
      setDestino({
        ...geo,
        id: `PD-DEMO-${Date.now().toString().slice(-4)}`,
        estado: "esperando_cliente",
        historial: [`Google Geocoding: ${geo.formattedAddress}`],
      });
      setRespuestaCliente("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al geocodificar");
    } finally {
      setLoading(false);
    }
  }

  function geocodificar() {
    if (!input.trim()) return;
    void aplicarGeocode(input.trim());
  }

  function elegirSugerencia(s: { placeId: string; description: string }) {
    setInput(s.description);
    setPlaceId(s.placeId);
    setSuggestionsOpen(false);
    void aplicarGeocode(s.description, { placeId: s.placeId });
  }

  async function procesarRespuestaCliente() {
    if (!destino || !respuestaCliente.trim()) return;

    if (esConfirmacion(respuestaCliente)) {
      setDestino({
        ...destino,
        estado: "confirmado",
        historial: [...destino.historial, "Cliente: SÍ → confirmado"],
      });
      return;
    }

    setLoadingRespuesta(true);
    setError(null);
    try {
      const geo = await geocodeDestino({ query: respuestaCliente.trim(), mode: "direccion" });
      setDestino({
        ...destino,
        ...geo,
        inputRaw: respuestaCliente.trim(),
        estado: "esperando_cliente",
        correccion: respuestaCliente.trim(),
        historial: [
          ...destino.historial,
          `Cliente corrige: "${respuestaCliente.trim()}"`,
          `Re-geocode: ${geo.formattedAddress}`,
        ],
      });
      setRespuestaCliente("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al geocodificar corrección");
    } finally {
      setLoadingRespuesta(false);
    }
  }

  const mensajeChofer =
    destino?.estado === "confirmado"
      ? `✅ Destino confirmado por ${cliente}\n${destino.formattedAddress}\n${mapsUrl(destino.lat, destino.lng)}`
      : null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle>Demo funcional — validar destino</SectionTitle>
        <p className="mb-4 text-xs text-[var(--text-faint)]">
          Geocodificación real con Google Maps (Geocoding + Places). El WhatsApp al cliente/chofer se simula abajo;
          en producción lo envía BuilderBot.
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
                  ? "Ej: Miguel de Cervantes 2289, Guaymallén"
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
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              WhatsApp cliente
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
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
          {loading ? "Geocodificando…" : "Geocodificar y enviar a cliente"}
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
            {mensajeAlCliente && destino.estado !== "confirmado" && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-[#25d366]">
                  <MessageCircle size={14} />
                  WhatsApp → {telefonoCliente} (simulado)
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-dim)]">{mensajeAlCliente}</pre>

                <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                    Simular respuesta del cliente
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRespuestaCliente("Sí")}
                      className="rounded-lg bg-[#25d366]/20 px-3 py-1 text-xs text-[#25d366] ring-1 ring-[#25d366]/40"
                    >
                      Sí — confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRespuestaCliente("Miguel de Cervantes 2300, Guaymallén, Mendoza")
                      }
                      className="rounded-lg bg-[var(--amber)]/15 px-3 py-1 text-xs text-[var(--amber)] ring-1 ring-[var(--amber)]/30"
                    >
                      Corregir dirección
                    </button>
                  </div>
                  <input
                    className="mb-2 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
                    placeholder="Texto libre o nueva dirección real…"
                    value={respuestaCliente}
                    onChange={(e) => setRespuestaCliente(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void procesarRespuestaCliente()}
                    disabled={!respuestaCliente.trim() || loadingRespuesta}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                  >
                    {loadingRespuesta ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Procesar respuesta
                  </button>
                </div>
              </Card>
            )}

            {mensajeChofer && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-[var(--violet-2)]">
                  <Truck size={14} />
                  WhatsApp → chofer (simulado)
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-dim)]">{mensajeChofer}</pre>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
