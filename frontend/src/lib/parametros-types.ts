export type TenantSlug = "tsb" | "beraldi" | "corina";

export interface ParametroBase {
  id: string;
  tenant: TenantSlug;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Chofer extends ParametroBase {
  nombre: string;
  telefono: string | null;
  documento: string | null;
}

export type UnidadTipo = "tractor" | "acoplado";

export interface Unidad extends ParametroBase {
  tipo: UnidadTipo;
  patente: string;
  unidad_interna: string | null;
}

export type LocalidadTipo = "origen" | "destino" | "ambos";

export interface Localidad extends ParametroBase {
  codigo: string | null;
  nombre: string;
  tipo: LocalidadTipo;
}

export interface Distancia extends ParametroBase {
  origen_id: string;
  destino_id: string;
  km: number;
  origen_nombre?: string;
  destino_nombre?: string;
}

export type ParametroTab = "choferes" | "unidades" | "localidades" | "distancias";
