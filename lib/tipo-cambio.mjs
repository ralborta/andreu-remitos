/**
 * Cotizaciones para rendición (CLP → ARS).
 * Fuente por defecto: DolarAPI (gratis, sin API key).
 */
const DOLARAPI_CLP = "https://dolarapi.com/v1/cotizaciones/clp";

let cache = { at: 0, data: null };
const CACHE_MS = Number(process.env.TC_CLP_CACHE_MS) || 15 * 60 * 1000;

/**
 * @returns {Promise<{ valor: number, fecha: string|null, fuente: string, compra?: number, venta?: number }>}
 */
export async function obtenerCotizacionClpArs({ log, force = false } = {}) {
  const now = Date.now();
  if (!force && cache.data && now - cache.at < CACHE_MS) {
    return cache.data;
  }

  const res = await fetch(DOLARAPI_CLP, {
    signal: AbortSignal.timeout(Number(process.env.TC_CLP_TIMEOUT_MS) || 8000),
  });
  if (!res.ok) throw new Error(`DolarAPI CLP HTTP ${res.status}`);
  const data = await res.json();
  const compra = Number(data.compra);
  const venta = Number(data.venta);
  const valor = Number.isFinite(venta) && venta > 0
    ? venta
    : Number.isFinite(compra) && compra > 0
      ? compra
      : null;
  if (valor == null) throw new Error("DolarAPI CLP sin cotización válida");

  const out = {
    valor,
    compra: Number.isFinite(compra) ? compra : valor,
    venta: Number.isFinite(venta) ? venta : valor,
    fecha: data.fechaActualizacion || new Date().toISOString(),
    fuente: "dolarapi",
    moneda: "CLP",
    quote: "ARS",
  };
  cache = { at: now, data: out };
  log?.info?.({ valor: out.valor, fecha: out.fecha }, "Cotización CLP/ARS");
  return out;
}

/** ARS = CLP * tc (1 CLP → tc ARS). */
export function convertirClpAArs(montoClp, tc) {
  const m = Number(montoClp);
  const t = Number(tc);
  if (!Number.isFinite(m) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round(m * t * 100) / 100;
}

/**
 * Señales de comprobante chileno (RUT, peajes Cristo Redentor, etc.).
 */
export function pareceComprobanteChileno({ ocrTexto, texto, monedaIa } = {}) {
  if (String(monedaIa || "").toUpperCase() === "CLP") return true;
  const t = `${ocrTexto || ""} ${texto || ""}`;
  if (!t.trim()) return false;
  if (/\bCLP\b|pesos?\s*chilen/i.test(t)) return true;
  if (/\bR\.?\s*U\.?\s*T\.?\b/i.test(t)) return true;
  // RUT formato 11.540.947-6
  if (/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/.test(t)) return true;
  if (
    /\b(chile|santiago|los\s*andes|valpara[ií]so|cristo\s*redentor|los\s*libertadores|mop\s*-?\s*d\.?\s*vialidad|plaza\s*peaje|parqueadero)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}
