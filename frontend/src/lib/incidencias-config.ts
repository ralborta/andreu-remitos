/**
 * Config local del módulo Incidencias (UI + persistencia en navegador).
 * Fase 1: engranaje en panel. Backend WA puede leer esto más adelante vía API.
 */

export type TonoWhatsapp = "cordial" | "amigable" | "formal";

export type IncidenciaTipoKey =
  | "parada_no_prevista"
  | "desvio_ruta"
  | "demora"
  | "pinchazo"
  | "mecanico"
  | "control"
  | "accidente"
  | "anomalia"
  | "otro";

export type IncidenciasModuloConfig = {
  /** Minutos antes del recordatorio WA si no responde. */
  recordatorioMin: number;
  /** Minutos antes de cierre automático. */
  cierreMin: number;
  /** Zona horaria de fechas/SLA (solo display por ahora). */
  zonaHoraria: string;
  /** Formato de fecha en mensajes y UI. */
  formatoFecha: "DD/MM/YYYY" | "YYYY-MM-DD";
  /** Tono del saludo / mensajes al chofer. */
  tonoWhatsapp: TonoWhatsapp;
  /** Texto base del saludo (se combina con el tono). */
  saludoWhatsapp: string;
  /** Tipos de servicio/incidencia habilitados para el flujo. */
  tiposHabilitados: IncidenciaTipoKey[];
};

export const INCIDENCIA_TIPO_OPTIONS: { key: IncidenciaTipoKey; label: string }[] = [
  { key: "parada_no_prevista", label: "Parada no prevista" },
  { key: "desvio_ruta", label: "Desvío de ruta" },
  { key: "demora", label: "Demora" },
  { key: "pinchazo", label: "Pinchazo / llanta" },
  { key: "mecanico", label: "Problema mecánico" },
  { key: "control", label: "Control / policía" },
  { key: "accidente", label: "Accidente" },
  { key: "anomalia", label: "Anomalía" },
  { key: "otro", label: "Otro" },
];

export const TONO_WHATSAPP_OPTIONS: { key: TonoWhatsapp; label: string; hint: string }[] = [
  {
    key: "cordial",
    label: "Cordial",
    hint: "Respetuoso y claro, sin exceso de informalidad",
  },
  {
    key: "amigable",
    label: "Amigable",
    hint: "Cálido y cercano, con emoji ligero",
  },
  {
    key: "formal",
    label: "Formal",
    hint: "Más corporativo, sin emojis",
  },
];

export const DEFAULT_INCIDENCIAS_CONFIG: IncidenciasModuloConfig = {
  recordatorioMin: 5,
  cierreMin: 10,
  zonaHoraria: "America/Argentina/Buenos_Aires",
  formatoFecha: "DD/MM/YYYY",
  tonoWhatsapp: "amigable",
  saludoWhatsapp: "Hola, ¿cómo estás?",
  tiposHabilitados: INCIDENCIA_TIPO_OPTIONS.map((t) => t.key),
};

const STORAGE_KEY = "sol.incidencias.config.v1";

export function loadIncidenciasConfig(): IncidenciasModuloConfig {
  if (typeof window === "undefined") return { ...DEFAULT_INCIDENCIAS_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INCIDENCIAS_CONFIG };
    const parsed = JSON.parse(raw) as Partial<IncidenciasModuloConfig>;
    return {
      ...DEFAULT_INCIDENCIAS_CONFIG,
      ...parsed,
      tiposHabilitados:
        Array.isArray(parsed.tiposHabilitados) && parsed.tiposHabilitados.length > 0
          ? parsed.tiposHabilitados
          : DEFAULT_INCIDENCIAS_CONFIG.tiposHabilitados,
    };
  } catch {
    return { ...DEFAULT_INCIDENCIAS_CONFIG };
  }
}

export function saveIncidenciasConfig(cfg: IncidenciasModuloConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** Vista previa del saludo según tono (para el modal). */
export function previewSaludoWhatsapp(cfg: Pick<IncidenciasModuloConfig, "tonoWhatsapp" | "saludoWhatsapp">) {
  const base = (cfg.saludoWhatsapp || DEFAULT_INCIDENCIAS_CONFIG.saludoWhatsapp).trim();
  if (cfg.tonoWhatsapp === "formal") {
    return `${base.replace(/👋/g, "").trim()}\n\nDetectamos que la unidad está detenida. ¿Podés indicarnos el motivo, por favor?`;
  }
  if (cfg.tonoWhatsapp === "cordial") {
    return `${base}\n\nVimos que estás parado. ¿Nos contás por qué, por favor? Gracias.`;
  }
  return `${base} 👋\n\nDetectamos que estás *parado*. ¿Me contás por qué?`;
}
