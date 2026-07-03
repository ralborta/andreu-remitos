/** Tipo de maestro en parámetros para un campo editable del remito. */
export type MaestroTipo = "chofer" | "tractor" | "acoplado" | "origen" | "destino";

const CAMPO_MAESTRO: Record<string, MaestroTipo> = {
  conductor: "chofer",
  chofer: "chofer",
  chasis: "tractor",
  patente_chasis: "tractor",
  tractor: "tractor",
  acoplado: "acoplado",
  patente_acoplado: "acoplado",
  semi: "acoplado",
  procedencia: "origen",
  origen: "origen",
  destino: "destino",
};

export function maestroTipoCampo(campo: string): MaestroTipo | null {
  return CAMPO_MAESTRO[campo] ?? null;
}

export function campoUsaMaestros(campo: string) {
  return campo in CAMPO_MAESTRO;
}
