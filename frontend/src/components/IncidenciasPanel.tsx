"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
} from "react";
import clsx from "clsx";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import {
  autocompleteDestino,
  consultarChoferIncidencia,
  decidirIncidencia,
  geocodeDestino,
  listDestinos,
  listIncidencias,
  listViajesFlotaChoferes,
  resumenIncidencias,
  type AutocompleteSuggestion,
  type DestinoValidacion,
  type GeocodeResult,
  type IncidenciaCaso,
  type ResumenIncidencias,
  type ViajesChoferFlota,
} from "@/lib/api";
import {
  DEFAULT_INCIDENCIAS_CONFIG,
  loadIncidenciasConfig,
  type IncidenciasModuloConfig,
} from "@/lib/incidencias-config";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, CritBadge, KpiCard, Pill } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";
import { IncidenciasConfigModal } from "./IncidenciasConfigModal";

type Filtro = "abiertas" | "nueva" | "en_gestion" | "esperando_causa" | "resuelta" | "todos";

type ChoferOpt = { tel: string; label: string; fuente: "viajes" | "destinos" };

/** Puntos de demo (GBA / CABA) para simular “GPS detectó parada”. */
const DEMO_PINS: { id: string; label: string; query: string }[] = [
  { id: "pana", label: "Panamericana km 35", query: "Autopista Panamericana km 35, Buenos Aires" },
  { id: "ezeiza", label: "Acceso Ezeiza", query: "Autopista Riccheri, Ezeiza, Buenos Aires" },
  { id: "puerto", label: "Puerto Madero", query: "Puerto Madero, CABA" },
  { id: "pacheco", label: "Pacheco", query: "General Pacheco, Buenos Aires" },
  { id: "lujan", label: "Acceso Luján", query: "Acceso Oeste Luján, Buenos Aires" },
];

const BTN_TOMAR: CSSProperties = { background: "#0284c7", color: "#fff" };
const BTN_OK: CSSProperties = { background: "#16a34a", color: "#fff" };
const btnClass =
  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50";

function estadoColor(estado: string) {
  if (estado === "resuelta") return "#22c55e";
  if (estado === "en_gestion") return "#38bdf8";
  if (estado === "esperando_causa") return "#f59e0b";
  if (estado === "nueva") return "#a855f7";
  return "#a79fc9";
}

function origenLabel(o: string) {
  if (o === "agente") return "Agente";
  if (o === "destinos_demora") return "Destinos";
  return "Chofer";
}

function codigo(g: IncidenciaCaso) {
  return g.codigo || g.id;
}

