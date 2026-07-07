import type { RemitoMaestros } from "./useRemitoMaestros";

const cache = new Map<string, RemitoMaestros>();

export function getMaestrosCache(tenant: string) {
  return cache.get(tenant);
}

export function setMaestrosCache(tenant: string, data: RemitoMaestros) {
  cache.set(tenant, data);
}

export function invalidateMaestrosCache(tenant?: string) {
  if (tenant) cache.delete(tenant);
  else cache.clear();
}
