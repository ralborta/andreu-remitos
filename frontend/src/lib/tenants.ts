export type TenantSlug = "tsb" | "beraldi" | "corina";

export interface TenantConfig {
  slug: TenantSlug;
  name: string;
  short: string;
  description: string;
  color: string;
  whatsappHint: string;
  active: boolean;
}

/** Clientes con remitos — agregar acá cuando haya otro transporte */
export const REMITO_TENANTS: TenantConfig[] = [
  {
    slug: "tsb",
    name: "TSB",
    short: "TSB",
    description: "Guías de transporte TSB — campos manuscritos + 5 horas",
    color: "#38bdf8",
    whatsappHint: "Foto de guía TSB",
    active: true,
  },
  {
    slug: "beraldi",
    name: "Beraldi",
    short: "Beraldi",
    description: "Remitos Beraldi — conductor, patentes y horarios",
    color: "#a78bfa",
    whatsappHint: "Foto de remito Beraldi",
    active: true,
  },
  {
    slug: "corina",
    name: "Corina",
    short: "Corina",
    description: "Remitos Quilmes / local — tractor, semi, origen, destino y bultos",
    color: "#fb923c",
    whatsappHint: "Foto de remito Quilmes",
    active: true,
  },
];

export function getTenant(slug: string): TenantConfig | undefined {
  return REMITO_TENANTS.find((t) => t.slug === slug && t.active);
}

export function isTenantSlug(slug: string): slug is TenantSlug {
  return REMITO_TENANTS.some((t) => t.slug === slug && t.active);
}

export function tenantColor(slug: string) {
  return getTenant(slug)?.color ?? "#a79fc9";
}
