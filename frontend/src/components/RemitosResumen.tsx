"use client";

import { useEffect, useMemo, useState } from "react";
import { listRemitos } from "@/lib/api";
import { REMITO_TENANTS } from "@/lib/tenants";
import { Card, SectionTitle, Pill } from "./ui";

type Periodo = "hoy" | "7d" | "30d" | "rango";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "rango", label: "Rango" },
];

/** Fecha local Argentina YYYY-MM-DD. */
function hoyAr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Inicio del día AR → ISO UTC. */
function inicioDiaAr(ymd: string): string {
  return new Date(`${ymd}T00:00:00-03:00`).toISOString();
}

/** Fin del día AR → ISO UTC. */
function finDiaAr(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999-03:00`).toISOString();
}

function desdePeriodoFijo(periodo: Exclude<Periodo, "rango">): string {
  const hoy = hoyAr();
  const diasAtras = periodo === "hoy" ? 0 : periodo === "7d" ? 6 : 29;
  const inicioHoy = new Date(`${hoy}T00:00:00-03:00`).getTime();
  return new Date(inicioHoy - diasAtras * 86_400_000).toISOString();
}

export function RemitosResumen() {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [rangoDesde, setRangoDesde] = useState(() => hoyAr());
  const [rangoHasta, setRangoHasta] = useState(() => hoyAr());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    if (periodo === "rango") {
      const a = rangoDesde <= rangoHasta ? rangoDesde : rangoHasta;
      const b = rangoDesde <= rangoHasta ? rangoHasta : rangoDesde;
      return { desde: inicioDiaAr(a), hasta: finDiaAr(b) };
    }
    return { desde: desdePeriodoFijo(periodo), hasta: undefined as string | undefined };
  }, [periodo, rangoDesde, rangoHasta]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRemitos({ limit: 5000, desde: query.desde, hasta: query.hasta })
      .then((rows) => {
        if (cancelled) return;
        const c: Record<string, number> = {};
        for (const t of REMITO_TENANTS) c[t.slug] = 0;
        for (const r of rows) {
          if (c[r.tenant] != null) c[r.tenant]++;
        }
        setCounts(c);
        setTotal(rows.length);
      })
      .catch(() => {
        if (!cancelled) {
          setCounts({});
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query.desde, query.hasta]);

  return (
    <Card>
      <SectionTitle
        right={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodo(p.id)}
                  className={
                    periodo === p.id
                      ? "rounded-lg bg-[var(--violet)]/25 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-[var(--violet)]/50"
                      : "rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-[var(--text-dim)] hover:bg-white/10"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            {periodo === "rango" ? (
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[var(--text-dim)]">
                <label className="flex items-center gap-1.5">
                  <span>Desde</span>
                  <input
                    type="date"
                    value={rangoDesde}
                    max={rangoHasta || undefined}
                    onChange={(e) => setRangoDesde(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[var(--violet)]/50"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={rangoHasta}
                    min={rangoDesde || undefined}
                    onChange={(e) => setRangoHasta(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[var(--violet)]/50"
                  />
                </label>
              </div>
            ) : null}
          </div>
        }
      >
        Resumen
      </SectionTitle>
      <div className={`flex flex-wrap gap-4 ${loading ? "opacity-60" : ""}`}>
        <div>
          <p className="text-2xl font-bold tabular text-white">{total}</p>
          <p className="text-xs text-[var(--text-dim)]">Ingresados</p>
        </div>
        {REMITO_TENANTS.map((t) => (
          <div key={t.slug}>
            <p className="text-2xl font-bold tabular text-white">{counts[t.slug] ?? "—"}</p>
            <Pill color={t.color}>{t.short}</Pill>
          </div>
        ))}
      </div>
    </Card>
  );
}
