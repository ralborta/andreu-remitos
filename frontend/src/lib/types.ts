export type Tenant = "tsb" | "beraldi" | "corina" | "mye";

export type EstadoRemito =
  | "pendiente_revision"
  | "incompleto"
  | "bloqueado"
  | "confirmado"
  | "error_lectura";

export interface RemitoRow {
  id: string;
  tenant: Tenant;
  estado: EstadoRemito;
  telefono_chofer: string | null;
  imagen_path?: string;
  datos: Record<string, unknown>;
  validacion?: {
    valido?: boolean;
    faltantes?: string[];
    errores?: string[];
    advertencias?: string[];
    viaje_nocturno?: boolean;
  } | null;
  /** Motor OCR real: beraldi-foundation-v1 | openai-vision-beraldi | … */
  ocr_engine?: string | null;
  ocr_processor_id?: string | null;
  lectura_original?: {
    motor?: string | null;
    texto_len?: number;
    datos?: Record<string, unknown>;
  } | null;
  created_at?: string;
  updated_at?: string;
  procesado_at?: string;
}

export interface RemitoListItem extends RemitoRow {}
