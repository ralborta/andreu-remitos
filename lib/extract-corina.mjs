import { normalizarFecha } from "./horarios.mjs";
import {
  extraerPalletsChep40517,
  inferirMarcaClienteCorina,
  mapearLugaresCorina,
  normalizarChoferCorina,
  semiDefaultPorTractor,
} from "./corina-reglas.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

function limpiar(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim();
}

function cap(texto, re, flags = "i") {
  const m = texto.match(new RegExp(re, flags));
  return m ? m[1].trim() : null;
}

function parseNumeroEs(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function detectarCorina(texto) {
  const u = limpiar(texto).toUpperCase();
  return (
    u.includes("QUILMES") ||
    u.includes("AR1K-ANDREU") ||
    u.includes("ARK1K-ANDREU") ||
    u.includes("CERVECERIA Y MALTERIA") ||
    u.includes("CERVEGERIA Y MALTERIA") ||
    /3264-\d{6,}/.test(u)
  );
}

/** @param {Record<string, string>} campos */
export function extraerCorinaFoundation(campos, textoOcr = "") {
  return armarLecturaCorina(
    {
      nro_remito: campos.nro_remito,
      fecha: campos.fecha,
      cliente: campos.cliente,
      cod_cliente: campos.cod_cliente,
      transportista: campos.transportista,
      conductor: campos.conductor,
      patente: campos.patente,
      total_bultos: campos.total_bultos,
      total_litros: campos.total_litros,
      pedido: campos.pedido,
      entrega: campos.entrega,
      tr_numero: campos.tr_numero,
      origen: campos.origen,
      destino: campos.destino,
      semi: campos.semi,
    },
    textoOcr,
    "corina-foundation-v1",
  );
}

/** Extracción en frío desde OCR genérico (Quilmes). */
export function extraerCorina(texto) {
  const t = limpiar(texto);
  const rawText = String(texto ?? "");

  const nro_remito =
    cap(t, /NRO\.?\s*(\d{4}-\d{6,})/i) ??
    cap(t, /(\d{4}-\d{8})/) ??
    cap(t, /REMITO[^\d]*(\d{4}-\d+)/i);

  const fecha = normalizarFecha(
    cap(t, /FECHA[:\s]*(\d{2}\/\d{2}\/\d{2,4})/i) ?? cap(t, /(\d{2}\/\d{2}\/\d{2,4})/),
  );

  const conductor =
    cap(t, /CONDUCTOR[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s+DOMINIO|\s+TR\.|\s+PATENTE|$)/i) ??
    cap(t, /CONDUCTOR[:\s]+([^\n]+?)(?:\s+DOMINIO)/i);

  const patente =
    cap(t, /DOMINIO[:\s]+([A-Z0-9]{6,8})/i) ??
    cap(t, /PATENTE[:\s]+([A-Z0-9]{6,8})/i);

  const cliente =
    cap(t, /RAZON SOCIAL CLIENTE[:\s]+([A-Z0-9\-]+(?:\s+[A-Z0-9\-]+)?)/i) ??
    (t.toUpperCase().includes("AR1K-ANDREU") || t.toUpperCase().includes("ARK1K")
      ? "AR1K-ANDREU"
      : null);

  const cod_cliente = cap(t, /N[°º']?\s*CLIENTE[:\s]+([A-Z0-9\-]+)/i);

  const transportista =
    cap(t, /(TRANSPORTES ANDREU SA)/i) ??
    cap(t, /(\d{10}\s+TRANSPORTES[^\n]+)/i);

  const total_litros = parseNumeroEs(
    cap(t, /TOTAL LITROS[:\s]*([\d.,]+)/i) ?? cap(t, /TOTAL LITROS[^\d]*([\d.,]+)/i),
  );

  const pedido = cap(t, /PED(?:IDO)?[:\s]*(\d{10,})/i);
  const entrega = cap(t, /ENTREGA[:\s]*(\d{10,})/i);
  const tr_numero = cap(t, /TR\.?[:\s]*(\d{10,})/i);

  // No usar TOTAL BULTOS del encabezado: el dato crítico es CHEP 40517.
  const chep = extraerPalletsChep40517(rawText);

  return armarLecturaCorina(
    {
      nro_remito,
      fecha,
      cliente,
      cod_cliente,
      transportista,
      conductor,
      patente,
      total_bultos: chep,
      total_litros,
      pedido,
      entrega,
      tr_numero,
    },
    rawText,
    "corina-ocr-frio",
  );
}

function armarLecturaCorina(raw, textoOcr, fuente) {
  const fecha_remito = normalizarFecha(raw.fecha);
  const tractor = (raw.tractor ?? raw.patente)?.replace(/\s+/g, "").toUpperCase() ?? null;
  let semi = raw.semi?.replace(/\s+/g, "").toUpperCase() ?? null;
  if (!semi) semi = semiDefaultPorTractor(tractor);

  const chep =
    extraerPalletsChep40517(textoOcr) ??
    (typeof raw.total_bultos === "number" ? raw.total_bultos : parseNumeroEs(raw.total_bultos));

  let datos = {
    tenant: "corina",
    nro_remito: normalizarNroRemitoGuia(raw.nro_remito, { tenant: "corina" }),
    fecha_remito,
    cliente: raw.cliente ?? null,
    cod_cliente: raw.cod_cliente ?? null,
    transportista: raw.transportista ?? null,
    conductor: normalizarChoferCorina(raw.conductor),
    tractor,
    semi,
    patente: raw.patente?.replace(/\s+/g, "").toUpperCase() ?? null,
    origen: raw.origen ?? null,
    // No usar `cliente` (letterhead Quilmes) como destino: lo resuelve mapearLugaresCorina.
    destino: raw.destino ?? null,
    total_bultos: chep,
    pallets_chep: chep,
    total_litros: raw.total_litros ?? null,
    pedido: raw.pedido ?? null,
    entrega: raw.entrega ?? null,
    tr_numero: raw.tr_numero ?? null,
    _fuente: fuente,
  };

  datos = mapearLugaresCorina(datos, textoOcr);
  const marca = inferirMarcaClienteCorina(datos, textoOcr);
  if (marca) datos.cliente_marca = marca;

  const keys = ["nro_remito", "fecha_remito", "conductor", "tractor", "total_bultos"];
  const ok = keys.filter((k) => datos[k] != null && datos[k] !== "");

  return {
    ...datos,
    resumen: {
      tenant_detectado: "corina",
      campos_extraidos: {
        total: keys.length,
        ok: ok.length,
        faltan: keys.filter((k) => !ok.includes(k)),
      },
      texto_ocr_len: String(textoOcr ?? "").length,
    },
  };
}

export function calcularEstadoCorina(lectura) {
  const keys = ["nro_remito", "fecha_remito", "conductor", "tractor"];
  const ok = keys.filter((k) => lectura[k] != null && lectura[k] !== "");
  if (ok.length === keys.length) return "pendiente_revision";
  if (ok.length >= 2) return "incompleto";
  return "error_lectura";
}
