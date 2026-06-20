"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRemitos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import {
  confianzaPct,
  conductorNombre,
  destinoNombre,
  estadoColor,
  estadoLabel,
  horaCorta,
  numeroRemito,
  tenantLabel,
} from "@/lib/remitos-ui";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

function ConfBar({ v }: { v: number }) {
  const color = v >= 90 ? "#22c55e" : v >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="tabular text-xs text-[var(--text-dim)]">{v}%</span>
    </div>
  );
}

export function RemitosPanel({ tenant }: { tenant?: string }) {
  const [rows, setRows] = useState<RemitoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRemitos({ tenant, limit: 100 })
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant]);

  const cols: Column<RemitoRow>[] = [
    {
      key: "id",
      header: "Remito / Guía",
      render: (r) => (
        <Link
          href={`/remitos/${r.tenant}/${r.id}`}
          className="font-medium text-white hover:text-[var(--violet-2)]"
        >
          {numeroRemito(r)}
        </Link>
      ),
    },
    ...(tenant
      ? []
      : [
          {
            key: "tenant",
            header: "Cliente",
            render: (r: RemitoRow) => (
              <Pill color={r.tenant === "tsb" ? "#38bdf8" : "#a78bfa"}>{tenantLabel(r.tenant)}</Pill>
            ),
          } as Column<RemitoRow>,
        ]),
    {
      key: "conductor",
      header: "Conductor",
      className: "text-[var(--text-dim)]",
      render: (r) => conductorNombre(r),
    },
    {
      key: "destino",
      header: "Destino",
      className: "text-[var(--text-dim)]",
      render: (r) => destinoNombre(r),
    },
    {
      key: "conf",
      header: "Lectura IA",
      render: (r) => <ConfBar v={confianzaPct(r)} />,
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => <Pill color={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Pill>,
    },
    {
      key: "hora",
      header: "Hora",
      className: "tabular text-[var(--text-dim)]",
      render: (r) => horaCorta(r.created_at),
    },
  ];

  return (
    <Card>
      <SectionTitle
        right={
          <Link
            href={tenant ? `/subir?tenant=${tenant}` : "/subir"}
            className="text-xs font-medium text-[var(--violet-2)] hover:underline"
          >
            + Subir remito
          </Link>
        }
      >
        {tenant ? `Remitos ${tenantLabel(tenant)}` : "Remitos procesados"}
      </SectionTitle>
      {loading && <p className="text-sm text-[var(--text-dim)]">Cargando…</p>}
      {error && <p className="text-sm text-[var(--red)]">Error: {error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-[var(--text-dim)]">Sin remitos. Subí una foto desde WhatsApp o la pantalla Subir.</p>
      )}
      {!loading && rows.length > 0 && <DataTable columns={cols} rows={rows} minWidth={860} />}
    </Card>
  );
}