function mapsEmbedUrl(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

function mapsOpenUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function IncidenciasPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<IncidenciaCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenIncidencias | null>(null);
  const [choferesViajes, setChoferesViajes] = useState<ViajesChoferFlota[]>([]);
  const [destinos, setDestinos] = useState<DestinoValidacion[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ src: string; title: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [consultaTel, setConsultaTel] = useState("");
  const [consultaTipo, setConsultaTipo] = useState("parada_no_prevista");
  const [consultando, setConsultando] = useState(false);
  const [ubicQuery, setUbicQuery] = useState("");
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [ubic, setUbic] = useState<GeocodeResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pinActivo, setPinActivo] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [cfg, setCfg] = useState<IncidenciasModuloConfig>(DEFAULT_INCIDENCIAS_CONFIG);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCfg(loadIncidenciasConfig());
  }, []);

  const choferOpts = useMemo(() => {
    const map = new Map<string, ChoferOpt>();
    // Principal: flota Gestión de Viajes (Raúl, Carlos, …)
    for (const c of choferesViajes) {
      if (c.activo === false) continue;
      const tel = c.telefono?.replace(/\D/g, "") || "";
      if (tel.length < 8) continue;
      map.set(tel, {
        tel,
        label: `${c.nombre} · ${tel} (Viajes)`,
        fuente: "viajes",
      });
    }
    // Complemento: teléfonos usados como chofer en Destinos
    for (const d of destinos) {
      const tel = d.telefonoChofer?.replace(/\D/g, "") || "";
      if (tel.length < 8 || map.has(tel)) continue;
      map.set(tel, {
        tel,
        label: `Chofer Destinos · ${tel}`,
        fuente: "destinos",
      });
    }
    return [...map.values()].sort((a, b) => {
      if (a.fuente !== b.fuente) return a.fuente === "viajes" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [choferesViajes, destinos]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const estadoApi =
        filtro === "abiertas" || filtro === "todos" ? undefined : filtro;
      const [list, sum, chViajes, dest] = await Promise.all([
        listIncidencias({ limit: 100, estado: estadoApi }),
        resumenIncidencias(),
        listViajesFlotaChoferes().catch(() => [] as ViajesChoferFlota[]),
        listDestinos({ limit: 40 }).catch(() => [] as DestinoValidacion[]),
      ]);
      const filtered =
        filtro === "abiertas"
          ? list.filter((r) =>
              ["nueva", "en_gestion", "esperando_causa"].includes(r.estado),
            )
          : list;
      setRows(filtered);
      setResumen(sum);
      setChoferesViajes(chViajes);
      setDestinos(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar incidencias");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (consultaTel || choferOpts.length === 0) return;
    setConsultaTel(choferOpts[0].tel);
  }, [choferOpts, consultaTel]);

  useEffect(() => {
    if (ubicQuery.trim().length < 3 || placeId) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await autocompleteDestino(ubicQuery);
        setSuggestions(items);
        setSuggestionsOpen(items.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ubicQuery, placeId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const kpis = useMemo(
    () => [
      { label: "Abiertas", value: String(resumen?.abiertas ?? "—"), hint: "activas" },
      { label: "Nuevas", value: String(resumen?.nueva ?? "—"), hint: "recién abiertas" },
      {
        label: "Esperando causa",
        value: String(resumen?.esperando_causa ?? "—"),
        hint: "consulta al chofer",
      },
      { label: "Criticidad alta", value: String(resumen?.alta ?? "—"), hint: "prioridad" },
    ],
    [resumen],
  );

  async function resolverUbicacion(query: string, opts?: { placeId?: string; pinId?: string }) {
    setGeoLoading(true);
    setError(null);
    try {
      const geo = await geocodeDestino({
        query,
        mode: "direccion",
        placeId: opts?.placeId,
      });
      setUbic(geo);
      setUbicQuery(geo.formattedAddress);
      setPlaceId(geo.placeId || opts?.placeId);
      setPinActivo(opts?.pinId ?? null);
      setSuggestionsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude ubicar en Google Maps");
    } finally {
      setGeoLoading(false);
    }
  }

  async function decidir(g: IncidenciaCaso, estado: "en_gestion" | "resuelta") {
    const labels = { en_gestion: "Tomar en gestión", resuelta: "Marcar resuelta" };
    const ok = await confirm({
      title: labels[estado],
      message: `${codigo(g)} · ${g.tipoLabel} · ${g.chofer}\n${g.causa || g.resumen || ""}`,
      confirmLabel: labels[estado],
    });
    if (!ok) return;
    setBusyId(g.id);
    try {
      await decidirIncidencia(g.id, { estado });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude actualizar");
    } finally {
      setBusyId(null);
    }
  }

  async function consultarChofer() {
    const tel = consultaTel.replace(/\D/g, "");
    if (tel.length < 8) {
      setError("Elegí un chofer de la flota de Viajes (ej. Raúl 5491133788190)");
      return;
    }
    if (!ubic) {
      setError("Elegí una ubicación en el mapa (buscá o usá un pin de demo)");
      return;
    }
    const opt = choferOpts.find((c) => c.tel === tel);
    const ok = await confirm({
      title: "¿Por qué estás parado?",
      message:
        `Se simula detección GPS en:\n${ubic.formattedAddress}\n\n` +
        `WhatsApp a ${opt?.label || tel}\n` +
        `El agente pregunta la causa de la parada.`,
      confirmLabel: "Enviar WhatsApp",
    });
    if (!ok) return;
    setConsultando(true);
    setError(null);
    try {
      await consultarChoferIncidencia({
        telefono: tel,
        tipo: consultaTipo,
        nombre: opt?.label.split(" · ")[0],
        lat: ubic.lat,
        lng: ubic.lng,
        direccion: ubic.formattedAddress,
        nota: `Parada detectada (demo Maps) · ${ubic.formattedAddress}`,
      });
      setFiltro("esperando_causa");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude consultar al chofer");
    } finally {
      setConsultando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <TriangleAlert size={16} className="text-amber-300" />
              Flujo principal: parada en mapa → preguntar al chofer
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              Elegí punto + chofer de Viajes → WhatsApp “¿por qué estás parado?”. Si no responde: a los{" "}
              {cfg.recordatorioMin} min repregunta y a los {cfg.cierreMin} min cierra sola
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            title="Configuración de fechas y WhatsApp"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-dim)] hover:bg-white/10 hover:text-white"
          >
            <Settings2 size={14} />
            Config
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <div ref={inputWrapRef} className="relative">
              <label className="mb-1 block text-xs text-[var(--text-dim)]">
                Ubicación de la parada (Google Maps)
              </label>
              <div className="flex gap-2">
                <input
                  value={ubicQuery}
                  onChange={(e) => {
                    setUbicQuery(e.target.value);
                    setPlaceId(undefined);
                    setPinActivo(null);
                  }}
                  onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                  placeholder="Ej: Panamericana km 35, Pacheco…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
                />
                <button
                  type="button"
                  disabled={geoLoading || ubicQuery.trim().length < 3}
                  onClick={() => void resolverUbicacion(ubicQuery, { placeId })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
                >
                  {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                  Ubicar
                </button>
              </div>
              {suggestionsOpen && suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel-2)] py-1 shadow-xl">
                  {suggestions.map((s) => (
                    <li key={s.placeId}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                        onClick={() =>
                          void resolverUbicacion(s.description, { placeId: s.placeId })
                        }
                      >
                        <span className="font-medium">{s.mainText}</span>
                        {s.secondaryText && (
                          <span className="mt-0.5 block text-xs text-[var(--text-faint)]">
                            {s.secondaryText}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-[11px] text-[var(--text-faint)]">
                Pins de demo (simulá detección GPS)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_PINS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void resolverUbicacion(p.query, { pinId: p.id })}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      pinActivo === p.id
                        ? "bg-[var(--violet)] text-white"
                        : "bg-white/5 text-[var(--text-dim)] hover:bg-white/10",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
                Chofer (flota Viajes)
                <select
                  value={consultaTel}
                  onChange={(e) => setConsultaTel(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Seleccionar…</option>
                  {choferOpts.map((c) => (
                    <option key={c.tel} value={c.tel}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
                Tipo sugerido
                <select
                  value={consultaTipo}
                  onChange={(e) => setConsultaTipo(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="parada_no_prevista">Parada no prevista</option>
                  <option value="desvio_ruta">Desvío de ruta</option>
                  <option value="demora">Demora</option>
                  <option value="anomalia">Anomalía</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              disabled={consultando || !ubic || !consultaTel}
              onClick={() => void consultarChofer()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--violet)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
            >
              <MessageCircle size={16} />
              {consultando ? "Enviando WhatsApp…" : "¿Por qué estás parado?"}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
            {ubic ? (
              <>
                <iframe
                  title="Mapa parada"
                  src={mapsEmbedUrl(ubic.lat, ubic.lng)}
                  className="h-56 w-full border-0 lg:h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="flex items-start justify-between gap-2 border-t border-[var(--border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{ubic.formattedAddress}</p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {ubic.lat.toFixed(5)}, {ubic.lng.toFixed(5)}
                    </p>
                  </div>
                  <a
                    href={mapsOpenUrl(ubic.lat, ubic.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--violet-2)] hover:underline"
                  >
                    Abrir
                    <ExternalLink size={11} />
                  </a>
                </div>
              </>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 px-4 text-center lg:h-64">
                <MapPin size={28} className="text-[var(--text-faint)]" />
                <p className="text-sm text-[var(--text-dim)]">Sin ubicación todavía</p>
                <p className="text-xs text-[var(--text-faint)]">
                  Buscá una dirección o tocá un pin de demo
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Incidencias en ruta</h3>
            <p className="text-xs text-[var(--text-faint)]">
              Clic en un caso para ver el resumen · agente pregunta al chofer · demoras de Destinos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["abiertas", "Abiertas"],
                ["nueva", "Nuevas"],
                ["esperando_causa", "Esperando causa"],
                ["en_gestion", "En gestión"],
                ["resuelta", "Resueltas"],
                ["todos", "Todos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs",
                  filtro === id
                    ? "bg-[var(--violet)] text-white"
                    : "bg-white/5 text-[var(--text-dim)] hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-[var(--text-dim)] hover:bg-white/10"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              title="Configuración"
              className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-[var(--text-dim)] hover:bg-white/10 hover:text-white"
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">
            Todavía no hay incidencias. Usá arriba “Preguntar por WhatsApp” (flujo principal), o el
            chofer puede avisar solo (“tuve un pinchazo”).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-[var(--text-faint)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Incidencia</th>
                  <th className="py-2 pr-3 font-medium">Chofer</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Causa</th>
                  <th className="py-2 pr-3 font-medium">Origen</th>
                  <th className="py-2 pr-3 font-medium">Criticidad</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">SLA</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const open = expandedId === g.id;
                  const causaTxt = g.causa || g.resumen || "—";
                  const lastHist = (g.historial || []).slice(-3);
                  return (
                    <Fragment key={g.id}>
                      <tr
                        onClick={() =>
                          setExpandedId((id) => (id === g.id ? null : g.id))
                        }
                        className={clsx(
                          "cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/[0.03]",
                          open && "bg-white/[0.04]",
                        )}
                      >
                        <td className="py-3 pr-3 font-medium text-white">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown
                              size={14}
                              className={clsx(
                                "shrink-0 text-[var(--text-faint)] transition-transform",
                                open ? "rotate-180" : "",
                              )}
                            />
                            <div>
                              <div>{codigo(g)}</div>
                              {g.viaje !== "—" && (
                                <div className="text-[10px] font-normal text-[var(--text-faint)]">
                                  {g.viaje}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-dim)]">
                          <div>{g.chofer}</div>
                          <div className="text-xs text-[var(--text-faint)]">
                            {g.telefono || ""}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-dim)]">
                          {g.tipoLabel}
                        </td>
                        <td className="max-w-[220px] py-3 pr-3 text-[var(--text-dim)]">
                          <div className="truncate">{causaTxt}</div>
                          {g.imagenUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const src = browsableMediaUrl(g.imagenUrl);
                                if (src) setFoto({ src, title: codigo(g) });
                              }}
                              className="mt-1 text-xs text-[var(--violet-2)] hover:underline"
                            >
                              Ver foto
                            </button>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <Pill color="#a78bfa">{origenLabel(g.origen)}</Pill>
                        </td>
                        <td className="py-3 pr-3">
                          {g.criticidadLabel !== "—" ? (
                            <CritBadge
                              level={g.criticidadLabel as "Alta" | "Media" | "Baja"}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <Pill color={estadoColor(g.estado)}>{g.estadoLabel}</Pill>
                        </td>
                        <td
                          className={clsx(
                            "py-3 pr-3 text-xs",
                            g.sla === "Por vencer"
                              ? "text-[var(--amber)]"
                              : "text-[var(--text-dim)]",
                          )}
                        >
                          {g.sla}
                        </td>
                        <td
                          className="py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {g.estado === "resuelta" ||
                          g.estado === "esperando_causa" ? (
                            <span className="text-xs text-[var(--text-faint)]">
                              {g.estado === "esperando_causa"
                                ? "Esperando WA…"
                                : "—"}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {g.estado === "nueva" && (
                                <button
                                  type="button"
                                  disabled={busyId === g.id}
                                  onClick={() => void decidir(g, "en_gestion")}
                                  className={btnClass}
                                  style={BTN_TOMAR}
                                >
                                  Tomar
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyId === g.id}
                                onClick={() => void decidir(g, "resuelta")}
                                className={btnClass}
                                style={BTN_OK}
                              >
                                <Check size={14} />
                                OK
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-[var(--border)]/60 bg-[var(--bg-2)]/80">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Resumen
                                </p>
                                <p className="mt-0.5 text-sm text-white">
                                  {g.resumen || causaTxt}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Causa
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                  {g.causa || "Sin causa aún"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Ubicación
                                </p>
                                {g.lat != null && g.lng != null ? (
                                  <a
                                    href={mapsOpenUrl(g.lat, g.lng)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-0.5 inline-flex items-center gap-1 text-sm text-[var(--violet-2)] hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MapPin size={12} />
                                    {g.lat.toFixed(4)}, {g.lng.toFixed(4)}
                                  </a>
                                ) : (
                                  <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                    Sin coords
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                                  Últimos eventos
                                </p>
                                {lastHist.length > 0 ? (
                                  <ul className="mt-0.5 space-y-0.5 text-xs text-[var(--text-dim)]">
                                    {lastHist.map((h, i) => (
                                      <li key={`${g.id}-h-${i}`} className="truncate">
                                        · {h}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-0.5 text-sm text-[var(--text-dim)]">
                                    —
                                  </p>
                                )}
                              </div>
                            </div>
                            {g.notaInterna && (
                              <p className="mt-2 text-xs text-[var(--text-faint)]">
                                Nota: {g.notaInterna}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Foto incidencia"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />

      <IncidenciasConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={(next) => setCfg(next)}
      />
    </div>
  );
}
