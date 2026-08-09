"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { Check, MessageCircle, RefreshCw, TriangleAlert } from "lucide-react";
import {
  consultarChoferIncidencia,
  decidirIncidencia,
  listChoferes,
  listIncidencias,
  resumenIncidencias,
  type IncidenciaCaso,
  type ResumenIncidencias,
} from "@/lib/api";
import type { Chofer } from "@/lib/parametros-types";
import { browsableMediaUrl } from "@/lib/media-url";
import { Card, CritBadge, KpiCard, Pill } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type Filtro = "abiertas" | "nueva" | "en_gestion" | "esperando_causa" | "resuelta" | "todos";

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

export function IncidenciasPanel() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<IncidenciaCaso[]>([]);
  const [resumen, setResumen] = useState<ResumenIncidencias | null>(null);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<{ src: string; title: string } | null>(null);
  const [consultaTel, setConsultaTel] = useState("");
  const [consultaTipo, setConsultaTipo] = useState("parada_no_prevista");
  const [consultando, setConsultando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const estadoApi =
        filtro === "abiertas" || filtro === "todos" ? undefined : filtro;
      const [list, sum, ch] = await Promise.all([
        listIncidencias({ limit: 100, estado: estadoApi }),
        resumenIncidencias(),
        listChoferes().catch(() => [] as Chofer[]),
      ]);
      const filtered =
        filtro === "abiertas"
          ? list.filter((r) =>
              ["nueva", "en_gestion", "esperando_causa"].includes(r.estado),
            )
          : list;
      setRows(filtered);
      setResumen(sum);
      setChoferes(ch);
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
    if (consultaTel || !choferes[0]?.telefono) return;
    setConsultaTel(choferes[0].telefono.replace(/\D/g, ""));
  }, [choferes, consultaTel]);

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
      setError("Elegí un chofer o ingresá un teléfono válido");
      return;
    }
    const ch = choferes.find((c) => c.telefono?.replace(/\D/g, "") === tel);
    const ok = await confirm({
      title: "Consultar chofer",
      message:
        `Se va a escribir por WhatsApp a ${ch?.nombre || tel} preguntando la causa del evento.\n` +
        `Queda una incidencia en “Esperando causa”.`,
      confirmLabel: "Enviar WhatsApp",
    });
    if (!ok) return;
    setConsultando(true);
    setError(null);
    try {
      await consultarChoferIncidencia({
        telefono: tel,
        tipo: consultaTipo,
        nombre: ch?.nombre,
        nota: "Consulta proactiva desde panel Incidencias",
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
              Flujo principal: preguntar por qué está parado
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              El agente inicia la incidencia: escribe al chofer por WhatsApp y pregunta la causa de la
              parada
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-[var(--text-dim)]">
            Chofer
            <select
              value={consultaTel}
              onChange={(e) => setConsultaTel(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">Seleccionar…</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.telefono?.replace(/\D/g, "") || ""}>
                  {c.nombre} · {c.telefono}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-xs text-[var(--text-dim)]">
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
          <button
            type="button"
            disabled={consultando}
            onClick={() => void consultarChofer()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
          >
            <MessageCircle size={16} />
            {consultando ? "Enviando…" : "¿Por qué estás parado?"}
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Incidencias en ruta</h3>
            <p className="text-xs text-[var(--text-faint)]">
              Principal: agente pregunta al chofer · también puede reportar solo · demoras de Destinos
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
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    className="border-b border-[var(--border)]/60 hover:bg-white/[0.03]"
                  >
                    <td className="py-3 pr-3 font-medium text-white">
                      <div>{codigo(g)}</div>
                      {g.viaje !== "—" && (
                        <div className="text-[10px] font-normal text-[var(--text-faint)]">
                          {g.viaje}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">
                      <div>{g.chofer}</div>
                      <div className="text-xs text-[var(--text-faint)]">{g.telefono || ""}</div>
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">{g.tipoLabel}</td>
                    <td className="max-w-[220px] py-3 pr-3 text-[var(--text-dim)]">
                      <div className="truncate">{g.causa || g.resumen || "—"}</div>
                      {g.imagenUrl && (
                        <button
                          type="button"
                          onClick={() => {
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
                        <CritBadge level={g.criticidadLabel as "Alta" | "Media" | "Baja"} />
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
                        g.sla === "Por vencer" ? "text-[var(--amber)]" : "text-[var(--text-dim)]",
                      )}
                    >
                      {g.sla}
                    </td>
                    <td className="py-3">
                      {g.estado === "resuelta" || g.estado === "esperando_causa" ? (
                        <span className="text-xs text-[var(--text-faint)]">
                          {g.estado === "esperando_causa" ? "Esperando WA…" : "—"}
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
                ))}
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
    </div>
  );
}
