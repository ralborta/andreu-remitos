/** Marca del demo SOL (rama `demo`). Andreu prod usa otra rama. */
export const BRAND = {
  /** Empresa / marca (header derecha). */
  name: "SOL",
  shortName: "SOL",
  tagline: "Logística",
  logoPath: "/brand/sol-logistica.png",
  /** Producto (sidebar / login bajo SOL). */
  productName: "Empliados",
  productLogoPath: "/brand/empliados-logo.png",
  /** Un solo cliente de remitos; pipeline Document AI = TSB. */
  remitoTenantSlug: "tsb" as const,
  remitoTenantLabel: "TransitOne",
  productLine: "Mesa de control",
  primary: "#0a1628",
  accent: "#00b8c4",
};
