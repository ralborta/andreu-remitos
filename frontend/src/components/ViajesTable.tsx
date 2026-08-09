"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Route,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  cambiarEstadoViaje,
  listViajes,
  type Viaje,
  type ViajeEstado,
} from "@/lib/api";
import { TRIP_STATUS_COLOR, TRIP_STATUS_LABEL, type TripStatus } from "@/lib/data";
import { Card, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

const RC = {
  purple: "#7c3aed",
  purpleSoft: "#f3e8ff",
  purpleText: "#6d28d9",
  border: "#e5e7eb",
  label: "#9ca3af",
  body: "#374151",
  title: "#111827",
  muted: "#6b7280",
  wa: "#16a34a",
  waBg: "#dcfce7",
  slaBg: "#f3f4f6",
  sla: "#6b7280",
} as const;

const VIAJE_ESTADO_UI: Record<string, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  asignado: "Asignado",
  en_curso: "En curso",
  entregado: "Entregado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

function mapEstadoViaje(estado: Viaje["estado"]): TripStatus {
  if (estado === "entregado") return "entregado";
  if (estado === "cerrado" || estado === "cancelado") return "cerrado";
  if (estado === "en_curso") return "en_curso";
  if (estado === "asignado" || estado === "confirmado") return "en_curso";
  return "pendiente";
}

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return "—";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return fecha;
}

