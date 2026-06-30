"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listRemitos } from "@/lib/api";
import type { RemitoRow } from "@/lib/types";
import {
  acopladoPatente,
  chasisPatente,
  conductorNombre,
  destinoNombre,
  estadoColor,
  estadoLabel,
  esTenantCorina,
  fechaRemito,
  horasResumen,
  horasCompletas,
  numeroRemito,
  origenNombre,
  pesoKg,
  tenantLabel,
  totalBultos,
  totalLitros,
} from "@/lib/remitos-ui";
import { tenantColor } from "@/lib/tenants";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";
import { RemitoQuickEditorDrawer, RemitoQuickEditorPanel } from "./RemitoQuickEditor";

export function RemitosPanel({ tenant }: { tenant?: string }) {
  const [rows, setRows] = useState<RemitoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRemitos({ tenant, limit: 100 })
      .then((data) => {
        setRows(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e) =>
        setError(
          `${e.message} (API: ${typeof window !== "undefined" ? window.location.origin : ""}/backend)`,
        ),
      )
      .finally(() => setLoading(false));
  }, [tenant]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function selectRow(row: RemitoRow) {
    setSelectedId(row.id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setDrawerOpen(true);
    }
  }

  function handleSaved(updated: RemitoRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const cols: Column<RemitoRow>[] = esTenantCorina(tenant ?? "")
    ? [
        {
          key: "nro",
          header: "Nro remito",
          render: (r) => (
            <span className="font-medium text-white">{numeroRemito(r)}</span>
          ),
        },
        {
          key: "chofer",
          header: "Chofer",
          className: "text-[var(--text-dim)]",
          render: (r) => conductorNombre(r),
        },
        {
          key: "tractor",
          header: "Tractor",
          className: "text-[var(--text-dim)] tabular-nums",
          render: (r) => chasisPatente(r),
        },
        {
          key: "semi",
          header: "Semi",
          className: "text-[var(--text-dim)] tabular-nums",
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
          className: "tabular-nums text-[var(--text-dim)]",
          render: (r) => fechaRemito(r),
        },
        {
          key: "bultos",
          header: "Bultos",
          className: "tabular-nums text-[var(--text-dim)]",
          render: (r) => totalBultos(r),
        },
        {
          key: "estado",
          header: "Estado",
          render: (r) => <Pill color={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Pill>,
        },
        {
          key: "acciones",
          header: "",
          render: (r) => (
            <ChevronRight
              size={16}
              className={r.id === selectedId ? "text-[var(--violet-2)]" : "text-[var(--text-faint)]"}
            />
          ),
        },
      ]
    : [
    {
      key: "nro",
      header: "Nro remito",
      render: (r) => (
        <span className="font-medium text-white">{numeroRemito(r)}</span>
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
      header: tenant === "beraldi" ? "Tractor" : "Tractor",
      className: "text-[var(--text-dim)] tabular-nums",
      render: (r) => chasisPatente(r),
    },
    {
      key: "acoplado",
      header: "Semi",
      className: "text-[var(--text-dim)] tabular-nums",
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
      className: "tabular-nums text-[var(--text-dim)]",
      render: (r) => fechaRemito(r),
    },
    {
      key: "horas",
      header: "Horarios",
      className: "tabular-nums text-[var(--text-dim)] whitespace-nowrap",
      render: (r) => (
        <span className={horasCompletas(r) ? "text-[var(--green)]" : "text-[var(--amber)]"}>
          {horasResumen(r)}
        </span>
      ),
    },
    {
      key: "peso",
      header: "Peso (kg)",
      className: "tabular-nums text-[var(--text-dim)]",
      render: (r) => pesoKg(r),
    },
    ...(tenant
      ? []
      : [
          {
            key: "tenant",
            header: "Empresa",
            render: (r: RemitoRow) => (
              <Pill color={tenantColor(r.tenant)}>{tenantLabel(r.tenant)}</Pill>
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
        <ChevronRight
          size={16}
          className={r.id === selectedId ? "text-[var(--violet-2)]" : "text-[var(--text-faint)]"}
        />
      ),
    },
  ];

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_min(400px,36vw)]">
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
            {tenant ? `Remitos ${tenantLabel(tenant)}` : "Remitos"}
          </SectionTitle>

          <p className="mb-3 text-xs text-[var(--text-faint)] lg:hidden">
            Tocá una fila para abrir foto y edición
          </p>

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
              minWidth={960}
              rowClassName={(r) =>
                r.id === selectedId
                  ? "bg-[var(--violet)]/15 ring-1 ring-inset ring-[var(--violet)]/50"
                  : ""
              }
              onRowClick={selectRow}
            />
          )}
        </Card>

        <div className="hidden min-w-0 lg:block">
          <RemitoQuickEditorPanel row={selected} onSaved={handleSaved} />
        </div>
      </div>

      <RemitoQuickEditorDrawer
        row={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
