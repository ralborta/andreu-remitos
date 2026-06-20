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
