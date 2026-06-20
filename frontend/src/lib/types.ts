export type Tenant = "tsb" | "beraldi";

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
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface RemitoListItem extends RemitoRow {}
