import type { PlanillaTsbResponse } from "./planilla-types";
import type { RemitoRow } from "./types";
import type { Conversacion, ConversacionListItem } from "./conversaciones-types";
import type { Chofer, Distancia, Localidad, Unidad } from "./parametros-types";

const PLACEHOLDER_RE =
  /CAMBIAR|url-publica|tu-api|ejemplo|placeholder|localhost:3001/i;

function isUsableApiUrl(url: string | undefined): url is string {
  if (!url?.startsWith("http")) return false;
  if (PLACEHOLDER_RE.test(url)) return false;
  return true;
}

/** En Easypanel: URL pública de la API (CORS habilitado). Local: .env.local */
export function apiBase() {
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (isUsableApiUrl(pub)) return pub.replace(/\/$/, "");
  if (typeof window !== "undefined") return "/backend";
  const internal = process.env.API_INTERNAL_URL;
  if (internal) return internal.replace(/\/$/, "");
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

export function listConversaciones(params?: { tenant?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.tenant) q.set("tenant", params.tenant);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<ConversacionListItem[]>(`/api/conversaciones${qs ? `?${qs}` : ""}`);
}

export function getConversacion(telefono: string) {
  return api<Conversacion>(`/api/conversaciones/${telefono}`);
}

export function enviarMensajeConversacion(
  telefono: string,
  body: { texto: string; nota_interna?: boolean },
) {
  return api<{ ok: boolean; sent: boolean; conversacion: Conversacion }>(
    `/api/conversaciones/${telefono}/mensajes`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function setBotPausado(telefono: string, pausado: boolean) {
  return api<Conversacion>(`/api/conversaciones/${telefono}/bot-pausado`, {
    method: "PATCH",
    body: JSON.stringify({ pausado }),
  });
}

function qParametros(tenant?: string, extra?: Record<string, string>) {
  const q = new URLSearchParams();
  if (tenant) q.set("tenant", tenant);
  if (extra) for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export function listChoferes(tenant?: string) {
  return api<Chofer[]>(`/api/parametros/choferes${qParametros(tenant)}`);
}

export function createChofer(body: Omit<Chofer, "id" | "created_at" | "updated_at">) {
  return api<Chofer>("/api/parametros/choferes", { method: "POST", body: JSON.stringify(body) });
}

export function updateChofer(id: string, body: Partial<Chofer>) {
  return api<Chofer>(`/api/parametros/choferes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteChofer(id: string) {
  return api<{ ok: boolean }>(`/api/parametros/choferes/${id}`, { method: "DELETE" });
}

export function listUnidades(tenant?: string, tipo?: string) {
  return api<Unidad[]>(`/api/parametros/unidades${qParametros(tenant, tipo ? { tipo } : undefined)}`);
}

export function createUnidad(body: Omit<Unidad, "id" | "created_at" | "updated_at">) {
  return api<Unidad>("/api/parametros/unidades", { method: "POST", body: JSON.stringify(body) });
}

export function updateUnidad(id: string, body: Partial<Unidad>) {
  return api<Unidad>(`/api/parametros/unidades/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteUnidad(id: string) {
  return api<{ ok: boolean }>(`/api/parametros/unidades/${id}`, { method: "DELETE" });
}

export function listLocalidades(tenant?: string) {
  return api<Localidad[]>(`/api/parametros/localidades${qParametros(tenant)}`);
}

export function createLocalidad(body: Omit<Localidad, "id" | "created_at" | "updated_at">) {
  return api<Localidad>("/api/parametros/localidades", { method: "POST", body: JSON.stringify(body) });
}

export function updateLocalidad(id: string, body: Partial<Localidad>) {
  return api<Localidad>(`/api/parametros/localidades/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteLocalidad(id: string) {
  return api<{ ok: boolean }>(`/api/parametros/localidades/${id}`, { method: "DELETE" });
}

export function listDistancias(tenant?: string) {
  return api<Distancia[]>(`/api/parametros/distancias${qParametros(tenant)}`);
}

export function createDistancia(body: Omit<Distancia, "id" | "created_at" | "updated_at" | "origen_nombre" | "destino_nombre">) {
  return api<Distancia>("/api/parametros/distancias", { method: "POST", body: JSON.stringify(body) });
}

export function updateDistancia(id: string, body: Partial<Distancia>) {
  return api<Distancia>(`/api/parametros/distancias/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteDistancia(id: string) {
  return api<{ ok: boolean }>(`/api/parametros/distancias/${id}`, { method: "DELETE" });
}

export function getPlanillaTsb(params?: {
  tipoViaje?: string;
  desde?: string;
  hasta?: string;
  estados?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.tipoViaje) q.set("tipoViaje", params.tipoViaje);
  if (params?.desde) q.set("desde", params.desde);
  if (params?.hasta) q.set("hasta", params.hasta);
  if (params?.estados) q.set("estados", params.estados);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<PlanillaTsbResponse>(`/api/planillas/tsb${qs ? `?${qs}` : ""}`);
}

export function planillaTsbExportUrl(params?: {
  tipoViaje?: string;
  desde?: string;
  hasta?: string;
  formato?: "delfos" | "proforma";
}) {
  const q = new URLSearchParams();
  if (params?.tipoViaje) q.set("tipoViaje", params.tipoViaje);
  if (params?.desde) q.set("desde", params.desde);
  if (params?.hasta) q.set("hasta", params.hasta);
  if (params?.formato) q.set("formato", params.formato);
  const qs = q.toString();
  return `${apiBase()}/api/planillas/tsb/export${qs ? `?${qs}` : ""}`;
}
