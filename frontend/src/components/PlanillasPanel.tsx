"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Sheet } from "lucide-react";
import { getPlanilla, planillaExportUrl } from "@/lib/api";
import type { PlanillaFormato, PlanillaTsbResponse, TipoViajeTsb } from "@/lib/planilla-types";
import { TIPOS_VIAJE_TSB } from "@/lib/planilla-types";
import type { TenantSlug } from "@/lib/tenants";
import { getTenant } from "@/lib/tenants";
import { Card, Pill } from "./ui";
import { PlanillaGrid } from "./PlanillaGrid";

type VistaCorina = "local" | "importacion";
type HojaProforma = "diaria" | "proforma";

export function PlanillasPanel({ tenant }: { tenant: TenantSlug }) {
  const cfg = getTenant(tenant)!;
  const esCorina = tenant === "corina";
  const [vista, setVista] = useState<PlanillaFormato>("delfos");
  const [vistaCorina, setVistaCorina] = useState<VistaCorina>("local");
  const [hojaProforma, setHojaProforma] = useState<HojaProforma>("proforma");
  const [tipoViaje, setTipoViaje] = useState<TipoViajeTsb>("ARENA");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<PlanillaTsbResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatoActivo = esCorina ? vistaCorina : vista;

  const hojaActiva =
    !esCorina && vista === "proforma" && data?.hojas
      ? hojaProforma === "diaria"
        ? data.hojas.diaria
        : data.hojas.proforma
      : null;

  const columnasVista = hojaActiva?.columnas ?? data?.columnas ?? [];
  const filasVista = hojaActiva?.filas ?? data?.filas ?? [];
  const nombreHoja =
    !esCorina && vista === "proforma"
      ? hojaProforma === "diaria"
        ? "Planilla Diaria"
        : "Proforma"
      : undefined;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlanilla(tenant, {
      formato: esCorina ? vistaCorina : vista,
      tipoViaje: esCorina ? undefined : tipoViaje,
      desde: desde || undefined,
      hasta: hasta || undefined,
    })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant, vista, vistaCorina, tipoViaje, desde, hasta, esCorina]);

  useEffect(() => {
    load();
  }, [load]);

  const hintCantidad = esCorina
    ? vistaCorina === "importacion"
      ? "Delfos 25 cols — Corta Distancia, Cantidad en bultos, Unidad Pallet"
      : "Planilla Local — tramos, horas y bultos por remito"
    : vista === "proforma"
      ? tenant === "beraldi"
        ? "Excel con 2 hojas: Planilla Diaria + Proforma (km)"
        : "Excel con 2 hojas: Planilla Diaria + Proforma (TN)"
      : tenant === "beraldi"
      ? "Cantidad en Km (Orden 1) — desde Parámetros → Distancias"
      : "toneladas en Cantidad (Orden 1)";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {esCorina ? (
            <>
              <button
                type="button"
                onClick={() => setVistaCorina("local")}
                className={
                  vistaCorina === "local"
                    ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50"
                    : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)] hover:bg-white/10"
                }
              >
                Planilla Local (11 cols)
              </button>
              <button
                type="button"
                onClick={() => setVistaCorina("importacion")}
                className={
                  vistaCorina === "importacion"
                    ? "rounded-lg bg-[var(--violet)]/25 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50"
                    : "rounded-lg bg-white/5 px-3 py-1.5 text-sm text-[var(--text-dim)] hover:bg-white/10"
                }
              >
                Planilla Importación (Delfos 25 cols)
              </button>
            </>
          ) : (
            <>
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
                Proforma (2 hojas)
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {!esCorina && (
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
          )}
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
              href={planillaExportUrl(tenant, {
                tipoViaje: esCorina ? undefined : tipoViaje,
                desde,
                hasta,
                formato: formatoActivo,
              })}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--violet)]/25 px-3 py-2 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50 hover:bg-[var(--violet)]/35"
            >
              <Download size={16} />
              {esCorina
                ? vistaCorina === "importacion"
                  ? "Excel Importación"
                  : "Excel Planilla Local"
                : "Excel"}
            </a>
            {!esCorina && (
              <>
                <a
                  href={planillaExportUrl(tenant, { tipoViaje, desde, hasta, formato: "delfos" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-[var(--border)] hover:bg-white/15"
                >
                  <Download size={16} />
                  Excel Delfos
                </a>
                <a
                  href={planillaExportUrl(tenant, { tipoViaje, desde, hasta, formato: "proforma" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--violet)]/25 px-3 py-2 text-sm font-medium text-white ring-1 ring-[var(--violet)]/50 hover:bg-[var(--violet)]/35"
                >
                  <Download size={16} />
                  Excel Proforma (2 hojas)
                </a>
              </>
            )}
          </div>
        </div>
        {data && (
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            {data.meta.remitos} remitos listos
            {vista === "proforma" && data.hojas
              ? ` → Planilla Diaria: ${data.meta.filas_diaria ?? data.hojas.diaria.filas.length} filas · Proforma: ${data.meta.filas} filas`
              : ` → ${data.meta.filas} filas · ${columnasVista.length} columnas`}
            {vista !== "proforma" && ` (${hintCantidad})`}
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
            <Pill color={cfg.color}>{cfg.short}</Pill>
            <span className="text-sm text-[var(--text-dim)]">
              {esCorina
                ? vistaCorina === "importacion"
                  ? "Importación Local — Tipo Nacional · Producto Corta Distancia"
                  : "Planilla Local — control operativo de viajes cortos"
                : vista === "delfos"
                  ? `Vista Delfos — headers iguales al Excel ${cfg.short}`
                  : "Proforma — Planilla Diaria (certificación) + Proforma (ida y vuelta para Torre de Control)"}
            </span>
            <span className="text-xs text-[var(--violet-2)]">← deslizá horizontal para ver todas las columnas</span>
          </div>
          {!esCorina && vista === "proforma" && data.hojas && (
            <div className="flex flex-wrap gap-1 px-1">
              <button
                type="button"
                onClick={() => setHojaProforma("diaria")}
                className={
                  hojaProforma === "diaria"
                    ? "rounded-t-lg bg-[var(--violet)]/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-[var(--violet)]/40"
                    : "rounded-t-lg px-4 py-2 text-sm text-[var(--text-dim)] hover:text-white"
                }
              >
                Planilla Diaria
              </button>
              <button
                type="button"
                onClick={() => setHojaProforma("proforma")}
                className={
                  hojaProforma === "proforma"
                    ? "rounded-t-lg bg-[var(--violet)]/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-[var(--violet)]/40"
                    : "rounded-t-lg px-4 py-2 text-sm text-[var(--text-dim)] hover:text-white"
                }
              >
                Proforma
              </button>
            </div>
          )}
          <PlanillaGrid columnas={columnasVista} filas={filasVista} sheetName={nombreHoja} />
        </div>
      ) : null}
    </div>
  );
}
