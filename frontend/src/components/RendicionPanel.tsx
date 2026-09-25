"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Download, ImageIcon, RefreshCw, Search, Send, X } from "lucide-react";
import {
  decidirGastoRendicion,
  decidirGastosRendicionLote,
  downloadAuthenticatedFile,
  enviarRendicionErp,
  listGastosRendicion,
  listViajesAnticipoRendicion,
  metaRendicion,
  patchGastoRendicion,
  cotizacionClpRendicion,
  rendicionExportUrl,
  resumenRendicion,
  sugerenciasViajeRendicion,
  type CotizacionClp,
  type GastoRendicion,
  type RendicionRules,
  type ResumenRendicion,
  type SugerenciaViajeRemito,
  type ViajeAnticipoRendicion,
} from "@/lib/api";
import { browsableMediaUrl } from "@/lib/media-url";
import { KpiCard } from "./ui";
import { useConfirm } from "@/lib/confirm-context";
import { useAuth } from "@/lib/auth-context";
import { RemitoImageLightbox } from "./RemitoImageLightbox";

type Filtro = "todos" | "pendiente_aprobacion" | "aprobado" | "rechazado";
type Vista = "cola" | "viajes";

type FotoPreview = {
  src: string;
  title: string;
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Fecha corta para la cola (comprobante o alta). */
function fmtFechaCola(g: GastoRendicion) {
  const raw = g.fechaComprobante || g.createdAt || null;
  if (!raw) return "—";
  // YYYY-MM-DD o ISO
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

function RechazoMotivoModal({
  caso,
  busy,
  onClose,
  onConfirm,
}: {
  caso: GastoRendicion;
  busy: boolean;
  onClose: () => void;
  onConfirm: (nota: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [touched, setTouched] = useState(false);
  const motivo = nota.trim();
  const invalid = !motivo;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rechazo-motivo-title"
      >
        <h3 id="rechazo-motivo-title" className="text-lg font-semibold text-slate-900">
          Rechazar gasto
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {caso.codigo} · {caso.categoriaLabel} · {caso.montoLabel}
          {caso.choferNombre ? ` · ${caso.choferNombre}` : ""}
        </p>
        <label className="mt-4 block text-xs font-medium text-slate-500">
          Comentario de rechazo <span className="text-rose-400">*</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            required
            placeholder="Ej. comprobante ilegible, monto incorrecto…"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
        </label>
        {touched && invalid && (
          <p className="mt-1.5 text-xs text-rose-400">
            Tenés que indicar un comentario para rechazar.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || invalid}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              onConfirm(motivo);
            }}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorImporte({
  montoDraft,
  onMontoDraft,
  disabled,
  puedeGuardar,
  busy,
  error,
  editorNombre,
  notaClp,
  onGuardar,
}: {
  montoDraft: string;
  onMontoDraft: (v: string) => void;
  disabled: boolean;
  puedeGuardar: boolean;
  busy: boolean;
  error: string | null;
  editorNombre: string;
  notaClp: boolean;
  onGuardar: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
        Importe a aprobar (ARS)
        <input
          type="number"
          step="0.01"
          min="0"
          value={montoDraft}
          disabled={disabled}
          onChange={(e) => onMontoDraft(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-lg font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
        />
      </label>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
        {editorNombre
          ? `Al guardar queda registrado a nombre de ${editorNombre}.`
          : "No hay sesión para registrar quién cambia el importe."}
        {notaClp ? " El monto en pesos chilenos no cambia." : ""}
      </p>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        disabled={!puedeGuardar}
        onClick={onGuardar}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-xs font-semibold text-[#fff] hover:bg-slate-800 disabled:opacity-40"
      >
        <Check size={14} />
        {busy ? "Guardando…" : "Guardar importe"}
      </button>
    </div>
  );
}

function GastoDetalleModal({
  caso,
  busyId,
  rules,
  sugerencias,
  sugerenciasNota,
  nroViajeDraft,
  onNroViajeDraft,
  onUsarSugerencia,
  onClose,
  onVerFoto,
  onDecidir,
  onActualizarTc,
  onGuardarImporte,
  editorNombre,
  tcVigente,
}: {
  caso: GastoRendicion;
  busyId: string | null;
  rules: RendicionRules | null;
  sugerencias: SugerenciaViajeRemito[];
  sugerenciasNota: string | null;
  nroViajeDraft: string;
  onNroViajeDraft: (v: string) => void;
  onUsarSugerencia: (s: SugerenciaViajeRemito) => void;
  onClose: () => void;
  onVerFoto: () => void;
  onDecidir: (estado: "aprobado" | "rechazado") => void;
  onActualizarTc: (tc: number, montoClp?: number) => Promise<void>;
  onGuardarImporte: (monto: number) => Promise<void>;
  editorNombre: string;
  tcVigente?: number | null;
}) {
  const requireViaje = Boolean(rules?.requireNroViajeDelfosOnApprove);
  const puedeAprobar =
    !requireViaje || Boolean(nroViajeDraft.trim() || caso.nroViajeDelfos);
  const esClp = caso.monedaOrigen === "CLP" && caso.montoOrigen != null;
  const tcInicial =
    caso.tcClpArs != null
      ? String(caso.tcClpArs)
      : tcVigente != null
        ? String(tcVigente)
        : "";
  const [tcDraft, setTcDraft] = useState(tcInicial);
  const [tcBusy, setTcBusy] = useState(false);
  const [tcError, setTcError] = useState<string | null>(null);
  const [montoClpDraft, setMontoClpDraft] = useState(
    caso.montoOrigen != null ? String(caso.montoOrigen) : "",
  );
  const [montoDraft, setMontoDraft] = useState(
    caso.monto != null ? String(caso.monto) : "",
  );
  const [montoBusy, setMontoBusy] = useState(false);
  const [montoError, setMontoError] = useState<string | null>(null);

  useEffect(() => {
    setTcDraft(
      caso.tcClpArs != null
        ? String(caso.tcClpArs)
        : tcVigente != null
          ? String(tcVigente)
          : "",
    );
    setMontoClpDraft(caso.montoOrigen != null ? String(caso.montoOrigen) : "");
    setMontoDraft(caso.monto != null ? String(caso.monto) : "");
    setTcError(null);
    setMontoError(null);
  }, [caso.id, caso.tcClpArs, caso.montoOrigen, caso.monto, tcVigente]);

  const tcNum = Number(String(tcDraft).replace(",", "."));
  const tcValido = Number.isFinite(tcNum) && tcNum > 0;
  const tcDirty =
    esClp &&
    tcValido &&
    (caso.tcClpArs == null || Math.abs(tcNum - Number(caso.tcClpArs)) > 1e-6);
  const arsPreview =
    esClp && tcValido
      ? Math.round(Number(caso.montoOrigen) * tcNum * 100) / 100
      : null;
  const montoNum = Number(String(montoDraft).replace(",", "."));
  const montoValido = Number.isFinite(montoNum) && montoNum >= 0;
  const montoDirty =
    montoValido &&
    (caso.monto == null || Math.abs(montoNum - Number(caso.monto)) > 0.001);
  const puedeEditarImporte = caso.estado === "pendiente_aprobacion";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white text-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gasto-detalle-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h3 id="gasto-detalle-title" className="text-xl font-bold tracking-tight text-slate-900">
              {caso.codigo}
            </h3>
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                caso.estado === "pendiente_aprobacion" && "border-amber-200 bg-amber-50 text-amber-700",
                caso.estado === "aprobado" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                caso.estado === "rechazado" && "border-rose-200 bg-rose-50 text-rose-700",
              )}
            >
              {caso.estadoLabel}
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <p className="text-xs font-medium text-slate-500">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                {caso.categoriaLabel}
              </span>
              {" · "}
              <span className="font-semibold text-slate-800">{caso.montoLabel}</span>
              {esClp && caso.montoOrigenLabel ? (
                <span className="text-slate-400"> ({caso.montoOrigenLabel})</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-12 md:divide-x md:divide-slate-100">
          <aside className="flex flex-col bg-slate-100/70 p-4 md:col-span-5 md:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Comprobante
              </span>
              {caso.imagenUrl ? (
                <button
                  type="button"
                  onClick={onVerFoto}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  Abrir original
                </button>
              ) : null}
            </div>
            {caso.imagenUrl ? (
              <button
                type="button"
                onClick={onVerFoto}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={browsableMediaUrl(caso.imagenUrl) || ""}
                  alt={`Comprobante ${caso.codigo}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              </button>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
                Sin comprobante
              </p>
            )}
          </aside>
          <div className="flex min-h-0 flex-col bg-white md:col-span-7">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
            <Campo label="Chofer">
              <div>{caso.choferNombre || "—"}</div>
              <div className="text-xs text-[var(--text-faint)]">{caso.telefono || ""}</div>
            </Campo>
            <Campo label="Registrado">{fmtFecha(caso.createdAt)}</Campo>
            <Campo label="Proveedor">{caso.proveedor || "—"}</Campo>
            <Campo label="Fecha comprobante">{caso.fechaComprobante || "—"}</Campo>
            {(caso.puntoVenta || caso.nroT) && (
              <>
                <Campo label="Punto de venta">{caso.puntoVenta || "—"}</Campo>
                <Campo label="Nº T">{caso.nroT || "—"}</Campo>
              </>
            )}
            {caso.viajeDocumento && (
              <div className="sm:col-span-2">
                <Campo label="Viaje en documento (no confirmado)">
                  <span className="font-semibold text-amber-700">{caso.viajeDocumento}</span>
                  <span className="mt-1 block text-xs text-[var(--text-faint)]">
                    Puede no ser el nº de Delfos — confirmar aparte.
                  </span>
                </Campo>
              </div>
            )}
            <div className="sm:col-span-2">
              <Campo label="Descripción / lectura">{caso.descripcion || "—"}</Campo>
            </div>
            {caso.notaChofer && (
              <div className="sm:col-span-2">
                <Campo label="Nota chofer">{caso.notaChofer}</Campo>
              </div>
            )}
            {caso.notaAprobacion && (
              <div className="sm:col-span-2">
                <Campo
                  label={
                    caso.estado === "rechazado" ? "Comentario de rechazo" : "Nota aprobación"
                  }
                >
                  {caso.notaAprobacion}
                </Campo>
              </div>
            )}
          </div>

          {puedeEditarImporte && !esClp && (
            <EditorImporte
              montoDraft={montoDraft}
              onMontoDraft={setMontoDraft}
              disabled={montoBusy || busyId === caso.id}
              puedeGuardar={montoDirty && montoValido && !montoBusy && busyId !== caso.id && Boolean(editorNombre)}
              busy={montoBusy}
              error={montoError}
              editorNombre={editorNombre}
              notaClp={false}
              onGuardar={() => {
                void (async () => {
                  setMontoBusy(true);
                  setMontoError(null);
                  try {
                    await onGuardarImporte(montoNum);
                  } catch (err) {
                    setMontoError(err instanceof Error ? err.message : "No pude guardar el importe");
                  } finally {
                    setMontoBusy(false);
                  }
                })();
              }}
            />
          )}

          {esClp ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/50 via-white to-sky-50/30 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-900">
                Conversión CLP → ARS
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Campo label="Monto en ticket (CLP)">
                  {caso.montoOrigenLabel || caso.montoOrigen}
                </Campo>
                {puedeEditarImporte ? (
                  <div className="sm:col-span-2">
                    <EditorImporte
                      montoDraft={montoDraft}
                      onMontoDraft={setMontoDraft}
                      disabled={montoBusy || busyId === caso.id}
                      puedeGuardar={montoDirty && montoValido && !montoBusy && busyId !== caso.id && Boolean(editorNombre)}
                      busy={montoBusy}
                      error={montoError}
                      editorNombre={editorNombre}
                      notaClp
                      onGuardar={() => {
                        void (async () => {
                          setMontoBusy(true);
                          setMontoError(null);
                          try {
                            await onGuardarImporte(montoNum);
                          } catch (err) {
                            setMontoError(err instanceof Error ? err.message : "No pude guardar el importe");
                          } finally {
                            setMontoBusy(false);
                          }
                        })();
                      }}
                    />
                  </div>
                ) : (
                  <Campo label="Monto en ARS">{caso.montoLabel}</Campo>
                )}
              </div>
              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Cotización (ARS por 1 CLP)
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={tcDraft}
                  disabled={caso.estado !== "pendiente_aprobacion" || tcBusy || busyId === caso.id}
                  onChange={(e) => setTcDraft(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                />
              </label>
              <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                {caso.tcFuente ? `Fuente: ${caso.tcFuente}` : "Sin fuente"}
                {caso.tcFecha ? ` · ${fmtFecha(caso.tcFecha)}` : ""}
                {arsPreview != null && tcDirty
                  ? ` · Preview: $${arsPreview.toLocaleString("es-AR")}`
                  : ""}
              </p>
              {tcError && <p className="mt-1 text-xs text-rose-400">{tcError}</p>}
              {caso.estado === "pendiente_aprobacion" && (
                <button
                  type="button"
                  disabled={!tcDirty || !tcValido || tcBusy || busyId === caso.id}
                  onClick={() => {
                    void (async () => {
                      setTcBusy(true);
                      setTcError(null);
                      try {
                        await onActualizarTc(tcNum);
                      } catch (err) {
                        setTcError(
                          err instanceof Error ? err.message : "No pude guardar la cotización",
                        );
                      } finally {
                        setTcBusy(false);
                      }
                    })();
                  }}
                  className="mt-3 rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-200 disabled:opacity-50"
                >
                  {tcBusy ? "Guardando…" : "Aplicar cotización"}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Tipo de cambio CLP → ARS
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {tcVigente != null
                  ? `Vigente: 1 CLP = ${Number(tcVigente).toLocaleString("es-AR", {
                      maximumFractionDigits: 4,
                    })} ARS`
                  : "Sin cotización cargada (mirá el banner de arriba)"}
              </p>
              {caso.estado === "pendiente_aprobacion" && (
                <>
                  <p className="mt-2 text-xs text-[var(--text-faint)]">
                    Si este ticket es chileno, cargá el monto en CLP y aplicá la cotización.
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                      Monto CLP
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={montoClpDraft}
                        onChange={(e) => setMontoClpDraft(e.target.value)}
                        disabled={tcBusy || busyId === caso.id}
                        className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                      />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                      Cotización
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={tcDraft}
                        onChange={(e) => setTcDraft(e.target.value)}
                        disabled={tcBusy || busyId === caso.id}
                        className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                      />
                    </label>
                  </div>
                  {tcError && <p className="mt-1 text-xs text-rose-400">{tcError}</p>}
                  <button
                    type="button"
                    disabled={tcBusy || busyId === caso.id}
                    onClick={() => {
                      void (async () => {
                        const clp = Number(String(montoClpDraft).replace(",", "."));
                        if (!Number.isFinite(clp) || clp <= 0 || !tcValido) {
                          setTcError("Ingresá monto CLP y cotización válidos");
                          return;
                        }
                        setTcBusy(true);
                        setTcError(null);
                        try {
                          await onActualizarTc(tcNum, clp);
                        } catch (err) {
                          setTcError(
                            err instanceof Error
                              ? err.message
                              : "No pude convertir a ARS",
                          );
                        } finally {
                          setTcBusy(false);
                        }
                      })();
                    }}
                    className="mt-3 rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-200 disabled:opacity-50"
                  >
                    {tcBusy ? "Guardando…" : "Marcar CLP y convertir"}
                  </button>
                </>
              )}
            </div>
          )}

          {caso.estado === "pendiente_aprobacion" && requireViaje && (
            <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4">
              <label className="text-xs font-bold uppercase tracking-wide text-amber-800">
                {rules?.labelNroViaje || "Nº viaje Delfos"} (obligatorio)
              </label>
              <input
                value={nroViajeDraft}
                onChange={(e) => onNroViajeDraft(e.target.value)}
                placeholder="Ej. 605095"
                className="mt-1.5 w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
              <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                {rules?.hintNroViaje}
              </p>
              {sugerencias.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                    Sugerencias (hoja de ruta / remitos)
                  </p>
                  {sugerencias.slice(0, 5).map((s) => (
                    <button
                      key={`${s.tipo || "x"}-${s.remitoId}`}
                      type="button"
                      onClick={() => onUsarSugerencia(s)}
                      className="flex w-full flex-col rounded-xl border border-amber-200 bg-white px-2.5 py-2 text-left text-xs hover:border-amber-400"
                    >
                      <span className="font-medium text-slate-900">
                        {s.tipo === "hoja_ruta"
                          ? `Hoja ${s.nroRemito || s.remitoId}`
                          : `Remito ${s.nroRemito || s.remitoId}`}
                        {s.nroViajeDelfos ? ` · viaje ${s.nroViajeDelfos}` : ""}
                        {s.fecha ? ` · ${s.fecha}` : ""}
                      </span>
                      <span className="text-[var(--text-faint)]">
                        {[
                          s.patente,
                          s.anticipoMonto != null
                            ? `anticipo $${Number(s.anticipoMonto).toLocaleString("es-AR")}`
                            : null,
                          s.viajeDocumento ? `doc:${s.viajeDocumento}` : null,
                          s.tipo === "hoja_ruta" ? "tocá para prellenar Delfos" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin patente"}
                      </span>
                    </button>
                  ))}
                  {sugerenciasNota && (
                    <p className="text-[11px] text-[var(--text-faint)]">{sugerenciasNota}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!requireViaje && caso.nroViajeDelfos && (
            <div className="mt-4">
              <Campo label="Nº viaje Delfos">{caso.nroViajeDelfos}</Campo>
            </div>
          )}

          {(caso.historial?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Historial
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-500">
                {(caso.historial || []).slice(-6).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {caso.estado === "pendiente_aprobacion" && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <button
              type="button"
              disabled={busyId === caso.id}
              onClick={() => onDecidir("rechazado")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <X size={14} />
              Rechazar
            </button>
            <button
              type="button"
              disabled={busyId === caso.id || !puedeAprobar}
              title={
                !puedeAprobar
                  ? "Confirmá el Nº viaje Delfos antes de aprobar"
                  : undefined
              }
              onClick={() => onDecidir("aprobado")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-100 px-5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-50"
            >
              <Check size={14} />
              Aprobar
            </button>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RendicionPanel() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const editorNombre = (user?.nombre || user?.username || "").trim();
  const [rows, setRows] = useState<GastoRendicion[]>([]);
  const [resumen, setResumen] = useState<ResumenRendicion | null>(null);
  const [rules, setRules] = useState<RendicionRules | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("pendiente_aprobacion");
  const [vista, setVista] = useState<Vista>("cola");
  const [viajes, setViajes] = useState<ViajeAnticipoRendicion[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [erpBusy, setErpBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState<"mesa" | "erp" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoPreview | null>(null);
  const [detalle, setDetalle] = useState<GastoRendicion | null>(null);
  const [rechazoTarget, setRechazoTarget] = useState<GastoRendicion | null>(null);
  const [nroViajeDraft, setNroViajeDraft] = useState("");
  const [sugerencias, setSugerencias] = useState<SugerenciaViajeRemito[]>([]);
  const [sugerenciasNota, setSugerenciasNota] = useState<string | null>(null);
  const [cotiz, setCotiz] = useState<CotizacionClp | null>(null);
  const [cotizDraft, setCotizDraft] = useState("");
  const [cotizBusy, setCotizBusy] = useState(false);
  const [cotizError, setCotizError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filtro, q, desde, hasta]);

  useEffect(() => {
    void metaRendicion()
      .then((m) => setRules(m.rules))
      .catch(() => setRules(null));
  }, []);

  const loadCotiz = useCallback(async (force = false) => {
    setCotizBusy(true);
    setCotizError(null);
    try {
      const c = await cotizacionClpRendicion(force);
      setCotiz(c);
      setCotizDraft(String(c.valor));
    } catch (err) {
      setCotizError(
        err instanceof Error ? err.message : "No pude cargar cotización CLP",
      );
    } finally {
      setCotizBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadCotiz(false);
  }, [loadCotiz]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listGastosRendicion({
          limit: 100,
          estado: filtro === "todos" ? undefined : filtro,
          q: q || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        }),
        resumenRendicion(),
      ]);
      setRows(list);
      setResumen(sum);
      setDetalle((cur) => {
        if (!cur) return null;
        return list.find((r) => r.id === cur.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar rendiciones");
    } finally {
      setLoading(false);
    }
  }, [filtro, q, desde, hasta]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadViajes = useCallback(async () => {
    setViajesLoading(true);
    setError(null);
    try {
      const list = await listViajesAnticipoRendicion({ limit: 100 });
      setViajes(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude cargar viajes");
    } finally {
      setViajesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vista === "viajes") void loadViajes();
  }, [vista, loadViajes]);

  useEffect(() => {
    if (!detalle) {
      setSugerencias([]);
      setSugerenciasNota(null);
      setNroViajeDraft("");
      return;
    }
    setNroViajeDraft(detalle.nroViajeDelfos || "");
    if (!rules?.suggestViajeFromRemitos || !detalle.telefono) {
      setSugerencias([]);
      setSugerenciasNota(null);
      return;
    }
    let cancelled = false;
    void sugerenciasViajeRendicion({
      telefono: detalle.telefono,
      fecha: detalle.fechaComprobante,
      limit: 8,
    })
      .then((res) => {
        if (cancelled) return;
        setSugerencias(res.sugerencias || []);
        setSugerenciasNota(res.nota || null);
      })
      .catch(() => {
        if (cancelled) return;
        setSugerencias([]);
        setSugerenciasNota(null);
      });
    return () => {
      cancelled = true;
    };
  }, [detalle?.id, detalle?.telefono, detalle?.fechaComprobante, rules?.suggestViajeFromRemitos]);

  const exportParams = useMemo(
    () => ({
      estado: filtro === "todos" ? undefined : filtro,
      q: q || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: 5000,
    }),
    [filtro, q, desde, hasta],
  );

  const kpis = useMemo(
    () => [
      { label: "Pendientes", value: String(resumen?.pendientes ?? "—"), hint: "esperan OK humano" },
      {
        label: "Monto pendiente",
        value: resumen ? `$${Math.round(resumen.monto_pendiente).toLocaleString("es-AR")}` : "—",
        hint: "a revisar",
      },
      { label: "Aprobados", value: String(resumen?.aprobados ?? "—"), hint: "del período" },
      { label: "Rechazados", value: String(resumen?.rechazados ?? "—"), hint: "del período" },
    ],
    [resumen],
  );

  function abrirComprobante(g: GastoRendicion) {
    const src = browsableMediaUrl(g.imagenUrl);
    if (!src) {
      void confirm({
        title: "Comprobante",
        message: "Sin comprobante",
        alert: true,
        confirmLabel: "Entendido",
      });
      return;
    }
    setFoto({
      src,
      title: `${g.codigo} · ${g.categoriaLabel}`,
    });
  }

  async function decidir(
    g: GastoRendicion,
    estado: "aprobado" | "rechazado",
    nota?: string,
  ) {
    if (estado === "rechazado") {
      const motivo = typeof nota === "string" ? nota.trim() : "";
      if (!motivo) {
        setRechazoTarget(g);
        return;
      }
    }
    const nroDelfos = (nroViajeDraft || g.nroViajeDelfos || "").trim();
    if (estado === "aprobado" && rules?.requireNroViajeDelfosOnApprove && !nroDelfos) {
      setError("Confirmá el Nº viaje Delfos antes de aprobar.");
      return;
    }
    if (estado === "aprobado") {
      const ok = await confirm({
        title: "Aprobar gasto",
        message:
          `${g.codigo} · ${g.categoriaLabel} · ${g.montoLabel}\n${g.choferNombre || g.telefono || ""}` +
          (nroDelfos ? `\nNº viaje Delfos: ${nroDelfos}` : ""),
        confirmLabel: "Aprobar",
      });
      if (!ok) return;
    }
    setBusyId(g.id);
    try {
      if (estado === "aprobado" && nroDelfos && nroDelfos !== (g.nroViajeDelfos || "")) {
        await patchGastoRendicion(g.id, {
          nro_viaje_delfos: nroDelfos,
          remito_ref: g.remitoRef || undefined,
        });
      }
      await decidirGastoRendicion(g.id, {
        estado,
        ...(estado === "rechazado" && nota ? { nota: nota.trim() } : {}),
        ...(estado === "aprobado" && nota ? { nota } : {}),
        ...(estado === "aprobado" && nroDelfos ? { nro_viaje_delfos: nroDelfos } : {}),
        ...(g.remitoRef ? { remito_ref: g.remitoRef } : {}),
      });
      setDetalle(null);
      setRechazoTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude decidir");
    } finally {
      setBusyId(null);
    }
  }

  const pendientesVisibles = useMemo(
    () => rows.filter((g) => g.estado === "pendiente_aprobacion"),
    [rows],
  );
  const selectedPendientes = pendientesVisibles.filter((g) => selectedIds.includes(g.id));
  const todosMarcados =
    pendientesVisibles.length > 0 &&
    pendientesVisibles.every((g) => selectedIds.includes(g.id));

  function toggleSeleccion(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleTodosPendientes() {
    setSelectedIds(todosMarcados ? [] : pendientesVisibles.map((g) => g.id));
  }

  async function aprobarSeleccionados() {
    const elegidos = pendientesVisibles.filter((g) => selectedIds.includes(g.id));
    if (!elegidos.length || bulkBusy) return;
    if (rules?.requireNroViajeDelfosOnApprove) {
      const sinViaje = elegidos.filter((g) => !String(g.nroViajeDelfos || "").trim());
      if (sinViaje.length) {
        setError(
          `Estos gastos no tienen Nº viaje Delfos: ${sinViaje.map((g) => g.codigo).join(", ")}. Destildalos o cargales el viaje antes de aprobar en lote.`,
        );
        return;
      }
    }
    const viajes = [...new Set(elegidos.map((g) => g.nroViajeDelfos).filter(Boolean))];
    const ok = await confirm({
      title: "Aprobar gastos",
      message:
        `Vas a aprobar ${elegidos.length} gasto${elegidos.length === 1 ? "" : "s"} pendiente${elegidos.length === 1 ? "" : "s"}.` +
        (viajes.length ? `\nViaje${viajes.length === 1 ? "" : "s"}: ${viajes.join(", ")}` : "") +
        `\n\nEl rechazo sigue siendo de a uno.`,
      confirmLabel: "Aprobar seleccionados",
    });
    if (!ok) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await decidirGastosRendicionLote(elegidos.map((g) => g.id));
      setSelectedIds([]);
      setDetalle(null);
      if (res.erroresCount > 0) {
        setError(
          `Aprobé ${res.aprobadosCount}. No pude aprobar ${res.erroresCount}: ${res.errores
            .map((e) => e.error)
            .slice(0, 3)
            .join(" · ")}`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude aprobar la selección");
    } finally {
      setBulkBusy(false);
    }
  }

  function usarSugerencia(s: SugerenciaViajeRemito) {
    // Hoja de ruta: prellena Nº Delfos (sigue siendo editable / confirmable).
    if (s.tipo === "hoja_ruta" && s.nroViajeDelfos) {
      setNroViajeDraft(String(s.nroViajeDelfos));
    }
    setDetalle((cur) =>
      cur
        ? {
            ...cur,
            remitoRef: s.tipo === "hoja_ruta" ? cur.remitoRef : s.nroRemito || cur.remitoRef,
            remitoId: s.tipo === "hoja_ruta" ? cur.remitoId : s.remitoId,
            patente: s.patente || cur.patente,
            nroViajeDelfos:
              s.tipo === "hoja_ruta" && s.nroViajeDelfos
                ? String(s.nroViajeDelfos)
                : cur.nroViajeDelfos,
          }
        : cur,
    );
    if (detalle && s.tipo !== "hoja_ruta") {
      void patchGastoRendicion(detalle.id, {
        remito_ref: s.nroRemito,
        remito_id: s.remitoId,
      }).catch(() => {});
    }
    if (detalle && s.tipo === "hoja_ruta" && s.nroViajeDelfos) {
      void patchGastoRendicion(detalle.id, {
        nro_viaje_delfos: String(s.nroViajeDelfos),
      }).catch(() => {});
    }
  }

  async function guardarImporte(monto: number) {
    if (!detalle) return;
    if (!editorNombre) throw new Error("No hay sesión para registrar quién cambia el importe");
    const updated = await patchGastoRendicion(detalle.id, {
      monto,
      editado_por: editorNombre,
    });
    setDetalle(updated);
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function actualizarTc(tc: number, montoClp?: number) {
    if (!detalle) return;
    const origen =
      montoClp != null && Number.isFinite(montoClp)
        ? montoClp
        : detalle.montoOrigen ?? undefined;
    const updated = await patchGastoRendicion(detalle.id, {
      tc_clp_ars: tc,
      tc_fuente: "manual",
      moneda_origen: "CLP",
      monto_origen: origen,
    });
    setDetalle(updated);
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function descargarExcel(formato: "mesa" | "erp") {
    setExcelBusy(formato);
    setError(null);
    try {
      const estado =
        formato === "erp" && exportParams.estado === "pendiente_aprobacion"
          ? "aprobado"
          : exportParams.estado;
      const url = rendicionExportUrl({ ...exportParams, formato, estado });
      const day = new Date().toISOString().slice(0, 10);
      await downloadAuthenticatedFile(url, `Rendiciones_${formato}_${day}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el Excel");
    } finally {
      setExcelBusy(null);
    }
  }

  async function enviarAlErp() {
    const estadoErp =
      exportParams.estado === "pendiente_aprobacion" || !exportParams.estado
        ? "aprobado"
        : exportParams.estado;

    const ok = await confirm({
      title: "Enviar al ERP (demo)",
      message:
        estadoErp === "aprobado"
          ? "Va a simular el envío de gastos aprobados al ERP.\nNo conecta con un sistema real todavía."
          : `Va a simular el envío de gastos en estado “${estadoErp}” al ERP.\nNo conecta con un sistema real todavía.`,
      confirmLabel: "Simular envío",
    });
    if (!ok) return;

    setErpBusy(true);
    setError(null);
    try {
      const res = await enviarRendicionErp({
        estado: estadoErp,
        q: exportParams.q,
        desde: exportParams.desde,
        hasta: exportParams.hasta,
        limit: 5000,
      });
      const preview =
        res.preview?.length > 0
          ? `\n\nPreview:\n${res.preview
              .map((p) => `· ${p.codigo} · ${p.chofer || "—"} · $${p.monto}`)
              .join("\n")}`
          : "";
      await confirm({
        title: res.enviados > 0 ? "Envío simulado OK" : "Sin gastos para enviar",
        message: `${res.mensaje}\n\nJob: ${res.jobId}\nEndpoint: ${res.endpointSimulado}${preview}`,
        alert: true,
        confirmLabel: "Entendido",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude simular el envío al ERP");
    } finally {
      setErpBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>

      <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-900/5 via-sky-900/5 to-slate-900/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-[200px] flex-1">
            <p className="inline-flex rounded-md border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-700">
              Tipo de cambio CLP → ARS
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {cotiz
                ? `1 peso chileno = ${Number(cotiz.valor).toLocaleString("es-AR", {
                    maximumFractionDigits: 4,
                  })} ARS`
                : cotizBusy
                  ? "Cargando cotización…"
                  : "Sin cotización"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {cotiz?.fuente ? `Fuente: ${cotiz.fuente}` : "DolarAPI"}
              {cotiz?.fecha ? ` · ${fmtFecha(cotiz.fecha)}` : ""}
              {" · "}Editable por gasto en el detalle si el ticket es CLP
            </p>
            {cotizError && (
              <p className="mt-1 text-xs text-rose-400">{cotizError}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 p-1.5 shadow-inner">
            <label className="block pl-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cotización
              <input
                type="number"
                step="0.0001"
                min="0"
                value={cotizDraft}
                onChange={(e) => setCotizDraft(e.target.value)}
                disabled={cotizBusy}
                className="mt-1 w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </label>
            <button
              type="button"
              disabled={cotizBusy}
              onClick={() => {
                const n = Number(String(cotizDraft).replace(",", "."));
                if (!Number.isFinite(n) || n <= 0) {
                  setCotizError("Ingresá una cotización válida");
                  return;
                }
                setCotiz((c) =>
                  c
                    ? {
                        ...c,
                        valor: n,
                        compra: n,
                        venta: n,
                        fuente: "manual",
                        fecha: new Date().toISOString(),
                        label: `1 CLP = ${n} ARS`,
                      }
                    : {
                        moneda: "CLP",
                        quote: "ARS",
                        valor: n,
                        compra: n,
                        venta: n,
                        fuente: "manual",
                        fecha: new Date().toISOString(),
                        label: `1 CLP = ${n} ARS`,
                      },
                );
                setCotizError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-[#fff] shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              Usar este TC
            </button>
            <button
              type="button"
              disabled={cotizBusy}
              onClick={() => void loadCotiz(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Actualizar desde DolarAPI"
            >
              <RefreshCw size={14} className={cotizBusy ? "animate-spin" : undefined} />
              Actualizar API
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-800 shadow-sm">
        <div
          className="mb-4 flex w-full max-w-md gap-1 rounded-2xl bg-slate-200/70 p-1.5 shadow-inner"
          role="tablist"
          aria-label="Vista de rendición"
        >
          {(
            [
              ["cola", "Cola de aprobación"],
              ["viajes", "Por viaje"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              onClick={() => setVista(id)}
              className={clsx(
                "flex-1 rounded-xl px-4 py-2 text-sm transition",
                vista === id
                  ? "bg-white font-semibold text-indigo-900 shadow-sm"
                  : "font-medium text-slate-600 hover:bg-white/40 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">
              {vista === "viajes" ? "Anticipo vs rendido" : "Cola de aprobación"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {vista === "viajes"
                ? "Por Nº viaje Delfos: anticipo de la hoja vs boletas (pendientes + aprobadas) · usá la pestaña de arriba para volver a la cola"
                : "Clic en un registro para abrir el detalle · Excel / Excel ERP exportan el filtro (ERP usa aprobados si estás en Pendientes)"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vista === "cola" &&
              (
                [
                  ["pendiente_aprobacion", "Pendientes"],
                  ["aprobado", "Aprobados"],
                  ["rechazado", "Rechazados"],
                  ["todos", "Todos"],
                ] as const
              ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={clsx(
                  "rounded-xl border px-3.5 py-1.5 text-xs",
                  filtro === id
                    ? "border-indigo-200 bg-indigo-50 font-semibold text-indigo-700 shadow-sm"
                    : "border-slate-200 bg-slate-50 font-medium text-slate-600 hover:bg-slate-100",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void (vista === "viajes" ? loadViajes() : load())}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
            {vista === "cola" && (
              <>
                <button
                  type="button"
                  disabled={!!excelBusy}
                  onClick={() => void descargarExcel("mesa")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100/80 disabled:opacity-50"
                  title="Descarga el filtro actual en Excel (mesa)"
                >
                  <Download size={14} />
                  {excelBusy === "mesa" ? "Bajando…" : "Excel"}
                </button>
                <button
                  type="button"
                  disabled={!!excelBusy}
                  onClick={() => void descargarExcel("erp")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100/80 disabled:opacity-50"
                  title="Planilla lista para liquidar / importar al ERP (aprobados si el filtro es pendientes)"
                >
                  <Download size={14} />
                  {excelBusy === "erp" ? "Bajando…" : "Excel ERP"}
                </button>
                <button
                  type="button"
                  disabled={erpBusy}
                  onClick={() => void enviarAlErp()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-[#fff] shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  title="Simula el envío de gastos aprobados al ERP (demo, no es integración real)"
                >
                  <Send size={14} className={erpBusy ? "animate-pulse" : undefined} />
                  {erpBusy ? "Enviando…" : "Enviar al ERP"}
                </button>
              </>
            )}
          </div>
        </div>

        {vista === "viajes" ? (
          <>
            {error && (
              <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}
            {viajesLoading ? (
              <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
            ) : viajes.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">
                Todavía no hay viajes con hoja o gastos con Nº Delfos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="text-xs uppercase text-[var(--text-faint)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 pr-3 font-medium">Viaje Delfos</th>
                      <th className="py-2 pr-3 font-medium">Chofer</th>
                      <th className="py-2 pr-3 font-medium">Hoja</th>
                      <th className="py-2 pr-3 font-medium">Anticipo</th>
                      <th className="py-2 pr-3 font-medium">Rendido</th>
                      <th className="py-2 pr-3 font-medium">Aprobado</th>
                      <th className="py-2 pr-3 font-medium">Saldo (vs rendido)</th>
                      <th className="py-2 font-medium">Gastos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viajes.map((v) => (
                      <tr
                        key={v.nroViajeDelfos}
                        onClick={() => {
                          setVista("cola");
                          setFiltro("todos");
                          setQInput(v.nroViajeDelfos);
                          setQ(v.nroViajeDelfos);
                        }}
                        className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                        title="Ver gastos de este viaje en la cola"
                      >
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-emerald-300">
                          {v.nroViajeDelfos}
                        </td>
                        <td className="max-w-[140px] truncate py-3 pr-3 text-[var(--text-dim)]">
                          {v.choferNombre || "—"}
                        </td>
                        <td className="py-3 pr-3 text-[var(--text-dim)]">
                          {v.hojaCodigo || "—"}
                        </td>
                        <td className="py-3 pr-3 font-semibold tabular-nums text-slate-900">{v.anticipoLabel}</td>
                        <td className="py-3 pr-3 font-semibold tabular-nums text-slate-900">{v.montoRendidoLabel}</td>
                        <td className="py-3 pr-3 tabular text-[var(--text-dim)]">
                          {v.montoAprobadoLabel}
                        </td>
                        <td
                          className={clsx(
                            "py-3 pr-3 tabular font-semibold",
                            v.saldoVsRendido < 0
                              ? "text-rose-400"
                              : v.saldoVsRendido > 0
                                ? "text-emerald-400"
                                : "text-white",
                          )}
                        >
                          {v.saldoVsRendidoLabel}
                        </td>
                        <td className="py-3 text-xs text-[var(--text-dim)]">
                          {v.cantidadGastos} · {v.cantidadPendientes} pend ·{" "}
                          {v.cantidadAprobados} OK
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1 text-xs text-[var(--text-dim)]">
            Buscar
            <span className="relative mt-1.5 block">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Remito, chofer o patente…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-dim)]">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--text-dim)]">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        {pendientesVisibles.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={todosMarcados}
                onChange={toggleTodosPendientes}
                disabled={bulkBusy}
                aria-label="Seleccionar todos los pendientes visibles"
                className="size-4 accent-emerald-500"
              />
              Seleccionar todos ({pendientesVisibles.length})
            </label>
            <button
              type="button"
              disabled={bulkBusy || selectedPendientes.length === 0}
              onClick={() => void aprobarSeleccionados()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Check size={14} />
              {bulkBusy
                ? "Aprobando…"
                : `Aprobar seleccionados${selectedPendientes.length ? ` (${selectedPendientes.length})` : ""}`}
            </button>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">No hay gastos en este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-8 py-2 pr-2 font-medium">
                    <span className="sr-only">Selección</span>
                  </th>
                  <th className="py-2 pr-3 font-medium">Código</th>
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Chofer</th>
                  <th className="py-2 pr-3 font-medium">Categoría</th>
                  <th className="py-2 pr-3 font-medium">Monto</th>
                  <th className="py-2 pr-3 font-medium">Viaje Delfos</th>
                  <th className="py-2 pr-3 font-medium">Detalle</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setDetalle(g)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                  >
                    <td className="py-3 pr-2" onClick={(e) => e.stopPropagation()}>
                      {g.estado === "pendiente_aprobacion" ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(g.id)}
                          onChange={() => toggleSeleccion(g.id)}
                          disabled={bulkBusy}
                          aria-label={`Seleccionar ${g.codigo}`}
                          className="size-4 accent-emerald-500"
                        />
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-indigo-900">{g.codigo}</td>
                    <td className="whitespace-nowrap py-3 pr-3 tabular text-[var(--text-dim)]">
                      {fmtFechaCola(g)}
                    </td>
                    <td className="max-w-[140px] truncate py-3 pr-3 text-[var(--text-dim)]">
                      {g.choferNombre || "—"}
                    </td>
                    <td className="py-3 pr-3 text-[var(--text-dim)]">{g.categoriaLabel}</td>
                    <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => abrirComprobante(g)}
                        className="inline-flex items-center gap-1.5 font-bold tabular-nums text-slate-900 hover:text-indigo-600"
                        title={g.imagenUrl ? "Ver comprobante" : "Sin comprobante"}
                      >
                        {g.montoLabel}
                        {g.monedaOrigen === "CLP" && g.montoOrigenLabel ? (
                          <span className="ml-1 text-[11px] font-normal text-sky-600">
                            ({g.montoOrigenLabel})
                          </span>
                        ) : null}
                        {g.imagenUrl ? (
                          <ImageIcon size={14} className="text-[var(--text-faint)]" />
                        ) : null}
                      </button>
                    </td>
                    <td className="max-w-[110px] truncate py-3 pr-3 tabular text-[var(--text-dim)]">
                      {g.nroViajeDelfos || (
                        <span className="text-[var(--text-faint)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate py-3 pr-3 text-[var(--text-dim)]">
                      {g.proveedor || g.descripcion || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          g.estado === "pendiente_aprobacion" && "border-amber-200 bg-amber-50 text-amber-700",
                          g.estado === "aprobado" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                          g.estado === "rechazado" && "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {g.estadoLabel}
                      </span>
                    </td>
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      {g.estado === "pendiente_aprobacion" ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === g.id || bulkBusy}
                            onClick={() => void decidir(g, "aprobado")}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-[#fff] disabled:opacity-50"
                          >
                            <Check size={14} />
                            OK
                          </button>
                          <button
                            type="button"
                            disabled={busyId === g.id || bulkBusy}
                            onClick={() => void decidir(g, "rechazado")}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-[#fff] disabled:opacity-50"
                          >
                            <X size={14} />
                            No
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </div>

      {detalle && (
        <GastoDetalleModal
          caso={detalle}
          busyId={busyId}
          rules={rules}
          sugerencias={sugerencias}
          sugerenciasNota={sugerenciasNota}
          nroViajeDraft={nroViajeDraft}
          onNroViajeDraft={setNroViajeDraft}
          onUsarSugerencia={usarSugerencia}
          onClose={() => setDetalle(null)}
          onVerFoto={() => abrirComprobante(detalle)}
          onDecidir={(estado) => void decidir(detalle, estado)}
          onActualizarTc={actualizarTc}
          onGuardarImporte={guardarImporte}
          editorNombre={editorNombre}
          tcVigente={cotiz?.valor ?? null}
        />
      )}

      {rechazoTarget && (
        <RechazoMotivoModal
          caso={rechazoTarget}
          busy={busyId === rechazoTarget.id}
          onClose={() => setRechazoTarget(null)}
          onConfirm={(nota) => void decidir(rechazoTarget, "rechazado", nota)}
        />
      )}

      <RemitoImageLightbox
        src={foto?.src ?? ""}
        alt={foto?.title ?? "Comprobante"}
        open={!!foto}
        onClose={() => setFoto(null)}
      />
    </div>
  );
}
