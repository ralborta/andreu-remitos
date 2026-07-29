"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { listViajes, type Viaje } from "@/lib/api";
import {
  trips,
  TRIP_STATUS_COLOR,
  TRIP_STATUS_LABEL,
  type Trip,
  type TripStatus,
} from "@/lib/data";
import { Card, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

function mapEstadoViaje(estado: Viaje["estado"]): TripStatus {
  if (estado === "entregado") return "entregado";
  if (estado === "cerrado" || estado === "cancelado") return "cerrado";
  if (estado === "en_curso") return "en_curso";
  if (estado === "asignado" || estado === "confirmado") return "en_curso";
  return "pendiente";
}

function viajeToTrip(v: Viaje): Trip {
  return {
    id: v.codigo,
    cliente: v.cliente,
    origen: v.origen,
    destino: v.destino,
    chofer: v.chofer || "—",
    patente: v.tractor || "—",
    estado: mapEstadoViaje(v.estado),
    progreso: v.estado === "entregado" || v.estado === "cerrado" ? 100 : v.estado === "asignado" ? 15 : 5,
    eta: "—",
    carga: v.carga || "—",
    km: 0,
    x: 50,
    y: 50,
  };
}

export function ViajesTable() {
  const [apiRows, setApiRows] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(false);

  const refrescar = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listViajes({ limit: 20 });
      setApiRows(list);
    } catch {
      /* demo offline — se muestran datos estáticos */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
    const t = setInterval(() => void refrescar(), 30_000);
    return () => clearInterval(t);
  }, [refrescar]);

  const rows = useMemo(() => {
    const apiTrips = apiRows.map(viajeToTrip);
    const codigosApi = new Set(apiTrips.map((t) => t.id));
    const demoRestantes = trips.filter((t) => !codigosApi.has(t.id));
    return [...apiTrips, ...demoRestantes];
  }, [apiRows]);

  const cols: Column<Trip>[] = [
    { key: "id", header: "Viaje", render: (t) => <span className="font-medium text-white">{t.id}</span> },
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
    { key: "patente", header: "Unidad", className: "text-[var(--text-dim)]" },
    {
      key: "estado",
      header: "Estado",
      render: (t) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ color: TRIP_STATUS_COLOR[t.estado], background: `${TRIP_STATUS_COLOR[t.estado]}1a` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TRIP_STATUS_COLOR[t.estado] }} />
          {TRIP_STATUS_LABEL[t.estado]}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Viajes coordinados</SectionTitle>
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
          <span>Agente activo en background</span>
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
      <DataTable columns={cols} rows={rows} minWidth={920} />
    </Card>
  );
}
