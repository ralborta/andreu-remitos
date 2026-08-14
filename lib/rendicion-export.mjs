/**
 * Exportación de rendiciones / gastos → planilla Excel (mesa + ERP).
 */
import {
  labelCategoria,
  labelEstadoGasto,
  moneyAR,
} from "./rendicion.mjs";

/** Columnas operativas (mesa de control). */
export const RENDICION_MESA_COLUMNS = [
  { key: "codigo", header: "Código", width: 88 },
  { key: "fecha", header: "Fecha", width: 100 },
  { key: "chofer", header: "Chofer", width: 140 },
  { key: "telefono", header: "Teléfono", width: 120 },
  { key: "categoria", header: "Categoría", width: 140 },
  { key: "monto", header: "Monto", width: 100 },
  { key: "moneda", header: "Moneda", width: 72 },
  { key: "proveedor", header: "Proveedor / detalle", width: 180 },
  { key: "descripcion", header: "Descripción", width: 200 },
  { key: "viaje", header: "Viaje / remito", width: 120 },
  { key: "estado", header: "Estado", width: 140 },
  { key: "nota_chofer", header: "Nota chofer", width: 160 },
  { key: "nota_aprobacion", header: "Nota aprobación / rechazo", width: 180 },
  { key: "aprobado_por", header: "Aprobado por", width: 120 },
  { key: "comprobante_url", header: "URL comprobante", width: 200 },
  { key: "creado", header: "Creado", width: 140 },
];

/**
 * Columnas para importación ERP / liquidación
 * (headers ASCII estables, sin acentos).
 */
export const RENDICION_ERP_COLUMNS = [
  { key: "codigo", header: "CodigoGasto", width: 96 },
  { key: "fecha_iso", header: "Fecha", width: 100 },
  { key: "chofer", header: "Chofer", width: 140 },
  { key: "telefono", header: "Telefono", width: 120 },
  { key: "categoria_id", header: "CategoriaId", width: 120 },
  { key: "categoria", header: "Categoria", width: 140 },
  { key: "monto_num", header: "Monto", width: 96 },
  { key: "moneda", header: "Moneda", width: 72 },
  { key: "proveedor", header: "Proveedor", width: 160 },
  { key: "descripcion", header: "Descripcion", width: 200 },
  { key: "viaje", header: "ViajeRef", width: 120 },
  { key: "estado_id", header: "EstadoId", width: 120 },
  { key: "estado", header: "Estado", width: 140 },
  { key: "nota_chofer", header: "NotaChofer", width: 160 },
  { key: "nota_aprobacion", header: "NotaAprobacion", width: 180 },
  { key: "aprobado_por", header: "AprobadoPor", width: 120 },
  { key: "comprobante_url", header: "UrlComprobante", width: 200 },
  { key: "creado_iso", header: "CreatedAt", width: 160 },
];

function fmtFechaCorta(raw) {
  if (!raw) return "";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
      const [y, m, d] = String(raw).split("-");
      return `${d}/${m}/${y}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(raw);
  }
}

function fechaIso(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toISOString().slice(0, 10);
  } catch {
    return s;
  }
}

function mapRow(row) {
  const fechaRaw = row.fecha_comprobante || row.created_at || "";
  return {
    codigo: row.codigo || "",
    fecha: fmtFechaCorta(fechaRaw),
    fecha_iso: fechaIso(fechaRaw),
    chofer: row.chofer_nombre || "",
    telefono: row.telefono || "",
    categoria_id: row.categoria || "",
    categoria: labelCategoria(row.categoria),
    monto: row.monto != null ? moneyAR(row.monto) : "",
    monto_num: row.monto != null && Number.isFinite(Number(row.monto)) ? Number(row.monto) : "",
    moneda: row.moneda || "ARS",
    proveedor: row.proveedor || "",
    descripcion: row.descripcion || "",
    viaje: row.viaje_ref || "",
    estado_id: row.estado || "",
    estado: labelEstadoGasto(row.estado),
    nota_chofer: row.nota_chofer || "",
    nota_aprobacion: row.nota_aprobacion || "",
    aprobado_por: row.aprobado_por || "",
    comprobante_url: row.imagen_url || "",
    creado: fmtFechaCorta(row.created_at),
    creado_iso: row.created_at || "",
  };
}

export function filasAoaRendicion(filas, columnas) {
  const headers = columnas.map((c) => c.header);
  const keys = columnas.map((c) => c.key);
  return [headers, ...filas.map((f) => keys.map((k) => f[k] ?? ""))];
}

/**
 * @param {object[]} rows — filas del store (snake_case)
 * @param {{ formato?: "mesa" | "erp" }} opts
 */
export function buildPlanillaRendicion(rows, opts = {}) {
  const formato = opts.formato === "erp" ? "erp" : "mesa";
  const columnas = formato === "erp" ? RENDICION_ERP_COLUMNS : RENDICION_MESA_COLUMNS;
  const filas = (rows || []).map(mapRow);
  return {
    formato,
    columnas,
    filas,
    meta: {
      total: filas.length,
      generado_en: new Date().toISOString(),
    },
  };
}
