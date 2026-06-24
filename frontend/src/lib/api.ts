import type { RemitoRow } from "./types";

const PLACEHOLDER_RE =
  /CAMBIAR|url-publica|tu-api|ejemplo|placeholder|localhost:3001/i;

function isUsableApiUrl(url: string | undefined): url is string {
  if (!url?.startsWith("http")) return false;
  if (PLACEHOLDER_RE.test(url)) return false;
  return true;
}

/** En Easypanel: navegador usa /backend → API_INTERNAL_URL (runtime). */
export function apiBase() {
  if (typeof window !== "undefined") {
    const pub = process.env.NEXT_PUBLIC_API_URL;
    if (isUsableApiUrl(pub)) return pub.replace(/\/$/, "");
    return "/backend";
  }
  const internal = process.env.API_INTERNAL_URL;
  if (internal) return internal.replace(/\/$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (isUsableApiUrl(pub)) return pub.replace(/\/$/, "");
  return "http://localhost:3001";
}

export function apiBaseLabel() {
  return apiBase();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { error?: string }).error;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function imagenUrl(id: string) {
  return `${apiBase()}/api/remitos/${id}/imagen`;
}

export function listRemitos(params?: { tenant?: string; estado?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.tenant) q.set("tenant", params.tenant);
  if (params?.estado) q.set("estado", params.estado);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<RemitoRow[]>(`/api/remitos${qs ? `?${qs}` : ""}`);
}

export function getRemito(id: string) {
  return api<RemitoRow>(`/api/remitos/${id}`);
}

export function patchRemitoCampos(id: string, body: Record<string, unknown>) {
  return api<RemitoRow>(`/api/remitos/${id}/campos`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function ingestRemito(file: File, tenant: string, telefono?: string) {
  const fd = new FormData();
  fd.append("tenant", tenant);
  fd.append("file", file);
  if (telefono) fd.append("telefono", telefono);
  return api<RemitoRow & { lectura?: unknown }>("/api/remitos/ingest", {
    method: "POST",
    body: fd,
  });
}

export function healthCheck() {
  return api<{ ok: boolean; service: string }>("/health");
}
