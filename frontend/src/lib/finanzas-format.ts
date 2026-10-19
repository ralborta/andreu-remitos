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
