export interface PlanillaColumn {
  key: string;
  header: string;
  width?: number;
}

export interface PlanillaFila {
  remito_id?: string;
  nro_viaje: number;
  orden: number;
  fecha_inicio: string;
  tipo_viaje: string;
  producto: string;
  nro_documento: string;
  coef_distrib: string;
  suc_origen: string;
  nro_cta_origen: string;
  dir_entrega_origen: string;
  razon_social_origen: string;
  id_camion: string;
  nro_op: string;
  nro_cta_destino: string;
  dir_entrega_destino: string;
  razon_social_destino: string;
  producto_pla: string;
  cantidad: string;
  hora_inicio: string;
  fecha_fin: string;
  hora_fin: string;
  tractor_patente: string;
  semi_patente: string;
  chofer: string;
  unidad_medida: string;
  [key: string]: string | number | undefined;
}

export interface PlanillaTsbResponse {
  tenant: string;
  formato: string;
  tipo_viaje: string;
  columnas: PlanillaColumn[];
  filas: PlanillaFila[];
  meta: {
    remitos: number;
    filas: number;
    desde: string | null;
    hasta: string | null;
  };
}

export type TipoViajeTsb = "ARENA" | "GNL" | "Corta Distancia";

export const TIPOS_VIAJE_TSB: TipoViajeTsb[] = ["ARENA", "GNL", "Corta Distancia"];
