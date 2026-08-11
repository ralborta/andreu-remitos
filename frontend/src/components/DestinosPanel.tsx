"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Truck,
} from "lucide-react";
import {
  autocompleteDestino,
  getDestino,
  listDestinos,
  validarDestino,
  type DestinoValidacion,
} from "@/lib/api";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function estadoColor(estado: string) {
  const map: Record<string, string> = {
    esperando_cliente: "#f59e0b",
    esperando_eta_chofer: "#38bdf8",
    en_ruta: "#22c55e",
    confirmado: "#22c55e",
    cancelado: "#a79fc9",
  };
  return map[estado] ?? "#a79fc9";
}

function estadoLabel(estado: string) {
  const map: Record<string, string> = {
    esperando_cliente: "Esperando cliente",
    esperando_eta_chofer: "Esperando ETA chofer",
    en_ruta: "En ruta",
    confirmado: "Confirmado",
    cancelado: "Cancelado",
  };
  return map[estado] ?? estado;
}

/** Resumen legible a partir del caso (no el log técnico completo). */
function buildResumenDestino(d: DestinoValidacion): string[] {
  const hist = (d.historial || []).join(" · ").toLowerCase();
  const bullets: string[] = [];

  bullets.push(`Estado: ${estadoLabel(d.estado)}`);

  if (d.formattedAddress) {
    bullets.push(
      d.partial
        ? `Dirección ubicada (parcial): ${d.formattedAddress}`
        : `Dirección: ${d.formattedAddress}`,
    );
  }

  if (d.correccion) {
    bullets.push(`Cliente corrigió la dirección a: ${d.correccion}`);
  } else if (/rechaz|no quiere|sin dirección|"no"/.test(hist)) {
    bullets.push("El cliente rechazó o cuestionó la dirección en algún momento");
  }

  if (d.whatsappSent || /whatsapp enviado al cliente/.test(hist)) {
    bullets.push(
      d.telefonoCliente
        ? `Se contactó al cliente por WhatsApp (…${d.telefonoCliente.slice(-4)})`
        : "Se contactó al cliente por WhatsApp",
    );
  }

  if (d.ultimaRespuestaCliente) {
    bullets.push(`Última respuesta del cliente: “${d.ultimaRespuestaCliente}”`);
  } else if (/cliente:\s*sí|confirmado/.test(hist)) {
    bullets.push("El cliente confirmó el destino");
  }

  if (
    d.telefonoChofer &&
    (d.estado === "confirmado" ||
      d.estado === "en_ruta" ||
      d.estado === "esperando_eta_chofer" ||
      /whatsapp enviado al chofer/.test(hist))
  ) {
    bullets.push(`Se avisó al chofer (…${d.telefonoChofer.slice(-4)})`);
  }

  if (d.etaTexto) {
    bullets.push(`Estimado de llegada: ${d.etaTexto}`);
  } else if (d.estado === "esperando_eta_chofer") {
    bullets.push("Pendiente: el chofer debe indicar en cuánto llega");
  } else if (d.estado === "esperando_cliente") {
    bullets.push("Pendiente: esperando confirmación del cliente");
  }

  if (/ubicación gps|envió ubicación/.test(hist)) {
    bullets.push("El cliente compartió su ubicación por GPS");
  }

  return bullets.slice(0, 6);
}

type ColaRow = {
  id: string;
  cliente: string;
  direccion: string;
  correccion: string;
  chofer: string;
  estado: string;
  _raw: DestinoValidacion;
};

