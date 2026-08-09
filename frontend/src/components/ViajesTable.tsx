"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { listViajes, type Viaje } from "@/lib/api";
import { TRIP_STATUS_COLOR, TRIP_STATUS_LABEL, type TripStatus } from "@/lib/data";
import { Card, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

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
  if (m) return `${m[3]}/${m[2]}`;
  return fecha;
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
  };
}

export function ViajesTable() {
  const [rows, setRows] = useState<ViajeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listViajes({ limit: 50 });
      setRows(list.map(toRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los viajes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const t = setInterval(() => void refrescar(), 20_000);
    return () => clearInterval(t);
  }, [refrescar]);

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
          style={{ color: TRIP_STATUS_COLOR[t.estado], background: `${TRIP_STATUS_COLOR[t.estado]}1a` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TRIP_STATUS_COLOR[t.estado] }} />
          {t.estadoLabel}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionTitle>Viajes registrados</SectionTitle>
          <p className="mt-1 text-xs text-[var(--text-faint)]">
            Quedan grabados al confirmar la reserva por WhatsApp (fecha, hora, chofer y unidad).
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
          <span>{rows.length} viaje{rows.length === 1 ? "" : "s"}</span>
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
      {error ? (
        <p className="mb-2 text-sm text-amber-300/90">{error}</p>
      ) : null}
      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-[var(--text-dim)]">
          Todavía no hay viajes. Cuando el agente confirme una reserva por WA, aparece acá con horario.
        </p>
      ) : (
        <DataTable columns={cols} rows={rows} minWidth={980} />
      )}
    </Card>
  );
}
