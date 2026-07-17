import type { RemitoRow } from "./types";

// Re-export helpers used in UI (via duplicate logic for browser bundle)
function esPalabraConfirmacionUi(valor: unknown): boolean {
  const s = String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.!?,¿¡:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return false;
  return /^(ok|dale|listo|correcto|correcta|esta bien|confirmo|confirmado|perfecto|si|sí|todo bien|bueno|genial|gracias|remito|remitos)$/i.test(s);
}

function patenteParaUi(...candidatos: unknown[]): string {
  for (const c of candidatos) {
    if (c == null || c === "") continue;
    if (esPalabraConfirmacionUi(c)) continue;
    const s = String(c).trim();
    if (s.length >= 5) return s;
  }
  return "—";
}

function normalizarNroRemitoGuia(valor: unknown, opts?: { tenant?: string }): string | null {
  if (valor == null || valor === "") return null;
  const raw = String(valor).trim();
  if (/^remit[oa]s?$/i.test(raw)) return null;
  const permitirCopia = opts?.tenant === "beraldi";
  const copiaMatch = permitirCopia ? raw.match(/[-–—]\s*([123])\s*$/) : null;
  const sufijo = copiaMatch ? `-${copiaMatch[1]}` : "";
  const baseRaw = copiaMatch ? raw.slice(0, copiaMatch.index) : raw;
  const digits = baseRaw.replace(/\D/g, "");
  return digits.length >= 4 ? (sufijo ? `${digits}${sufijo}` : digits) : null;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente_revision: "En revisión",
  incompleto: "Pendiente",
  bloqueado: "Bloqueado",
  confirmado: "Validado",
  error_lectura: "Error",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente_revision: "#f59e0b",
  incompleto: "#a79fc9",
  bloqueado: "#ef4444",
  confirmado: "#22c55e",
  error_lectura: "#ef4444",
};

export function estadoLabel(estado: string) {
  return ESTADO_LABEL[estado] ?? estado;
}

export function estadoColor(estado: string) {
  return ESTADO_COLOR[estado] ?? "#a79fc9";
}

export function numeroRemito(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  const raw = d.nro_guia ?? d.nro_remito;
  const n = normalizarNroRemitoGuia(raw, { tenant: row.tenant });
  if (n) return n;
  // Si ya viene con sufijo guardado, mostrarlo tal cual.
  if (raw != null && String(raw).trim()) return String(raw).trim();
  return row.id.slice(0, 8);
}

export function conductorNombre(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  return (d.conductor || d.chofer || "—") as string;
}

export function destinoNombre(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  return (d.destino || d.cliente || d.destino_nombre || "—") as string;
}

export function confianzaPct(row: RemitoRow) {
  const r = (row.datos as { resumen?: { campos_extraidos?: { ok?: number; total?: number } } })
    ?.resumen?.campos_extraidos;
  if (r?.total) return Math.round(((r.ok ?? 0) / r.total) * 100);
  return row.estado === "confirmado" || row.estado === "pendiente_revision" ? 85 : 60;
}

