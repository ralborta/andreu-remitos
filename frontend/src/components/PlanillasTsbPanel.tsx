"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Sheet } from "lucide-react";
import { getPlanillaTsb, planillaTsbExportUrl } from "@/lib/api";
import type { PlanillaFormato, PlanillaTsbResponse, TipoViajeTsb } from "@/lib/planilla-types";
import { TIPOS_VIAJE_TSB } from "@/lib/planilla-types";
import { Card, Pill } from "./ui";
import { PlanillaGrid } from "./PlanillaGrid";

export function PlanillasTsbPanel() {
  const [vista, setVista] = useState<PlanillaFormato>("delfos");
  const [tipoViaje, setTipoViaje] = useState<TipoViajeTsb>("ARENA");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<PlanillaTsbResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlanillaTsb({
      formato: vista,
      tipoViaje,
      desde: desde || undefined,
      hasta: hasta || undefined,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [vista, tipoViaje, desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVista("delfos")}
            className={
              vista === "delfos"
                ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50"
                : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)] hover:bg-white/10"
            }
          >
            Planilla Delfos (25 cols)
          </button>
          <button
            type="button"
            onClick={() => setVista("proforma")}
            className={
              vista === "proforma"
                ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50"
                : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)] hover:bg-white/10"
            }
          >
            Proforma QuadMy (11 cols)
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
            Tipo de viaje
            <select
              value={tipoViaje}
              onChange={(e) => setTipoViaje(e.target.value as TipoViajeTsb)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--violet)]/40"
            >
              {TIPOS_VIAJE_TSB.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--violet)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-dim)]">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--violet)]/40"
            />
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={planillaTsbExportUrl({ tipoViaje, desde, hasta, formato: "delfos" })}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-[var(--border)] hover:bg-white/15"
            >
              <Download size={16} />
              Excel Delfos
            </a>
            <a
              href={planillaTsbExportUrl({ tipoViaje, desde, hasta, formato: "proforma" })}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--violet)]/25 px-3 py-2 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50 hover:bg-[var(--violet)]/35"
            >
              <Download size={16} />
              Excel Proforma
            </a>
          </div>
        </div>
        {data && (
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            {data.meta.remitos} remitos → {data.meta.filas} filas · {data.columnas.length} columnas
            {vista === "delfos" ? " (A–Y, toneladas en Cantidad fila Orden 1)" : " (QuadMy TMS)"}
          </p>
        )}
      </Card>

      {error && (
        <p className="rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/10 px-4 py-3 text-sm text-[var(--red)]">
          {error}
        </p>
      )}

      {loading && !data ? (
        <Card className="flex items-center justify-center gap-2 p-12 text-[var(--text-dim)]">
          <Sheet size={20} className="animate-pulse" />
          Generando planilla…
        </Card>
      ) : data ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Pill color="#38bdf8">TSB</Pill>
            <span className="text-sm text-[var(--text-dim)]">
              {vista === "delfos" ? "Vista Delfos — headers iguales al Excel Arianna" : "Vista Proforma — import QuadMy"}
            </span>
            <span className="text-xs text-[var(--violet-2)]">← deslizá horizontal para ver todas las columnas</span>
          </div>
          <PlanillaGrid columnas={data.columnas} filas={data.filas} />
        </div>
      ) : null}
    </div>
  );
}
