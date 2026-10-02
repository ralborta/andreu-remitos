"use client";

import { useEffect, useState } from "react";
import { listRemitos } from "@/lib/api";
import { REMITO_TENANTS } from "@/lib/tenants";
import { Card, SectionTitle, Pill } from "./ui";

type Periodo = "hoy" | "7d" | "30d";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
];

/** Inicio del período en zona Argentina (UTC-3, sin DST). */
function desdePeriodo(periodo: Periodo): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hoy = fmt.format(new Date()); // YYYY-MM-DD
  const diasAtras = periodo === "hoy" ? 0 : periodo === "7d" ? 6 : 29;
  const inicioHoy = new Date(`${hoy}T00:00:00-03:00`).getTime();
  return new Date(inicioHoy - diasAtras * 86_400_000).toISOString();
}

export function RemitosResumen() {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRemitos({ limit: 5000, desde: desdePeriodo(periodo) })
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
  }, [periodo]);

  return (
    <Card>
      <SectionTitle
        right={
          <div className="flex flex-wrap gap-1">
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