export function horaCorta(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function tenantLabel(t: string) {
  if (t === "tsb") return "TSB";
  if (t === "beraldi") return "Beraldi";
  if (t === "corina") return "Corina";
  return t.toUpperCase();
}

export function esTenantCorina(tenant: string) {
  return tenant === "corina";
}

export const CAMPOS_TSB = [
  "fecha_guia",
  "nro_guia",
  "conductor",
  "chasis",
  "acoplado",
  "procedencia",
  "destino",
  "peso_kg",
] as const;

export const CAMPOS_BERALDI = [
  "fecha_remito",
  "nro_remito",
  "ot",
  "chofer",
  "patente_chasis",
  "patente_acoplado",
  "origen",
  "destino",
  "peso_kg",
] as const;

export const CAMPOS_CORINA = [
  "fecha_remito",
  "nro_remito",
  "conductor",
  "tractor",
  "semi",
  "origen",
  "destino",
  "total_bultos",
  "hora_inicio",
  "hora_fin",
  "total_litros",
  "pedido",
  "entrega",
  "tr_numero",
] as const;

export function camposEdicion(tenant: string) {
  if (tenant === "corina") return CAMPOS_CORINA;
  if (tenant === "tsb") return CAMPOS_TSB;
  return CAMPOS_BERALDI;
}

/** Valor mostrado en formulario, resolviendo alias (ej. tractor → patente_chasis). */
export function valorCampoEdicion(d: Record<string, unknown>, k: string): string | undefined {
  const direct = d[k];
  if (direct != null && direct !== "") return String(direct);
  if (k === "patente_chasis") {
    const v = d.tractor ?? d.chasis ?? d.patente ?? d.dominio;
    if (v != null && v !== "") return String(v);
  }
  if (k === "patente_acoplado") {
    const v = d.semi ?? d.acoplado;
    if (v != null && v !== "") return String(v);
  }
  if (k === "chofer") {
    const v = d.conductor;
    if (v != null && v !== "") return String(v);
  }
  if (k === "conductor") {
    const v = d.chofer;
    if (v != null && v !== "") return String(v);
  }
  if (k === "origen") {
    const v = d.procedencia;
    if (v != null && v !== "") return String(v);
  }
  if (k === "procedencia") {
    const v = d.origen;
    if (v != null && v !== "") return String(v);
  }
  if (k === "destino") {
    const v = d.destino_nombre ?? d.destino_locacion ?? d.cliente;
    if (v != null && v !== "") return String(v);
  }
  if (k === "nro_remito") {
    const v = d.nro_guia;
    if (v != null && v !== "") return String(v);
  }
  if (k === "nro_guia") {
    const v = d.nro_remito;
    if (v != null && v !== "") return String(v);
  }
  return undefined;
}

export function formEdicionFromDatos(tenant: string, datos: Record<string, unknown>) {
  const campos = camposEdicion(tenant);
  const initial: Record<string, string> = {};
  for (const k of campos) {
    const v = valorCampoEdicion(datos, k);
    if (v != null) initial[k] = v;
  }
  return initial;
}

function datos(row: RemitoRow) {
  return row.datos as Record<string, unknown>;
}

export function origenNombre(row: RemitoRow) {
  const d = datos(row);
  return (d.procedencia || d.origen || "—") as string;
}

export function chasisPatente(row: RemitoRow) {
  const d = datos(row);
  return patenteParaUi(d.patente, d.chasis, d.tractor, d.patente_chasis);
}

export function acopladoPatente(row: RemitoRow) {
  const d = datos(row);
  return patenteParaUi(d.acoplado, d.semi, d.patente_acoplado);
}

export function clienteNombre(row: RemitoRow) {
  const d = datos(row);
  return (d.cliente || "—") as string;
}

export function totalBultos(row: RemitoRow) {
  const d = datos(row);
  const v = d.total_bultos;
  if (v == null || v === "") return "—";
  return String(v);
}

export function totalLitros(row: RemitoRow) {
  const d = datos(row);
  const v = d.total_litros;
  if (v == null || v === "") return "—";
  return String(v);
}

export function pesoKg(row: RemitoRow) {
  const d = datos(row);
  const p = d.peso_kg ?? d.peso;
  if (p == null || p === "") return "—";
  const n = Number(p);
  return Number.isFinite(n) ? n.toLocaleString("es-AR") : String(p);
}

export function fechaRemito(row: RemitoRow) {
  const d = datos(row);
  const f = (d.fecha_guia ?? d.fecha_remito ?? d.fecha) as string | undefined;
  if (f) {
    const s = String(f).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const mo = +iso[2];
      const day = +iso[3];
      if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        return `${iso[3]}/${iso[2]}/${iso[1]}`;
      }
      return "Sin fecha";
    }
    return s;
  }
  return "Sin fecha";
}

