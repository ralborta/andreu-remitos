import type { BRAND as BrandConfig } from "./brand";
import { BRAND } from "./brand";

export type TenantSlug = typeof BRAND.remitoTenantSlug;

export interface TenantConfig {
  slug: TenantSlug;
  name: string;
  short: string;
  description: string;
  color: string;
  whatsappHint: string;
  active: boolean;
}

/** Demo: una sola empresa de remitos (TransitOne). Pipeline OCR = TSB. */
export const REMITO_TENANTS: TenantConfig[] = [
  {
    slug: BRAND.remitoTenantSlug,
    name: BRAND.remitoTenantLabel,
    short: BRAND.shortName,
    description: "Guías de transporte — campos manuscritos + 5 horas de control",
    color: BRAND.accent,
    whatsappHint: "Foto de guía / remito SOL · TransitOne",
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
  return getTenant(slug)?.color ?? BRAND.accent;
}

export function tenantDisplayName(slug: string) {
  return getTenant(slug)?.name ?? BRAND.remitoTenantLabel;
}