export function DestinosPanel() {
  const [modo, setModo] = useState<"direccion" | "coordenadas">("direccion");
  const [input, setInput] = useState("");
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [cliente, setCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [telefonoChofer, setTelefonoChofer] = useState("");
  const [activo, setActivo] = useState<DestinoValidacion | null>(null);
  const [cola, setCola] = useState<DestinoValidacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    { placeId: string; description: string; mainText: string; secondaryText: string }[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);
  const [verHistorialTecnico, setVerHistorialTecnico] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputWrapRef = useRef<HTMLLabelElement>(null);
  const activoIdRef = useRef<string | null>(null);

  useEffect(() => {
    activoIdRef.current = activo?.id ?? null;
    setVerHistorialTecnico(false);
  }, [activo?.id]);

  const refrescar = useCallback(async () => {
    try {
      const rows = await listDestinos({ limit: 30 });
      setCola(rows);
      setUltimaSync(new Date());

      const id = activoIdRef.current;
      if (id) {
        const fresh = await getDestino(id);
        setActivo(fresh);
      } else if (
        rows.length > 0 &&
        ["esperando_cliente", "esperando_eta_chofer"].includes(rows[0].estado)
      ) {
        setActivo(rows[0]);
        activoIdRef.current = rows[0].id;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const timer = setInterval(() => void refrescar(), 3000);
    return () => clearInterval(timer);
  }, [refrescar]);

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

  async function enviarValidacion(query: string, opts?: { placeId?: string }) {
    if (!telefonoCliente.trim()) {
      setError("Ingresá el WhatsApp del cliente (ej: 5492616168767)");
      return;
    }
    if (!telefonoChofer.trim()) {
      setError("Ingresá el WhatsApp del chofer — al confirmar se le envía el destino");
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
        telefonoChofer: telefonoChofer.trim(),
      });
      setActivo(out);
      activoIdRef.current = out.id;
      await refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar validación");
    } finally {
      setLoading(false);
    }
  }

  const colaRows: ColaRow[] = cola.map((r) => ({
    id: r.id,
    cliente: r.cliente ?? r.telefonoCliente,
    direccion: r.formattedAddress,
    correccion: r.correccion ? "Sí" : "—",
    chofer: r.telefonoChofer ? `…${r.telefonoChofer.slice(-4)}` : "—",
    estado: r.estado,
    _raw: r,
  }));

  const cols: Column<ColaRow>[] = [
    {
      key: "id",
      header: "Pedido",
      render: (r) => (
        <button
          type="button"
          onClick={() => {
            setActivo(r._raw);
            activoIdRef.current = r.id;
          }}
          className={`font-medium ${activo?.id === r.id ? "text-[var(--violet-2)]" : "text-white hover:underline"}`}
        >
          {r.id}
        </button>
      ),
    },
    { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
    { key: "direccion", header: "Dirección", className: "max-w-[200px] truncate text-[var(--text-dim)]" },
    { key: "correccion", header: "Corregido", className: "text-[var(--text-dim)]" },
    { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]" },
    {
      key: "estado",
      header: "Estado",
      render: (r) => <Pill color={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Pill>,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Validar destino — WhatsApp real</SectionTitle>
          <button
            type="button"
            onClick={() => void refrescar()}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-white"
          >
            <RefreshCw size={12} />
            {ultimaSync ? `Sync ${ultimaSync.toLocaleTimeString("es-AR")}` : "Sync"}
          </button>
        </div>

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
            Coordenadas
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="relative block sm:col-span-2" ref={inputWrapRef}>
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">
              {modo === "direccion" ? "Dirección" : "Latitud, longitud"}
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder={modo === "direccion" ? "Ej: Echeverría 850, Pacheco" : "Ej: -34.45, -58.64"}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setPlaceId(undefined);
              }}
            />
            {modo === "direccion" && suggestionsOpen && suggestions.length > 0 && (
              <ul className="surface-dark absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--border)] bg-[#1a1528] shadow-xl">
                {suggestions.map((s) => (
                  <li key={s.placeId}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                      onClick={() => {
                        setInput(s.description);
                        setPlaceId(s.placeId);
                        setSuggestionsOpen(false);
                        void enviarValidacion(s.description, { placeId: s.placeId });
                      }}
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
            <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-faint)]">Cliente</span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
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
              WhatsApp chofer *
            </span>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="54911…"
              value={telefonoChofer}
              onChange={(e) => setTelefonoChofer(e.target.value)}
            />
            <span className="mt-1 block text-[10px] text-[var(--text-faint)]">
              Obligatorio: cuando el cliente confirma, se le envía el destino al chofer
            </span>
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

        <button
          type="button"
          onClick={() => input.trim() && void enviarValidacion(input.trim())}
          disabled={!input.trim() || loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
          Geocodificar y enviar WhatsApp
        </button>
      </Card>

      {activo && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 ring-1 ring-[var(--violet)]/30">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{activo.id}</span>
              <Pill color={estadoColor(activo.estado)}>{estadoLabel(activo.estado)}</Pill>
              {activo.correccion && <Pill color="#fb923c">Corregido</Pill>}
            </div>
            <p className="text-sm text-white">{activo.formattedAddress || "Sin dirección"}</p>
            {typeof activo.lat === "number" && typeof activo.lng === "number" ? (
              <>
                <p className="mt-1 text-xs tabular-nums text-[var(--text-dim)]">
                  {activo.lat.toFixed(5)}, {activo.lng.toFixed(5)}
                </p>
                <a
                  href={mapsUrl(activo.lat, activo.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-[var(--violet-2)] hover:underline"
                >
                  Abrir en Google Maps
                </a>
              </>
            ) : (
              <p className="mt-1 text-xs text-[var(--text-faint)]">Sin coordenadas</p>
            )}
            {activo.ultimaRespuestaCliente && (
              <div className="mt-3 rounded-lg bg-[#25d366]/10 px-3 py-2 text-xs text-[#25d366]">
                <span className="font-semibold">Última respuesta cliente:</span>{" "}
                <span className="text-white/90">{activo.ultimaRespuestaCliente}</span>
              </div>
            )}
            <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                Resumen
              </p>
              <ul className="space-y-1.5 text-sm text-[var(--text-dim)]">
                {buildResumenDestino(activo).map((line, i) => (
                  <li key={`${activo.id}-r-${i}`} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--violet)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {activo.historial.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setVerHistorialTecnico((v) => !v)}
                    className="text-[11px] text-[var(--violet-2)] hover:underline"
                  >
                    {verHistorialTecnico
                      ? "Ocultar detalle técnico"
                      : "Ver detalle técnico"}
                  </button>
                  {verHistorialTecnico && (
                    <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-faint)]">
                      {(activo.historial || []).map((h, i) => (
                        <li key={`${h}-${i}`}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            {activo.mensajeCliente && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-[#25d366]">
                  <MessageCircle size={14} />
                  WhatsApp → {activo.telefonoCliente}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[var(--text-dim)]">{activo.mensajeCliente}</pre>
              </Card>
            )}

            {activo.estado === "esperando_cliente" && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--amber)]">
                  <Loader2 size={16} className="animate-spin" />
                  Esperando respuesta del cliente…
                </div>
                <p className="mt-2 text-xs text-[var(--text-faint)]">
                  Se actualiza solo cada 3 segundos
                </p>
              </Card>
            )}

            {activo.estado === "esperando_eta_chofer" && (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm text-sky-400">
                  <Loader2 size={16} className="animate-spin" />
                  Destino OK — esperando estimado del chofer…
                </div>
                {activo.telefonoChofer && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--violet-2)]">
                    <Truck size={14} />
                    WhatsApp al chofer …{activo.telefonoChofer.slice(-4)}
                  </div>
                )}
                <p className="mt-2 text-xs text-[var(--text-faint)]">
                  El chofer debe indicar en cuánto llega; eso se le envía al cliente
                </p>
              </Card>
            )}

            {(activo.estado === "en_ruta" || activo.estado === "confirmado") && (
              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-[#22c55e]">
                  <CheckCircle2 size={16} />
                  {activo.estado === "en_ruta" ? "En ruta — estimado enviado" : "Destino confirmado"}
                </div>
                {activo.etaTexto && (
                  <p className="text-sm text-[var(--text-dim)]">
                    ETA: <span className="text-[var(--text)]">{activo.etaTexto}</span>
                  </p>
                )}
                {activo.telefonoChofer && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--violet-2)]">
                    <Truck size={14} />
                    Chofer …{activo.telefonoChofer.slice(-4)}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      <Card>
        <SectionTitle>Cola en vivo ({colaRows.length})</SectionTitle>
        {colaRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-faint)]">
            Sin validaciones aún — enviá la primera arriba
          </p>
        ) : (
          <DataTable columns={cols} rows={colaRows} minWidth={820} />
        )}
      </Card>
    </div>
  );
}
