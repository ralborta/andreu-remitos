import type { RemitoRow } from "./types";

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
  return (d.nro_guia || d.nro_remito || row.id.slice(0, 8)) as string;
}

export function conductorNombre(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  return (d.conductor || d.chofer || "—") as string;
}

export function destinoNombre(row: RemitoRow) {
  const d = row.datos as Record<string, unknown>;
  return (d.destino || d.destino_nombre || "—") as string;
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
  return t === "tsb" ? "TSB" : t === "beraldi" ? "Beraldi" : t.toUpperCase();
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
  return (d.chasis || d.patente_chasis || "—") as string;
}

export function acopladoPatente(row: RemitoRow) {
  const d = datos(row);
  return (d.acoplado || d.patente_acoplado || "—") as string;
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
  const f = d.fecha ?? d.fecha_remito;
  if (f) return String(f);
  if (row.created_at) {
    try {
      return new Date(row.created_at).toLocaleDateString("es-AR");
    } catch {
      return "—";
    }
  }
  return "—";
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
  conductor: "Chofer",
  chofer: "Chofer",
  procedencia: "Origen",
  origen: "Origen",
  destino: "Destino",
  chasis: "Tractor / chasis",
  acoplado: "Semi / acoplado",
  patente_chasis: "Patente chasis",
  patente_acoplado: "Patente acoplado",
  peso_kg: "Peso (kg)",
  malla: "Malla",
  remito_cliente: "Remito cliente",
  nro_interno: "Nro interno",
};

export function campoLabel(key: string) {
  return CAMPO_LABEL[key] ?? key.replace(/_/g, " ");
}
