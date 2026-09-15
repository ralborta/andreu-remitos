/**
 * Reglas de Rendición por producto (SOL vs Andreu).
 * Andreu exige confirmar nº viaje Delfos al aprobar; SOL no.
 *
 * Fuente de verdad: PRODUCT_PROFILE env → BRAND.productId → inferencia por BRAND.name.
 */
import { BRAND } from "./brand.mjs";

export function getProductId() {
  const env = String(process.env.PRODUCT_PROFILE || "")
    .trim()
    .toLowerCase();
  if (env === "andreu" || env === "sol") return env;
  const fromBrand = String(BRAND?.productId || "")
    .trim()
    .toLowerCase();
  if (fromBrand === "andreu" || fromBrand === "sol") return fromBrand;
  if (String(BRAND?.name || "").toUpperCase() === "SOL") return "sol";
  return "andreu";
}

/** Reglas runtime para store / API / UI (vía /meta). */
export function getRendicionRules() {
  const productId = getProductId();
  const isAndreu = productId === "andreu";

  return {
    productId,
    requireNroViajeDelfosOnApprove: isAndreu,
    suggestViajeFromRemitos: isAndreu,
    labelNroViaje: "Nº viaje Delfos",
    hintNroViaje:
      "Confirmá el número de viaje de Delfos. Los documentos pueden traer otros números que no sirven para anticipo/SAP.",
  };
}
