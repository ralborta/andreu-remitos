/** Marca del demo SOL (rama `demo`). Andreu prod usa otra rama. */
export const BRAND = {
  /** Empresa / marca principal (logo). */
  name: "SOL",
  shortName: "SOL",
  tagline: "Logística",
  /** Producto secundario — se muestra más chico bajo el logo. */
  productName: "TransitOne",
  /** Un solo cliente de remitos; pipeline Document AI = TSB. */
  remitoTenantSlug: "tsb" as const,
  remitoTenantLabel: "TransitOne",
  logoPath: "/brand/sol-logistica.png",
  productLine: "Mesa de control",
  primary: "#0a1628",
  accent: "#00b8c4",
};
