"use client";

import { useEffect, useState } from "react";
import { Settings2, X } from "lucide-react";
import {
  DEFAULT_INCIDENCIAS_CONFIG,
  INCIDENCIA_TIPO_OPTIONS,
  TONO_WHATSAPP_OPTIONS,
  loadIncidenciasConfig,
  previewSaludoWhatsapp,
  saveIncidenciasConfig,
  type IncidenciaTipoKey,
  type IncidenciasModuloConfig,
  type TonoWhatsapp,
} from "@/lib/incidencias-config";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (cfg: IncidenciasModuloConfig) => void;
};

const fieldCls =
  "rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--violet)]";

export function IncidenciasConfigModal({ open, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<IncidenciasModuloConfig>(DEFAULT_INCIDENCIAS_CONFIG);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(loadIncidenciasConfig());
    setSavedFlash(false);
  }, [open]);

  if (!open) return null;

  function toggleTipo(key: IncidenciaTipoKey) {
    setDraft((prev) => {
      const has = prev.tiposHabilitados.includes(key);
      const next = has
        ? prev.tiposHabilitados.filter((t) => t !== key)
        : [...prev.tiposHabilitados, key];
      return {
        ...prev,
        tiposHabilitados: next.length > 0 ? next : prev.tiposHabilitados,
      };
    });
  }

  function handleSave() {
    const cleaned: IncidenciasModuloConfig = {
      ...draft,
      recordatorioMin: Math.max(1, Math.min(60, Number(draft.recordatorioMin) || 5)),
      cierreMin: Math.max(2, Math.min(120, Number(draft.cierreMin) || 10)),
      saludoWhatsapp: draft.saludoWhatsapp.trim() || DEFAULT_INCIDENCIAS_CONFIG.saludoWhatsapp,
    };
    if (cleaned.cierreMin <= cleaned.recordatorioMin) {
      cleaned.cierreMin = cleaned.recordatorioMin + 5;
    }
    saveIncidenciasConfig(cleaned);
    setDraft(cleaned);
    setSavedFlash(true);
    onSaved?.(cleaned);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="incidencias-config-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-[var(--violet)]" />
            <h2 id="incidencias-config-title" className="font-semibold text-[var(--text)]">
              Configuración · Incidencias
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto scroll-thin px-4 py-4 text-sm">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Fechas y tiempos
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-dim)]">
                Recordatorio WA (min)
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.recordatorioMin}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, recordatorioMin: Number(e.target.value) }))
                  }
                  className={fieldCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-dim)]">
                Cierre automático (min)
                <input
                  type="number"
                  min={2}
                  max={120}
                  value={draft.cierreMin}
                  onChange={(e) => setDraft((d) => ({ ...d, cierreMin: Number(e.target.value) }))}
                  className={fieldCls}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-dim)]">
                Formato de fecha
                <select
                  value={draft.formatoFecha}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      formatoFecha: e.target.value as IncidenciasModuloConfig["formatoFecha"],
                    }))
                  }
                  className={fieldCls}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-dim)]">
                Zona horaria
                <select
                  value={draft.zonaHoraria}
                  onChange={(e) => setDraft((d) => ({ ...d, zonaHoraria: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="America/Argentina/Buenos_Aires">Argentina (ART)</option>
                  <option value="America/Santiago">Chile</option>
                  <option value="America/Sao_Paulo">Brasil (SP)</option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>
            <p className="text-[11px] text-[var(--text-faint)]">
              Si el chofer no responde: recordatorio a los {draft.recordatorioMin} min y cierre a los{" "}
              {draft.cierreMin} min.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              WhatsApp · saludo
            </h3>
            <p className="text-[11px] text-[var(--text-faint)]">
              Cordial y amable por defecto. El tono define cómo se arma el mensaje al chofer.
            </p>
            <div className="flex flex-wrap gap-2">
              {TONO_WHATSAPP_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, tonoWhatsapp: opt.key as TonoWhatsapp }))}
                  className={
                    draft.tonoWhatsapp === opt.key
                      ? "rounded-lg bg-[var(--violet)] px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--violet)]/40"
                  }
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-dim)]">
              Texto de saludo
              <input
                value={draft.saludoWhatsapp}
                onChange={(e) => setDraft((d) => ({ ...d, saludoWhatsapp: e.target.value }))}
                placeholder="Hola, ¿cómo estás?"
                className={fieldCls}
              />
            </label>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Vista previa
              </p>
              <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--text)]">
                {previewSaludoWhatsapp(draft)}
              </pre>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Tipos de servicio / incidencia
            </h3>
            <p className="text-[11px] text-[var(--text-faint)]">
              Activá los tipos que aplica este módulo. Por ahora se guardan en el navegador.
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {INCIDENCIA_TIPO_OPTIONS.map((t) => {
                const on = draft.tiposHabilitados.includes(t.key);
                return (
                  <label
                    key={t.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 hover:border-[var(--violet)]/35"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleTipo(t.key)}
                      className="accent-[var(--violet)]"
                    />
                    <span className="text-xs font-medium text-[var(--text)]">{t.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[11px] text-[var(--text-faint)]">
            {savedFlash ? "Guardado en este navegador." : "Solo UI por ahora · sin redeploy."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-2)]"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[var(--violet)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
