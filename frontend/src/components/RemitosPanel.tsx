"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { imagenUrl, listRemitos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import {
  acopladoPatente,
  chasisPatente,
  conductorNombre,
  destinoNombre,
  estadoColor,
  estadoLabel,
  fechaHoraRemito,
  fechaRemito,
  numeroRemito,
  origenNombre,
  pesoKg,
  tenantLabel,
} from "@/lib/remitos-ui";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

function RemitoSidePreview({ row }: { row: RemitoRow | null }) {
  if (!row) {
    return (
      <Card className="flex h-full min-h-[420px] items-center justify-center">
        <p className="text-sm text-[var(--text-dim)]">Seleccioná un remito para ver la foto</p>
      </Card>
    );
  }

  return (
    <Card className="flex max-h-[min(720px,calc(100vh-8rem))] flex-col">
      <SectionTitle
        right={
          <Link
            href={`/remitos/${row.tenant}/${row.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--violet-2)] hover:underline"
          >
            <Pencil size={13} /> Editar
          </Link>
        }
      >
        {numeroRemito(row)} · {conductorNombre(row)}
      </SectionTitle>

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
        <span>{origenNombre(row)} → {destinoNombre(row)}</span>
        <span>·</span>
        <span>{pesoKg(row)} kg</span>
        <Pill color={estadoColor(row.estado)}>{estadoLabel(row.estado)}</Pill>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenUrl(row.id)}
          alt={`Remito ${numeroRemito(row)}`}
          className="h-full w-full object-contain object-top"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--text-faint)]">Chasis</span>
          <p className="font-medium text-white">{chasisPatente(row)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Acoplado</span>
          <p className="font-medium text-white">{acopladoPatente(row)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Fecha</span>
          <p className="font-medium text-white">{fechaRemito(row)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Recibido</span>
          <p className="font-medium text-white">{fechaHoraRemito(row)}</p>
        </div>
      </div>

      {row.telefono_chofer && (
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          WhatsApp: {row.telefono_chofer}
        </p>
      )}

      <Link
        href={`/remitos/${row.tenant}/${row.id}`}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90"
      >
        <ExternalLink size={16} />
        Abrir revisión completa
      </Link>
    </Card>
  );
}

export function RemitosPanel({ tenant }: { tenant?: string }) {
  const [rows, setRows] = useState<RemitoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRemitos({ tenant, limit: 100 })
      .then((data) => {
        setRows(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenant]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const cols: Column<RemitoRow>[] = [
    {
      key: "foto",
      header: "Foto",
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedId(r.id)}
          className="block h-12 w-9 overflow-hidden rounded border border-[var(--border)] bg-black/20 transition ring-[var(--violet)] hover:ring-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagenUrl(r.id)} alt="" className="h-full w-full object-cover object-top" />
        </button>
      ),
    },
    {
      key: "nro",
      header: "Nro remito",
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedId(r.id)}
          className="font-medium text-white hover:text-[var(--violet-2)]"
        >
          {numeroRemito(r)}
        </button>
      ),
    },
    {
      key: "chofer",
      header: "Chofer",
      className: "text-[var(--text-dim)]",
      render: (r) => conductorNombre(r),
    },
    {
      key: "chasis",
      header: tenant === "beraldi" ? "Pat. chasis" : "Chasis",
      className: "text-[var(--text-dim)] tabular",
      render: (r) => chasisPatente(r),
    },
    {
      key: "acoplado",
      header: tenant === "beraldi" ? "Pat. acoplado" : "Acoplado",
      className: "text-[var(--text-dim)] tabular",
      render: (r) => acopladoPatente(r),
    },
    {
      key: "origen",
      header: "Origen",
      className: "max-w-[140px] truncate text-[var(--text-dim)]",
      render: (r) => origenNombre(r),
    },
    {
      key: "destino",
      header: "Destino",
      className: "max-w-[160px] truncate text-[var(--text-dim)]",
      render: (r) => destinoNombre(r),
    },
    {
      key: "fecha",
      header: "Fecha",
      className: "tabular text-[var(--text-dim)]",
      render: (r) => fechaRemito(r),
    },
    {
      key: "peso",
      header: "Peso (kg)",
      className: "tabular text-[var(--text-dim)]",
      render: (r) => pesoKg(r),
    },
    ...(tenant
      ? []
      : [
          {
            key: "tenant",
            header: "Empresa",
            render: (r: RemitoRow) => (
              <Pill color={r.tenant === "tsb" ? "#38bdf8" : "#a78bfa"}>{tenantLabel(r.tenant)}</Pill>
            ),
          } as Column<RemitoRow>,
        ]),
    {
      key: "estado",
      header: "Estado",
      render: (r) => <Pill color={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Pill>,
    },
    {
      key: "acciones",
      header: "",
      render: (r) => (
        <Link
          href={`/remitos/${r.tenant}/${r.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--violet)]/20 px-2.5 py-1.5 text-xs font-medium text-[var(--violet-2)] hover:bg-[var(--violet)]/30"
        >
          <Pencil size={12} /> Editar
        </Link>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_min(380px,32vw)]">
      <Card className="min-w-0 overflow-hidden">
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
          <p className="text-sm text-[var(--text-dim)]">
            Sin remitos. Subí una foto desde WhatsApp o la pantalla Subir.
          </p>
        )}
        {!loading && rows.length > 0 && (
          <DataTable
            columns={cols}
            rows={rows}
            minWidth={1100}
            rowClassName={(r) =>
              r.id === selectedId ? "bg-[var(--violet)]/10 ring-1 ring-inset ring-[var(--violet)]/30" : ""
            }
            onRowClick={(r) => setSelectedId(r.id)}
          />
        )}
      </Card>

      <div className="hidden min-w-0 xl:block">
        <RemitoSidePreview row={selected} />
      </div>
    </div>
  );
}
