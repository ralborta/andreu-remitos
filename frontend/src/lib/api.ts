import type { PlanillaTsbResponse, PlanillaFormato } from "./planilla-types";
import type { TenantSlug } from "./tenants";
import type { RemitoRow } from "./types";
import type { Conversacion, ConversacionListItem } from "./conversaciones-types";
import type { Chofer, Distancia, Localidad, Unidad } from "./parametros-types";
import type { RolUsuario, SessionUser } from "./auth-types";
import type { MonitorStatus, MonitorWhatsappQr } from "./monitor-types";

const PLACEHOLDER_RE =
  /CAMBIAR|url-publica|tu-api|ejemplo|placeholder|localhost:3001/i;

function isUsableApiUrl(url: string | undefined): url is string {
  if (!url?.startsWith("http")) return false;
  if (PLACEHOLDER_RE.test(url)) return false;
  return true;
}

/** En el navegador siempre same-origin (/backend) para evitar CORS en errores del proxy. */
export function apiBase() {
  if (typeof window !== "undefined") return "/backend";
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
  let res: Response;
  const hasBody = init?.body != null && init.body !== "";
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(hasBody && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    throw new Error(
      msg === "Failed to fetch"
        ? "No se pudo contactar la API. Revisá conexión o que el servicio esté en línea."
        : msg,
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { error?: string; message?: string }).error ?? (err as { message?: string }).message;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function imagenUrl(id: string) {
  return `${apiBase()}/api/remitos/${id}/imagen`;
}

export function listRemitos(params?: { tenant?: string; estado?: string; pendientes?: boolean; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.tenant) q.set("tenant", params.tenant);
  if (params?.estado) q.set("estado", params.estado);
  if (params?.pendientes) q.set("pendientes", "true");
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

export type ProcesarRemitosResult = {
  procesados: { id: string; nro: string; tenant: string; estado: string }[];
  errores: { id: string; nro?: string; motivos: string[] }[];
  total: number;
};

export function procesarRemitos(ids: string[], tenant?: string) {
  return api<ProcesarRemitosResult>("/api/remitos/procesar", {
    method: "POST",
    body: JSON.stringify({ ids, tenant }),
  });
}

export function patchRemitoTenant(id: string, tenant: string) {
  return api<RemitoRow>(`/api/remitos/${id}/tenant`, {
    method: "PATCH",
    body: JSON.stringify({ tenant }),
  });
}

export function deleteRemito(id: string) {
  return api<{ id: string; eliminado: boolean }>(`/api/remitos/${id}`, { method: "DELETE" });
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

export function fetchMonitorStatus() {
  return api<MonitorStatus>("/api/monitor/status");
}

export function fetchMonitorWhatsappQr() {
  return api<MonitorWhatsappQr>("/api/monitor/whatsapp/qr");
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

/** Aviso "escribiendo…" al chofer en WhatsApp (fire-and-forget). */
export function enviarTypingConversacion(telefono: string) {
  void fetch(`${apiBase()}/api/conversaciones/${telefono}/typing`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});
}

export function setBotPausado(telefono: string, pausado: boolean) {
  return api<Conversacion>(`/api/conversaciones/${telefono}/bot-pausado`, {
    method: "PATCH",
    body: JSON.stringify({ pausado }),
  });
}

export function listUsuarios() {
  return api<{ users: SessionUser[] }>("/api/auth/users");
}

export function createUsuario(body: {
  username: string;
  password: string;
  nombre?: string;
  rol?: RolUsuario;
}) {
  return api<{ user: SessionUser }>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchUsuario(
  id: string,
  body: { rol?: RolUsuario; nombre?: string; activo?: boolean },
) {
  return api<{ user: SessionUser }>(`/api/auth/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
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

export function getPlanilla(
  tenant: TenantSlug,
  params?: {
    formato?: PlanillaFormato;
    tipoViaje?: string;
    desde?: string;
    hasta?: string;
    estados?: string;
    limit?: number;
  },
) {
  const q = new URLSearchParams();
  if (params?.formato) q.set("formato", params.formato);
  if (params?.tipoViaje) q.set("tipoViaje", params.tipoViaje);
  if (params?.desde) q.set("desde", params.desde);
  if (params?.hasta) q.set("hasta", params.hasta);
  if (params?.estados) q.set("estados", params.estados);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<PlanillaTsbResponse>(`/api/planillas/${tenant}${qs ? `?${qs}` : ""}`);
}

/** @deprecated use getPlanilla('tsb', ...) */
export function getPlanillaTsb(params?: Parameters<typeof getPlanilla>[1]) {
  return getPlanilla("tsb", params);
}

export function planillaExportUrl(
  tenant: TenantSlug,
  params?: {
    tipoViaje?: string;
    desde?: string;
    hasta?: string;
    formato?: PlanillaFormato;
  },
) {
  const q = new URLSearchParams();
  if (params?.tipoViaje) q.set("tipoViaje", params.tipoViaje);
  if (params?.desde) q.set("desde", params.desde);
  if (params?.hasta) q.set("hasta", params.hasta);
  if (params?.formato) q.set("formato", params.formato);
  const qs = q.toString();
  return `${apiBase()}/api/planillas/${tenant}/export${qs ? `?${qs}` : ""}`;
}

/** @deprecated use planillaExportUrl('tsb', ...) */
export function planillaTsbExportUrl(params?: Parameters<typeof planillaExportUrl>[1]) {
  return planillaExportUrl("tsb", params);
}

export interface GeocodeResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string | null;
  locationType?: string;
  partial?: boolean;
  inputRaw?: string;
  mode?: string;
}

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export function autocompleteDestino(input: string) {
  const q = encodeURIComponent(input.trim());
  if (!q) return Promise.resolve([] as AutocompleteSuggestion[]);
  return api<AutocompleteSuggestion[]>(`/api/destinos/autocomplete?input=${q}`);
}

export function geocodeDestino(body: {
  query: string;
  mode: "direccion" | "coordenadas";
  placeId?: string;
}) {
  return api<GeocodeResult>("/api/destinos/geocode", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface DestinoValidacion {
  id: string;
  estado: string;
  cliente: string | null;
  telefonoCliente: string;
  telefonoChofer: string | null;
  formattedAddress: string;
  lat: number;
  lng: number;
  partial?: boolean;
  correccion?: string;
  ultimaRespuestaCliente?: string | null;
  ultimaRespuestaChofer?: string | null;
  etaMinutos?: number | null;
  etaTexto?: string | null;
  etaAt?: string | null;
  historial: string[];
  whatsappSent?: boolean;
  mensajeCliente?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function validarDestino(body: {
  query: string;
  mode: "direccion" | "coordenadas";
  placeId?: string;
  cliente?: string;
  telefonoCliente: string;
  telefonoChofer?: string;
}) {
  return api<DestinoValidacion>("/api/destinos/validar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getDestino(id: string) {
  return api<DestinoValidacion>(`/api/destinos/${id}`);
}

export function listDestinos(params?: { limit?: number; estado?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  const qs = q.toString();
  return api<DestinoValidacion[]>(`/api/destinos${qs ? `?${qs}` : ""}`);
}

export type ViajeEstado =
  | "solicitado"
  | "confirmado"
  | "asignado"
  | "en_curso"
  | "entregado"
  | "cerrado"
  | "cancelado";

export interface Viaje {
  id: string;
  codigo: string;
  estado: ViajeEstado;
  estadoLabel: string;
  tenant: "tsb" | "beraldi" | "corina" | "mye" | null;
  cliente: string;
  origen: string;
  destino: string;
  carga: string | null;
  fecha: string | null;
  hora: string | null;
  tipoCarga: string | null;
  tipoUnidad: string | null;
  chofer: string | null;
  telefonoChofer: string | null;
  telefonoCliente: string | null;
  tractor: string | null;
  semi: string | null;
  notas: string | null;
  remitoIds: string[];
  destinoValidacionId: string | null;
  tmsId: string | null;
  tmsSyncStatus: string;
  tmsSyncedAt: string | null;
  historial: string[];
  transiciones: ViajeEstado[];
  createdAt?: string;
  updatedAt?: string;
}

export function listViajes(params?: { limit?: number; estado?: string; tenant?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  if (params?.tenant) q.set("tenant", params.tenant);
  const qs = q.toString();
  return api<Viaje[]>(`/api/viajes${qs ? `?${qs}` : ""}`);
}

export function createViaje(body: {
  cliente: string;
  origen: string;
  destino: string;
  carga?: string;
  fecha?: string;
  hora?: string;
  tipoCarga?: string;
  tipoUnidad?: string;
  tenant?: string;
  chofer?: string;
  telefonoChofer?: string;
  tractor?: string;
  semi?: string;
  notas?: string;
}) {
  return api<Viaje>("/api/viajes", { method: "POST", body: JSON.stringify(body) });
}

export function patchViaje(
  id: string,
  body: Partial<{
    cliente: string;
    origen: string;
    destino: string;
    carga: string | null;
    fecha: string | null;
    hora: string | null;
    tipoCarga: string | null;
    tipoUnidad: string | null;
    tenant: string | null;
    chofer: string | null;
    telefonoChofer: string | null;
    tractor: string | null;
    semi: string | null;
    notas: string | null;
  }>,
) {
  return api<Viaje>(`/api/viajes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function cambiarEstadoViaje(id: string, estado: ViajeEstado) {
  return api<Viaje>(`/api/viajes/${id}/estado`, {
    method: "POST",
    body: JSON.stringify({ estado }),
  });
}

export function deleteViaje(id: string) {
  return api<{ ok: boolean }>(`/api/viajes/${id}`, { method: "DELETE" });
}

/** Maestros de flota de Gestión de Viajes (NO son Parámetros/Remitos). */
export interface ViajesChoferFlota {
  id: string;
  nombre: string;
  telefono: string;
  licencia?: string;
  activo: boolean;
  dias_semana: number[];
  horarios: string[];
  excepciones?: Record<string, string[]>;
}

export interface ViajesCamionFlota {
  id: string;
  tractor: string;
  semi: string | null;
  tipo: string;
  tipos_carga: string[];
  capacidad_t: number;
  activo: boolean;
  dias_semana: number[];
  horarios: string[];
  excepciones?: Record<string, string[]>;
}

export function listViajesFlotaChoferes() {
  return api<ViajesChoferFlota[]>("/api/viajes/flota/choferes");
}

export function createViajesFlotaChofer(body: Partial<ViajesChoferFlota>) {
  return api<ViajesChoferFlota>("/api/viajes/flota/choferes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateViajesFlotaChofer(id: string, body: Partial<ViajesChoferFlota>) {
  return api<ViajesChoferFlota>(`/api/viajes/flota/choferes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteViajesFlotaChofer(id: string) {
  return api<{ ok: boolean }>(`/api/viajes/flota/choferes/${id}`, { method: "DELETE" });
}

export function listViajesFlotaCamiones() {
  return api<ViajesCamionFlota[]>("/api/viajes/flota/camiones");
}

export function createViajesFlotaCamion(body: Partial<ViajesCamionFlota>) {
  return api<ViajesCamionFlota>("/api/viajes/flota/camiones", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateViajesFlotaCamion(id: string, body: Partial<ViajesCamionFlota>) {
  return api<ViajesCamionFlota>(`/api/viajes/flota/camiones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteViajesFlotaCamion(id: string) {
  return api<{ ok: boolean }>(`/api/viajes/flota/camiones/${id}`, { method: "DELETE" });
}

export type GastoRendicionEstado =
  | "borrador"
  | "pendiente_aprobacion"
  | "aprobado"
  | "rechazado";

export interface GastoRendicion {
  id: string;
  codigo: string;
  estado: GastoRendicionEstado;
  estadoLabel: string;
  categoria: string;
  categoriaLabel: string;
  monto: number | null;
  montoLabel: string;
  moneda: string;
  proveedor: string | null;
  fechaComprobante: string | null;
  descripcion: string | null;
  viajeRef: string | null;
  telefono: string | null;
  choferNombre: string | null;
  imagenUrl: string | null;
  notaChofer: string | null;
  textoOcr?: string | null;
  notaAprobacion: string | null;
  aprobadoPor: string | null;
  historial: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumenRendicion {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
  monto_pendiente: number;
  monto_aprobado: number;
}

export function listGastosRendicion(params?: { limit?: number; estado?: string; telefono?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  if (params?.telefono) q.set("telefono", params.telefono);
  const qs = q.toString();
  return api<GastoRendicion[]>(`/api/rendicion${qs ? `?${qs}` : ""}`);
}

export function resumenRendicion() {
  return api<ResumenRendicion>("/api/rendicion/resumen");
}

export function decidirGastoRendicion(
  id: string,
  body: { estado: "aprobado" | "rechazado"; nota?: string; aprobado_por?: string },
) {
  return api<GastoRendicion>(`/api/rendicion/${id}/decidir`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type ReclamoEstado = "nuevo" | "en_proceso" | "escalado" | "resuelto";

export interface ReclamoCaso {
  id: string;
  /** Código público RC-YYYYMMDD-0001-PD */
  codigo: string;
  tipoAbbr?: string | null;
  tipoAbbrLabel?: string | null;
  estado: ReclamoEstado | string;
  estadoLabel: string;
  motivo: string | null;
  motivoLabel: string;
  criticidad: string | null;
  criticidadLabel: string;
  cliente: string;
  telefono: string | null;
  canal: string;
  viaje: string;
  remito: string | null;
  pedido: string | null;
  resumen: string | null;
  detalle: string | null;
  imagenUrl: string | null;
  escaladoA: string | null;
  notaInterna: string | null;
  sla: string;
  historial: string[];
  mensajes?: Array<{
    dir?: string;
    texto?: string;
    at?: string;
    imagen_url?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumenReclamos {
  abiertos: number;
  nuevo: number;
  en_proceso: number;
  escalado: number;
  resuelto: number;
  total: number;
}

export function listReclamos(params?: { limit?: number; estado?: string; telefono?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  if (params?.telefono) q.set("telefono", params.telefono);
  const qs = q.toString();
  return api<ReclamoCaso[]>(`/api/reclamos${qs ? `?${qs}` : ""}`);
}

export function resumenReclamos() {
  return api<ResumenReclamos>("/api/reclamos/resumen");
}

export function decidirReclamo(
  id: string,
  body: {
    estado: "en_proceso" | "escalado" | "resuelto";
    nota?: string;
    aprobado_por?: string;
  },
) {
  return api<ReclamoCaso>(`/api/reclamos/${id}/decidir`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type IncidenciaEstado = "esperando_causa" | "nueva" | "en_gestion" | "resuelta";

export interface IncidenciaCaso {
  id: string;
  codigo: string;
  tipoAbbr?: string | null;
  tipoAbbrLabel?: string | null;
  estado: IncidenciaEstado | string;
  estadoLabel: string;
  tipo: string | null;
  tipoLabel: string;
  criticidad: string | null;
  criticidadLabel: string;
  chofer: string;
  telefono: string | null;
  canal: string;
  origen: string;
  viaje: string;
  causa: string | null;
  resumen: string | null;
  destinoId: string | null;
  lat: number | null;
  lng: number | null;
  imagenUrl: string | null;
  notaInterna: string | null;
  sla: string;
  historial: string[];
  mensajes?: Array<{
    dir?: string;
    texto?: string;
    at?: string;
    imagen_url?: string | null;
  }>;
  consultaAt?: string | null;
  recordatorioEnviadoAt?: string | null;
  cerradoSinRespuesta?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumenIncidencias {
  total: number;
  abiertas: number;
  nueva: number;
  en_gestion: number;
  esperando_causa: number;
  resuelta: number;
  alta: number;
}

export function listIncidencias(params?: { limit?: number; estado?: string; telefono?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  if (params?.telefono) q.set("telefono", params.telefono);
  const qs = q.toString();
  return api<IncidenciaCaso[]>(`/api/incidencias${qs ? `?${qs}` : ""}`);
}

export function resumenIncidencias() {
  return api<ResumenIncidencias>("/api/incidencias/resumen");
}

export function decidirIncidencia(
  id: string,
  body: { estado: "nueva" | "en_gestion" | "resuelta"; nota?: string },
) {
  return api<IncidenciaCaso>(`/api/incidencias/${id}/decidir`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function consultarChoferIncidencia(body: {
  telefono: string;
  tipo?: string;
  viaje_ref?: string;
  lat?: number;
  lng?: number;
  direccion?: string;
  nota?: string;
  nombre?: string;
}) {
  return api<{ ok: boolean; incidencia: IncidenciaCaso; mensaje: string }>(
    "/api/incidencias/consultar-chofer",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export interface EtaColaItem {
  id: string;
  fuente: "destino" | "incidencia" | "viaje";
  refId: string;
  cliente: string;
  telefonoCliente: string | null;
  destino: string;
  chofer: string;
  telefonoChofer: string | null;
  viaje: string;
  etaTexto: string | null;
  etaMinutos: number | null;
  etaAt: string | null;
  estado: string;
  estadoLabel: string;
  causa?: string | null;
  codigoIncidencia?: string;
  notificado: boolean;
  puedeNotificar: boolean;
  updatedAt?: string;
}

export interface ResumenEta {
  enCola: number;
  conEta: number;
  esperandoChofer: number;
  demorasAbiertas: number;
  notificacionesHoy: number;
  demorasNotificadasHoy: number;
}

export interface EtaNotificacion {
  id: string;
  fuente: string;
  ref_id: string;
  telefono_cliente: string;
  cliente: string | null;
  eta_texto: string | null;
  tipo: string;
  mensaje: string;
  viaje_ref: string | null;
  created_at: string;
}

export function listEtaCola(params?: { limit?: number }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<EtaColaItem[]>(`/api/eta${qs ? `?${qs}` : ""}`);
}

export function resumenEta() {
  return api<ResumenEta>("/api/eta/resumen");
}

export function listEtaNotificaciones(params?: { limit?: number }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api<EtaNotificacion[]>(`/api/eta/notificaciones${qs ? `?${qs}` : ""}`);
}

export function notificarEtaDestino(
  destinoId: string,
  body?: { demora?: boolean; etaTexto?: string },
) {
  return api<{ ok: boolean; mensaje: string; telefono: string }>(
    `/api/eta/destino/${destinoId}/notificar`,
    { method: "POST", body: JSON.stringify(body || {}) },
  );
}

export function avisarEtaIncidencia(incidenciaId: string, body?: { etaTexto?: string }) {
  return api<{ ok: boolean; mensaje: string; telefono: string }>(
    `/api/eta/incidencia/${incidenciaId}/avisar`,
    { method: "POST", body: JSON.stringify(body || {}) },
  );
}

export type PodEstado = "pendiente" | "ok" | "rechazado";

export interface PodCaso {
  id: string;
  codigo: string;
  estado: PodEstado | string;
  estadoLabel: string;
  chofer: string;
  telefono: string;
  receptor: string;
  imagenUrl: string | null;
  viaje: string;
  destino: string;
  destinoId?: string | null;
  notaChofer?: string | null;
  textoOcr?: string | null;
  notaBackoffice?: string | null;
  aprobadoPor?: string | null;
  historial?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumenPods {
  total: number;
  pendientes: number;
  ok: number;
  rechazados: number;
  en_dialogo: number;
}

export function listPods(params?: { limit?: number; estado?: string; telefono?: string }) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.estado) q.set("estado", params.estado);
  if (params?.telefono) q.set("telefono", params.telefono);
  const qs = q.toString();
  return api<PodCaso[]>(`/api/pod${qs ? `?${qs}` : ""}`);
}

export function resumenPods() {
  return api<ResumenPods>("/api/pod/resumen");
}

export function decidirPod(
  id: string,
  body: {
    estado: "ok" | "rechazado";
    nota?: string;
    aprobado_por?: string;
    notificar?: boolean;
  },
) {
  return api<PodCaso>(`/api/pod/${id}/decidir`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Chat web operador ↔ agente especialista (fase 1: pod). */
export interface AgentChatTurnResponse {
  conversationId: string;
  agentId: string;
  tenant?: string | null;
  message: {
    role: "assistant";
    text: string;
    engine?: string;
    dataSources?: string[];
    citedIds?: string[];
  };
  conversation?: {
    id: string;
    messages: Array<{ id?: string; role: string; text: string; at?: string }>;
  };
  traceId?: string | null;
}

export function postAgentChat(body: {
  agentId: string;
  message: string;
  conversationId?: string;
  tenant?: string;
  context?: Record<string, unknown>;
  forceEngine?: "rules" | "llm";
}) {
  return api<AgentChatTurnResponse>("/api/agents/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgentChat(conversationId: string) {
  return api<{
    id: string;
    agentId: string;
    messages: Array<{ id?: string; role: string; text: string; at?: string }>;
  }>(`/api/agents/chat/${conversationId}`);
}

export function getAgentChatTraces(conversationId: string) {
  return api<{
    conversationId: string;
    agentId: string;
    traces: Array<Record<string, unknown>>;
  }>(`/api/agents/chat/${conversationId}/traces`);
}