export function fechaHoraRemito(row: RemitoRow) {
  if (!row.created_at) return "—";
  try {
    return new Date(row.created_at).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const CAMPO_LABEL: Record<string, string> = {
  fecha_guia: "Fecha",
  fecha_remito: "Fecha",
  nro_guia: "Nro remito / guía",
  nro_remito: "Nro remito",
  ot: "OT",
  conductor: "Chofer",
  chofer: "Chofer",
  procedencia: "Origen",
  origen: "Origen",
  destino: "Destino",
  chasis: "Tractor / chasis",
  acoplado: "Semi / remolque",
  patente_chasis: "Patente chasis",
  patente_acoplado: "Semi / remolque",
  patente: "Patente / dominio",
  cliente: "Cliente",
  cod_cliente: "Cod. cliente",
  transportista: "Transportista",
  total_bultos: "Total bultos",
  total_litros: "Total litros",
  pedido: "Pedido",
  entrega: "Entrega",
  tr_numero: "TR",
  tractor: "Tractor",
  semi: "Semi",
  hora_inicio: "Hora inicio",
  hora_fin: "Hora fin",
  peso_kg: "Peso (kg)",
  malla: "Malla",
  remito_cliente: "Remito cliente",
  nro_interno: "Nro interno",
};

export function campoLabel(key: string) {
  return CAMPO_LABEL[key] ?? key.replace(/_/g, " ");
}

export const ORDEN_HORARIOS = [
  { key: "carga_entrada", label: "Carga — hora entrada" },
  { key: "carga_salida", label: "Carga — hora salida" },
  { key: "descarga_llegada", label: "Descarga — hora llegada" },
  { key: "descarga_inicio", label: "Descarga — hora inicio" },
  { key: "descarga_fin", label: "Descarga — hora fin" },
] as const;

type HorariosBlock = {
  horarios?: Record<string, { hora?: string | null; fecha?: string | null }>;
  fecha_remito?: string | null;
};

export function fechaBaseHorarios(row: RemitoRow) {
  const d = datos(row);
  const h = (d.horarios as HorariosBlock | undefined)?.fecha_remito;
  return (d.fecha_guia ?? d.fecha_remito ?? h ?? null) as string | null;
}

export function horasFromRow(row: RemitoRow): Record<string, string> {
  const slots = (datos(row).horarios as HorariosBlock | undefined)?.horarios ?? {};
  const out: Record<string, string> = {};
  for (const { key } of ORDEN_HORARIOS) {
    const h = slots[key]?.hora;
    if (h) out[key] = h;
  }
  return out;
}

export function buildHorariosBody(horas: Record<string, string>, fechaBase: string | null) {
  const horarios: Record<string, { fecha: string | null; hora: string | null }> = {};
  for (const { key } of ORDEN_HORARIOS) {
    const v = horas[key]?.trim();
    horarios[key] = { fecha: fechaBase, hora: v || null };
  }
  return {
    horarios: {
      tenant: null,
      fecha_remito: fechaBase,
      horarios,
    },
  };
}

/** Resumen para tabla: "07:45 → 10:10" o "3/5 hs" */
export function horasResumen(row: RemitoRow) {
  const horas = horasFromRow(row);
  const vals = ORDEN_HORARIOS.map(({ key }) => horas[key]).filter(Boolean);
  if (vals.length === 0) return "—";
  if (vals.length >= 2) return `${vals[0]} → ${vals[vals.length - 1]}`;
  return `${vals.length}/5 hs`;
}

export function horasCompletas(row: RemitoRow) {
  return ORDEN_HORARIOS.every(({ key }) => Boolean(horasFromRow(row)[key]));
}

const ETIQUETAS_HORARIO_UI = new Set<string>(ORDEN_HORARIOS.map((h) => h.label));

function esFaltanteHorarioUi(f: string) {
  return ETIQUETAS_HORARIO_UI.has(f);
}

function esErrorHorarioUi(e: string) {
  if (/patente|unidades|tractor\s*\/\s*chasis|semi\s*\/\s*remolque/i.test(e)) return false;
  if (/destino|localidad|origen|procedencia/i.test(e)) return false;
  if (/está registrada solo como origen/i.test(e)) return false;
  return (
    /hora|anterior a|carga|descarga|inválida/i.test(e) ||
    [...ETIQUETAS_HORARIO_UI].some((et) => e.includes(et))
  );
}

function motivosBloqueoProcesoTsbUi(validacion: RemitoRow["validacion"]) {
  if (!validacion || validacion.valido === true) return [] as string[];
  const motivos: string[] = [];
  for (const f of validacion.faltantes ?? []) {
    if (!esFaltanteHorarioUi(f)) motivos.push(`Falta: ${f}`);
  }
  for (const e of validacion.errores ?? []) {
    if (!esErrorHorarioUi(e)) motivos.push(e);
  }
  return motivos;
}

export function remitoProcesable(row: RemitoRow): { ok: boolean; motivos: string[] } {
  const motivos: string[] = [];
  const d = datos(row);

  if (row.estado === "confirmado") {
    return { ok: false, motivos: ["Ya procesado"] };
  }
  if (row.estado === "error_lectura") {
    return { ok: false, motivos: ["Error de lectura — corregir campos"] };
  }

  if (row.tenant === "tsb") {
    const bloqueos = motivosBloqueoProcesoTsbUi(row.validacion);
    return { ok: bloqueos.length === 0, motivos: bloqueos };
  }

  if (!esTenantCorina(row.tenant) && horasCompletas(row) && row.validacion?.valido === true) {
    return { ok: true, motivos: [] };
  }

  if (row.tenant === "corina") {
    for (const k of ["nro_remito", "fecha_remito", "conductor", "tractor"]) {
      if (d[k] == null || d[k] === "") motivos.push(`Falta ${k.replace(/_/g, " ")}`);
    }
    return { ok: motivos.length === 0, motivos };
  }

  if (!horasCompletas(row)) {
    motivos.push("Faltan horarios (5 controles carga/descarga)");
  }
  const v = row.validacion;
  if (v?.faltantes?.length) {
    for (const f of v.faltantes) motivos.push(`Falta: ${f}`);
  }
  if (v?.errores?.length) {
    motivos.push(...v.errores);
  }
  if (v && v.valido !== true && motivos.length === 0) {
    motivos.push("Validación incompleta — revisar horarios y destino");
  }

  return { ok: motivos.length === 0, motivos };
}

export function advertenciaTenant(row: RemitoRow): string | null {
  const adv = (datos(row).resumen as { advertencia_tenant?: { mensaje?: string } } | undefined)
    ?.advertencia_tenant;
  return adv?.mensaje ?? null;
}
