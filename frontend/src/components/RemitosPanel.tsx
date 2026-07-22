"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronLeft, ChevronRight, Loader2, Search, Square } from "lucide-react";
import { listRemitos, procesarRemitos, type ProcesarRemitosResult } from "@/lib/api";
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
  remitoProcesable,
  tenantLabel,
  totalBultos,
  totalLitros,
} from "@/lib/remitos-ui";
import { tenantColor } from "@/lib/tenants";
import { Card, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";
import { RemitoQuickEditorDrawer, RemitoQuickEditorPanel } from "./RemitoQuickEditor";

const PAGE_SIZE = 17;

function matchBusqueda(row: RemitoRow, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const d = row.datos as Record<string, unknown>;
  const nro = String(d.nro_guia ?? d.nro_remito ?? "");
  const remitoCliente = String(d.remito_cliente ?? d.nro_interno ?? "");
  const chofer = String(d.conductor ?? d.chofer ?? "").toLowerCase();
  const chasis = String(d.chasis ?? d.tractor ?? d.patente_chasis ?? "").toLowerCase();
  const semi = String(d.acoplado ?? d.semi ?? d.patente_acoplado ?? "").toLowerCase();
  const qDigits = needle.replace(/\D/g, "");
  if (nro.toLowerCase().includes(needle)) return true;
  if (remitoCliente.toLowerCase().includes(needle)) return true;
  if (qDigits.length >= 3 && nro.replace(/\D/g, "").includes(qDigits)) return true;
  if (qDigits.length >= 3 && remitoCliente.replace(/\D/g, "").includes(qDigits)) return true;
  if (chofer.includes(needle)) return true;
  if (chasis.includes(needle.replace(/\s/g, ""))) return true;
  if (semi.includes(needle.replace(/\s/g, ""))) return true;
  return false;
}

export function RemitosPanel({ tenant }: { tenant?: string }) {
  const [rows, setRows] = useState<RemitoRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [procesando, setProcesando] = useState(false);
  const [batchResult, setBatchResult] = useState<ProcesarRemitosResult | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    setCheckedIds(new Set());
    setBatchResult(null);
    setPagina(0);
  }, [tenant, soloPendientes]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda]);

  const filtradas = useMemo(
    () => rows.filter((r) => matchBusqueda(r, busqueda)),
    [rows, busqueda],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const filasPagina = useMemo(
    () => filtradas.slice(paginaSegura * PAGE_SIZE, paginaSegura * PAGE_SIZE + PAGE_SIZE),
    [filtradas, paginaSegura],
  );

  const procesablesEnPagina = useMemo(
    () => filasPagina.filter((r) => remitoProcesable(r).ok),
    [filasPagina],
  );

  const allProcesablesChecked =
    procesablesEnPagina.length > 0 &&
    procesablesEnPagina.every((r) => checkedIds.has(r.id));

  useEffect(() => {
    setLoading(true);
    setError(null);
    listRemitos({ tenant, pendientes: soloPendientes, limit: 5000 })
      .then((data) => {
        setRows(data);
        setSelectedId((prev) => (data.some((r) => r.id === prev) ? prev : data[0]?.id ?? null));
      })
      .catch((e) =>
        setError(
          `${e.message} (API: ${typeof window !== "undefined" ? window.location.origin : ""}/backend)`,
        ),
      )
      .finally(() => setLoading(false));
  }, [tenant, soloPendientes]);

  const selected = filtradas.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null;

  function selectRow(row: RemitoRow) {
    setSelectedId(row.id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setDrawerOpen(true);
    }
  }

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleSaved(updated: RemitoRow) {
    if (tenant && updated.tenant !== tenant) {
      setRows((prev) => prev.filter((r) => r.id !== updated.id));
      setSelectedId((prev) => (prev === updated.id ? null : prev));
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllProcesables() {
    if (allProcesablesChecked) {
      setCheckedIds(new Set());
      return;
    }
    setCheckedIds(new Set(procesablesEnPagina.map((r) => r.id)));
  }

  async function procesarSeleccionados() {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    setProcesando(true);
    setBatchResult(null);
    try {
      const result = await procesarRemitos(ids, tenant);
      setBatchResult(result);
      if (result.procesados.length > 0) {
        const done = new Set(result.procesados.map((p) => p.id));
        setRows((prev) =>
          soloPendientes ? prev.filter((r) => !done.has(r.id)) : prev.map((r) => (done.has(r.id) ? { ...r, estado: "confirmado" as const } : r)),
        );
        setCheckedIds((prev) => {
          const next = new Set(prev);
          for (const id of done) next.delete(id);
          return next;
        });
      }
    } catch (e) {
      setBatchResult({
        procesados: [],
        errores: [{ id: "", motivos: [e instanceof Error ? e.message : "Error al procesar"] }],
        total: ids.length,
      });
    } finally {
      setProcesando(false);
    }
  }

  const checkCol: Column<RemitoRow> = {
    key: "_check",
    header: (
      <button
        type="button"
        onClick={toggleAllProcesables}
        className="inline-flex items-center text-[var(--text-faint)] hover:text-white"
        title={allProcesablesChecked ? "Desmarcar todos" : "Tildar procesables"}
        aria-label={allProcesablesChecked ? "Desmarcar todos" : "Tildar procesables"}
      >
        {allProcesablesChecked ? <CheckSquare size={14} /> : <Square size={14} />}
      </button>
    ),
    className: "w-10",
    render: (r) => {
      const { ok, motivos } = remitoProcesable(r);
      return (
        <input
          type="checkbox"
          checked={checkedIds.has(r.id)}
          disabled={!ok}
          title={ok ? "Tildar para procesar" : motivos.join(" · ")}
          onClick={(e) => e.stopPropagation()}
          onChange={() => ok && toggleCheck(r.id)}
          className="rounded border-[var(--border)] bg-white/5 accent-[var(--violet)] disabled:opacity-30"
        />
      );
    },
  };

  const cols: Column<RemitoRow>[] = esTenantCorina(tenant ?? "")
    ? [
        checkCol,
        {
          key: "nro",
          header: "Nro remito",
          render: (r) => (
            <span className="font-medium text-white">{numeroRemito(r)}</span>
          ),
        },
        {
          key: "fecha",
          header: "Fecha",
          className: "tabular-nums text-[var(--text-dim)] whitespace-nowrap",
          render: (r) => fechaRemito(r),
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
          header: "Semi / remolque",
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
    checkCol,
    {
      key: "nro",
      header: "Nro remito",
      render: (r) => (
        <span className="font-medium text-white">{numeroRemito(r)}</span>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      className: "tabular-nums text-[var(--text-dim)] whitespace-nowrap",
      render: (r) => fechaRemito(r),
    },
    {
      key: "chofer",
      header: "Chofer",
      className: "text-[var(--text-dim)]",
      render: (r) => conductorNombre(r),
    },
    {
      key: "chasis",
      header: "Tractor / chasis",
      className: "text-[var(--text-dim)] tabular-nums",
      render: (r) => chasisPatente(r),
    },
    {
      key: "acoplado",
      header: "Semi / remolque",
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
              <div className="flex flex-wrap items-center gap-3">
                {checkedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={procesarSeleccionados}
                    disabled={procesando}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--green)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--green)] ring-1 ring-[var(--green)]/40 hover:bg-[var(--green)]/30 disabled:opacity-50"
                  >
                    {procesando ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                    Procesar ({checkedIds.size})
                  </button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-dim)]">
                  <input
                    type="checkbox"
                    checked={soloPendientes}
                    onChange={(e) => setSoloPendientes(e.target.checked)}
                    className="rounded border-[var(--border)] bg-white/5 accent-[var(--violet)]"
                  />
                  Solo pendientes
                </label>
                <Link
                  href={tenant ? `/subir?tenant=${tenant}` : "/subir"}
                  className="text-xs font-medium text-[var(--violet-2)] hover:underline"
                >
                  + Subir remito
                </Link>
              </div>
            }
          >
            {tenant ? `Remitos ${tenantLabel(tenant)}` : "Remitos"}
          </SectionTitle>

          <p className="mb-3 text-xs text-[var(--text-faint)]">
            Tildá los revisados y usá <strong className="text-white/80">Procesar</strong> — como el CRM
            viejo. En planilla entran los procesados (confirmados).
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[200px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar chofer, nro remito o patente…"
                className="w-full rounded-lg border border-[var(--border)] bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:ring-1 focus:ring-[var(--violet)]"
              />
            </label>
            {busqueda && (
              <span className="text-xs text-[var(--text-dim)]">
                {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {batchResult && (
            <div
              className={`mb-3 rounded-lg px-3 py-2 text-xs ${
                batchResult.errores.length > 0
                  ? "bg-[var(--amber)]/10 text-[var(--amber)]"
                  : "bg-[var(--green)]/10 text-[var(--green)]"
              }`}
            >
              {batchResult.procesados.length > 0 && (
                <p>{batchResult.procesados.length} remito(s) procesado(s).</p>
              )}
              {batchResult.errores.map((e) => (
                <p key={e.id || e.motivos.join()}>
                  {e.nro ? `${e.nro}: ` : ""}
                  {e.motivos.join(" · ")}
                </p>
              ))}
            </div>
          )}

          <p className="mb-3 text-xs text-[var(--text-faint)] lg:hidden">
            Tocá una fila para abrir foto y edición
          </p>

          {loading && <p className="text-sm text-[var(--text-dim)]">Cargando…</p>}
          {error && <p className="text-sm text-[var(--red)]">Error: {error}</p>}
          {!loading && !error && filtradas.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">
              {rows.length === 0
                ? soloPendientes
                  ? "No hay remitos pendientes. Desmarcá «Solo pendientes» para ver validados."
                  : "Sin remitos. Subí una foto desde WhatsApp o la pantalla Subir."
                : "Ningún remito coincide con la búsqueda."}
            </p>
          )}
          {!loading && filasPagina.length > 0 && (
            <>
            <DataTable
              columns={cols}
              rows={filasPagina}
              minWidth={1080}
              maxHeightClass="max-h-[min(72vh,760px)]"
              rowClassName={(r) =>
                r.id === selectedId
                  ? "bg-[var(--violet)]/15 ring-1 ring-inset ring-[var(--violet)]/50"
                  : ""
              }
              onRowClick={selectRow}
            />
            {filtradas.length > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-dim)]">
                <span>
                  Página {paginaSegura + 1} de {totalPaginas} · {filtradas.length} remitos
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={paginaSegura <= 0}
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-white/5 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    type="button"
                    disabled={paginaSegura >= totalPaginas - 1}
                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-white/5 disabled:opacity-40"
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </Card>

        <div className="hidden min-w-0 lg:block">
          <RemitoQuickEditorPanel row={selected} onSaved={handleSaved} onDeleted={handleDeleted} />
        </div>
      </div>

      <RemitoQuickEditorDrawer
        row={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  );
}
