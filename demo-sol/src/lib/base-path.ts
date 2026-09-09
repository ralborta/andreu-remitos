/** Base path de la app (Next basePath). */
export const DEMO_BASE_PATH = "/demo";

export function withBase(path: string): string {
  if (!path.startsWith("/")) return `${DEMO_BASE_PATH}/${path}`;
  return `${DEMO_BASE_PATH}${path}`;
}