function formatFechaCorta(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estadoBadgeStyle(estado: string) {
  if (estado === "entregado" || estado === "cerrado") return { bg: "#dcfce7", color: "#16a34a" };
  if (estado === "cancelado") return { bg: "#fee2e2", color: "#dc2626" };
  if (estado === "en_curso" || estado === "asignado") return { bg: "#e0f2fe", color: "#0284c7" };
  if (estado === "confirmado") return { bg: RC.purpleSoft, color: RC.purpleText };
  if (estado === "solicitado") return { bg: "#ffedd5", color: "#ea580c" };
  return { bg: RC.slaBg, color: RC.sla };
}

function LightBadge({
  bg,
  color,
  icon,
  children,
}: {
  bg: string;
  color: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      {icon}
      {children}
    </span>
  );
}

type ViajeRow = {
  id: string;
  codigo: string;
  cliente: string;
  origen: string;
  destino: string;
  carga: string;
  fecha: string;
  hora: string;
  chofer: string;
  unidad: string;
  estado: TripStatus;
  estadoLabel: string;
  _raw: Viaje;
};

function toRow(v: Viaje): ViajeRow {
  return {
    id: v.id,
    codigo: v.codigo,
    cliente: v.cliente,
    origen: v.origen,
    destino: v.destino,
    carga: v.carga || v.tipoCarga || "—",
    fecha: formatearFecha(v.fecha),
    hora: v.hora || "—",
    chofer: v.chofer || "—",
    unidad: [v.tipoUnidad, v.tractor].filter(Boolean).join(" · ") || "—",
    estado: mapEstadoViaje(v.estado),
    estadoLabel: v.estadoLabel || TRIP_STATUS_LABEL[mapEstadoViaje(v.estado)],
    _raw: v,
  };
}

function ViajeDetalleModal({
  viaje,
  onClose,
  onUpdated,
}: {
  viaje: Viaje;
  onClose: () => void;
  onUpdated: (v: Viaje) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tripTone = mapEstadoViaje(viaje.estado);
  const estadoStyle = estadoBadgeStyle(viaje.estado);
  const historial = (viaje.historial || []).slice(-10);
  const unidad = [viaje.tipoUnidad, viaje.tractor, viaje.semi].filter(Boolean).join(" · ") || "—";

  async function cambiar(estado: ViajeEstado) {
    setBusy(true);
    setError(null);
    try {
      const updated = await cambiarEstadoViaje(viaje.id, estado);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude actualizar el estado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viaje-detalle-title"
      >
        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: RC.purple }}
              >
                <Truck size={20} />
              </div>
              <div className="min-w-0">
                <h3
                  id="viaje-detalle-title"
                  className="truncate text-[1.15rem] font-bold tracking-tight sm:text-xl"
                  style={{ color: RC.title }}
                >
                  {viaje.codigo}
                </h3>
                <p className="mt-0.5 text-sm" style={{ color: RC.muted }}>
                  {viaje.origen} → {viaje.destino}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <LightBadge
              bg={estadoStyle.bg}
              color={estadoStyle.color}
              icon={
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: TRIP_STATUS_COLOR[tripTone] }}
                />
              }
            >
              {viaje.estadoLabel}
            </LightBadge>
            {(viaje.telefonoCliente || viaje.telefonoChofer) && (
              <LightBadge bg={RC.waBg} color={RC.wa} icon={<MessageCircle size={12} />}>
                WhatsApp
              </LightBadge>
            )}
            {viaje.hora && (
              <LightBadge bg={RC.slaBg} color={RC.sla} icon={<Clock size={12} />}>
                {formatearFecha(viaje.fecha)}
                {viaje.hora ? ` · ${viaje.hora}` : ""}
              </LightBadge>
            )}
          </div>

          <section
            className="mb-4 rounded-2xl border bg-white p-4"
            style={{ borderColor: RC.border }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <UserRound size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Cliente
                  </p>
                  <p className="truncate text-sm font-bold" style={{ color: RC.purpleText }}>
                    {viaje.cliente || "—"}
                  </p>
                  {viaje.telefonoCliente && (
                    <p className="text-xs" style={{ color: RC.muted }}>
                      {viaje.telefonoCliente}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Truck size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Chofer
                  </p>
                  <p className="text-sm font-medium" style={{ color: RC.body }}>
                    {viaje.chofer || "Sin asignar"}
                  </p>
                  {viaje.telefonoChofer && (
                    <p className="text-xs" style={{ color: RC.muted }}>
                      {viaje.telefonoChofer}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Route size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Ruta
                  </p>
                  <p className="text-sm" style={{ color: RC.body }}>
                    {viaje.origen || "—"} → {viaje.destino || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Package size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Carga / unidad
                  </p>
                  <p className="text-sm" style={{ color: RC.body }}>
                    {viaje.carga || viaje.tipoCarga || "—"}
                  </p>
                  <p className="text-xs" style={{ color: RC.muted }}>
                    {unidad}
                  </p>
                </div>
              </div>
            </div>

            {(viaje.notas || viaje.fecha) && (
              <div
                className="mt-4 flex items-start gap-2.5 border-t pt-3"
                style={{ borderColor: RC.border }}
              >
                <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: RC.purple }} />
                <div>
                  <p className="text-[11px] font-medium" style={{ color: RC.label }}>
                    Programación
                  </p>
                  <p className="text-sm" style={{ color: RC.body }}>
                    {formatearFecha(viaje.fecha)}
                    {viaje.hora ? ` · ${viaje.hora}` : ""}
                  </p>
                  {viaje.notas && (
                    <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: RC.muted }}>
                      {viaje.notas}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="mb-4 grid gap-3 sm:grid-cols-[1.45fr_1fr]">
            <div>
              <div
                className="mb-2 flex items-center gap-2 text-sm font-semibold"
                style={{ color: RC.title }}
              >
                <Clock size={16} style={{ color: RC.purple }} />
                Historial
              </div>
              {historial.length === 0 ? (
                <p className="text-xs" style={{ color: RC.label }}>
                  Sin eventos todavía.
                </p>
              ) : (
                <ul className="relative max-h-40 space-y-2.5 overflow-y-auto pl-1">
                  {historial.map((h, i) => (
                    <li key={`${h}-${i}`} className="relative flex gap-3 pl-4">
                      <span
                        className="absolute left-0 top-1.5 h-2 w-2 rounded-full"
                        style={{ background: RC.purple }}
                      />
                      {i < historial.length - 1 && (
                        <span
                          className="absolute left-[3px] top-3.5 h-[calc(100%+2px)] w-px"
                          style={{ background: "#e9d5ff" }}
                        />
                      )}
                      <p className="text-xs leading-relaxed" style={{ color: RC.body }}>
                        {h}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2.5">
              <div
                className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3"
                style={{ borderColor: RC.border }}
              >
                <Calendar size={15} style={{ color: RC.purple }} />
                <p className="text-xs font-medium" style={{ color: RC.body }}>
                  Creado el {formatFechaCorta(viaje.createdAt)}
                </p>
              </div>
              <div
                className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3"
                style={{ borderColor: RC.border }}
              >
                <MessageCircle size={15} style={{ color: RC.wa }} />
                <p className="text-xs font-medium" style={{ color: RC.body }}>
                  Canal WhatsApp
                </p>
              </div>
            </div>
          </section>

          {error && (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
          )}
        </div>

        {(viaje.transiciones || []).length > 0 && (
          <div
            className="flex flex-wrap gap-2.5 border-t bg-white px-5 py-4 sm:px-6"
            style={{ borderColor: RC.border }}
          >
            {viaje.transiciones.map((est) => (
              <button
                key={est}
                type="button"
                disabled={busy}
                onClick={() => void cambiar(est)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                style={{
                  background:
                    est === "cancelado"
                      ? "#dc2626"
                      : est === "entregado" || est === "cerrado"
                        ? "#16a34a"
                        : "#7c3aed",
                }}
              >
                <Check size={16} />
                {TRIP_STATUS_LABEL[mapEstadoViaje(est)] || est}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ViajesTable() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Viaje | null>(null);

  const refrescar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listViajes({ limit: 50 });
      setViajes(list);
      setDetalle((prev) => (prev ? list.find((v) => v.id === prev.id) || prev : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los viajes");
      setViajes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const t = setInterval(() => void refrescar(), 20_000);
    return () => clearInterval(t);
  }, [refrescar]);

  const rows = viajes.map(toRow);

  const cols: Column<ViajeRow>[] = [
    {
      key: "codigo",
      header: "Viaje",
      render: (t) => <span className="font-medium text-white">{t.codigo}</span>,
    },
    {
      key: "cuando",
      header: "Fecha / hora",
      render: (t) => (
        <span className="tabular text-[var(--text-dim)]">
          {t.fecha}
          {t.hora !== "—" ? ` · ${t.hora}` : ""}
        </span>
      ),
    },
    { key: "cliente", header: "Cliente", className: "text-[var(--text-dim)]" },
    {
      key: "ruta",
      header: "Ruta",
      render: (t) => (
        <span className="text-[var(--text-dim)]">
          {t.origen} → {t.destino}
        </span>
      ),
    },
    { key: "carga", header: "Carga", className: "text-[var(--text-dim)]" },
    { key: "chofer", header: "Chofer", className: "text-[var(--text-dim)]" },
    { key: "unidad", header: "Unidad", className: "text-[var(--text-dim)]" },
    {
      key: "estado",
      header: "Estado",
      render: (t) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            color: TRIP_STATUS_COLOR[t.estado],
            background: `${TRIP_STATUS_COLOR[t.estado]}1a`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: TRIP_STATUS_COLOR[t.estado] }}
          />
          {t.estadoLabel}
        </span>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <SectionTitle>Viajes registrados</SectionTitle>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Click en un viaje para ver el detalle. Quedan grabados al confirmar la reserva por
              WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <span>
              {rows.length} viaje{rows.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => void refrescar()}
              className="inline-flex items-center gap-1 hover:text-white"
              title="Actualizar"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {error ? <p className="mb-2 text-sm text-amber-300/90">{error}</p> : null}
        {!loading && rows.length === 0 && !error ? (
          <p className="text-sm text-[var(--text-dim)]">
            Todavía no hay viajes. Cuando el agente confirme una reserva por WA, aparece acá con
            horario.
          </p>
        ) : (
          <DataTable
            columns={cols}
            rows={rows}
            minWidth={980}
            onRowClick={(r) => setDetalle(r._raw)}
          />
        )}
      </Card>

      {detalle && (
        <ViajeDetalleModal
          viaje={detalle}
          onClose={() => setDetalle(null)}
          onUpdated={(v) => {
            setDetalle(v);
            setViajes((prev) => prev.map((x) => (x.id === v.id ? v : x)));
          }}
        />
      )}
    </>
  );
}
