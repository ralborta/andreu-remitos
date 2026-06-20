"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRemitos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import { REMITO_TENANTS } from "@/lib/tenants";
import { Card, SectionTitle, Pill } from "./ui";

export function RemitosResumen() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  useEffect(() => {
    listRemitos({ limit: 200 })
      .then((rows) => {
        const c: Record<string, number> = {};
        for (const t of REMITO_TENANTS) c[t.slug] = 0;
        for (const r of rows) {
          if (c[r.tenant] != null) c[r.tenant]++;
        }
        setCounts(c);
        setTotal(rows.length);
      })
      .catch(() => {});
  }, []);

  return (
    <Card>
      <SectionTitle>Resumen hoy</SectionTitle>
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-2xl font-bold tabular text-white">{total}</p>
          <p className="text-xs text-[var(--text-dim)]">Total procesados</p>
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
