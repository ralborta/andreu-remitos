export function moneyAR(n: number | null | undefined, moneda = "ARS") {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda === "USD" ? "USD" : "ARS",
      maximumFractionDigits: 2,
    }).format(Number(n));
  } catch {
    return String(n);
  }
}

export function saldoFactura(monto?: number | null, aplicado?: number | null) {
  return Math.max(0, Number(monto || 0) - Number(aplicado || 0));
}

export function diasVencimiento(fechaVto?: string | null) {
  if (!fechaVto) return null;
  const due = new Date(`${fechaVto}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.floor((Date.now() - due.getTime()) / 86_400_000);
}

export function estadoCobranza(row: {
  estado?: string | null;
  monto?: number | null;
  monto_aplicado?: number | null;
  fecha_vto?: string | null;
}) {
  const saldo = saldoFactura(row.monto, row.monto_aplicado);
  if (saldo <= 0.009 || row.estado === "saldada") {
    return { label: "Saldada", tone: "ok" as const };
  }
  const days = diasVencimiento(row.fecha_vto);
  if (days != null && days > 0) return { label: "Vencida", tone: "bad" as const };
  if (days != null && days >= -7) return { label: "Riesgo", tone: "warn" as const };
  return { label: "Al día", tone: "ok" as const };
}

export function antiguedadLabel(fechaVto?: string | null) {
  const days = diasVencimiento(fechaVto);
  if (days == null) return "—";
  if (days <= 0) return days === 0 ? "vence hoy" : `en ${Math.abs(days)} días`;
  return `${days} días`;
}
