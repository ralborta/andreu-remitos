/** Marca del demo SOL (rama `demo`). Andreu prod usa otra rama. */
export const BRAND = {
  /** sol | andreu — separa reglas de negocio entre productos. */
  productId: "sol",
  name: "SOL",
  shortName: "SOL",
  tagline: "Logística",
  logoPath: "/brand/sol-logistica.png",
  productName: "TransitOne",
  productLogoPath: "/brand/transitone-logo.png",
  remitoTenantSlug: "tsb",
  remitoTenantLabel: "TransitOne",
  productLine: "Mesa de control",
  features: {
    /** Solo Andreu: no aprobar gasto sin nº viaje Delfos confirmado. */
    rendicionRequireNroViajeDelfos: false,
  },
};
