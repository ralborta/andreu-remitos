import { ocrDocumento } from "../../../lib/document-ai.mjs";
import { facturaMime, interpretarFacturaProveedor } from "../../../lib/finanzas-factura.mjs";
import {
  findFacturaPagarDuplicada,
  finanzasFacturaId,
  getFactura,
  getFacturaInterna,
  insertFactura,
  listFacturas,
  saveFacturaArchivo,
  updateFactura,
} from "../db/finanzas-facturas-store.mjs";

function paso(label, extra = {}) {
  return { at: new Date().toISOString(), agente: "facturas", label, ...extra };
}

async function ocrTextoSeguro(buffer, filename, log) {
  try {
    const ocr = await ocrDocumento(buffer, filename);
    return ocr?.texto || null;
  } catch (err) {
    log?.warn?.({ err: err.message }, "OCR factura (Document AI) no disponible");
    return null;
  }
}

export async function listarFacturasFinanzas(query) {
  return listFacturas(query);
}

export async function obtenerFacturaFinanzas(id) {
  return getFactura(id);
}

export async function obtenerArchivoFactura(id) {
  return getFacturaInterna(id);
}

export async function ingestarFacturaPagar(buffer, { filename, mime, log } = {}) {
  if (!buffer?.length) throw new Error("Archivo vacío");
  const id = finanzasFacturaId();
  const name = filename || "factura.pdf";
  const resolvedMime = facturaMime(name, mime);
  const archivo_path = saveFacturaArchivo(id, buffer, name);
  const ocrTexto = await ocrTextoSeguro(buffer, name, log);
  const datos = await interpretarFacturaProveedor(buffer, {
    filename: name,
    mime: resolvedMime,
    ocrTexto,
    log,
  });

  const dup = await findFacturaPagarDuplicada({
    cuit: datos.cuit_emisor,
    numero: datos.numero,
  });
  if (dup) {
    throw new Error(`Ya está cargada la factura ${dup.numero} de ${dup.cuit_emisor} (${dup.id})`);
  }

  const row = {
    id,
    tipo: "pagar",
    origen: "pdf",
    estado: "leida",
    tipo_comprobante: datos.tipo_comprobante,
    punto_venta: datos.punto_venta,
    numero: datos.numero,
    fecha: datos.fecha,
    fecha_vto: datos.fecha_vto,
    cuit_emisor: datos.cuit_emisor,
    razon_social: datos.razon_social,
    cuit_receptor: datos.cuit_receptor,
    monto: datos.monto,
    moneda: datos.moneda || "ARS",
    cae: datos.cae,
    confianza: datos.confianza,
    archivo_nombre: name,
    archivo_mime: resolvedMime,
    archivo_path,
    ocr_disponible: Boolean(ocrTexto),
    pasos: [
      paso("PDF recibido"),
      paso("IA extrajo los datos", { confianza: datos.confianza }),
    ],
  };

  return insertFactura(row);
}

const EDITABLE = [
  "tipo_comprobante",
  "punto_venta",
  "numero",
  "fecha",
  "fecha_vto",
  "cuit_emisor",
  "razon_social",
  "cuit_receptor",
  "monto",
  "moneda",
  "cae",
];

export async function confirmarFacturaPagar(id, body = {}) {
  const actual = await getFacturaInterna(id);
  if (!actual) return null;
  if (actual.tipo !== "pagar") {
    throw new Error("Las facturas a cobrar no se editan acá: entran por sistema");
  }
  const patch = {};
  for (const k of EDITABLE) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.monto != null && patch.monto !== "") {
    const n = Number(patch.monto);
    patch.monto = Number.isFinite(n) ? n : actual.monto;
  }
  const pasos = Array.isArray(actual.pasos) ? [...actual.pasos] : [];
  if (actual.estado !== "confirmada") {
    pasos.push(paso("Mesa confirmó la lectura"));
    patch.estado = "confirmada";
    patch.pasos = pasos;
  }
  return updateFactura(id, patch);
}
