/**
 * Extracción en frío desde texto OCR (sin Custom Extractor).
 * Regex + heurísticas por tenant.
 */
import { parsearHorarios, normalizarFecha, normalizarHora } from "./horarios.mjs";
import { detectarCorina, extraerCorina } from "./extract-corina.mjs";

export { detectarCorina };

function cap(texto, re, flags = "i") {
  const m = texto.match(new RegExp(re, flags));
  return m ? m[1].trim() : null;
}

function limpiar(texto) {
  return texto.replace(/\s+/g, " ").trim();
}

/** @param {string} raw */
export function normalizarPeso(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/\s/g, "").replace(/kg/i, "");
  // 29,220 kg → 29220
  if (/^\d{1,2}[,.]\d{3}$/.test(s)) {
    return parseInt(s.replace(/[,.]/, ""), 10);
  }
  // 26,18 tns
  if (/^\d+[,.]\d{1,2}$/.test(s)) {
    return Math.round(parseFloat(s.replace(",", ".")) * 1000);
  }
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

export function detectarTenant(texto) {
  if (detectarCorina(texto)) return "corina";
  const u = texto.toUpperCase();
  if (u.includes("TSB") || u.includes("COMPAÑIA DE TRANSPORTES") || u.includes("GUIA DE TRANSPORTE")) {
    return "tsb";
  }
  if (u.includes("BERALDI") || u.includes("ERALDI") || u.includes("TRANSPORTES JOSE")) {
    return "beraldi";
  }
  return "desconocido";
}

export function extraerBeraldi(texto) {
  const t = limpiar(texto);
  const horarios = parsearHorarios(t);

  const nroRemito =
    cap(t, /REMITO\s*N[°º]?\s*(\d{5}[-\s]?\d{5,}[-\d]*)/i) ??
    cap(t, /N[°º]?\s*00009[-\s]?(\d{5,}[-\d]*)/i);

  const fechaRemito =
    normalizarFecha(cap(t, /FECHA:?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i)) ??
    horarios.fecha_remito;

  const pesoRaw =
    cap(t, /(\d{1,2}[,.]\d{2,3})\s*(?:Tns|TOS|tn)/i) ??
    cap(t, /CANTIDAD[\s\S]{0,40}?(\d{1,2}[,.]\d{2,3})/i);

  return {
    tenant: "beraldi",
    nro_remito: nroRemito,
    fecha_remito: fechaRemito,
    ot: cap(t, /[OΟ]\.?T\.?\s*(\d+)/i),
    cliente: cap(t, /CLIENTE:?\s*([A-Z][A-Z\s\.]+?)(?:N[°º]|SERVICIO|$)/i),
    unidad: cap(t, /UNIDAD\s*(\d+)/i),
    tractor: cap(t, /TRACTOR\s*([A-Z]{2}\s?\d{3}\s?[A-Z]{2})/i),
    semi: cap(t, /SEMI\s*(?:AD\s*)?([A-Z]{2}\s?\d{3}\s?[A-Z]{2})/i) ?? cap(t, /AD\s*(\d{3}\s?MS)/i),
    chofer: cap(t, /CHOFER\s*([A-Za-záéíóúñ\s\.]+?)(?:TIPO|Km|REMITO|OBSERV)/i),
    producto: cap(t, /PRODUCTO[\s\S]{0,20}?(Arena|WET|DRY)/i) ?? cap(t, /(Arena)/i),
    tipo: cap(t, /(\d{2}\/\d{2,3})\s*(?:DRY|WET)/i) ?? cap(t, /TIPO[\s\S]{0,15}?(\d{2}\/\d+)/i),
    peso_kg: normalizarPeso(pesoRaw),
    origen: cap(t, /CARGA[\s\S]*?ALMACEN\s*(\w+)/i),
    destino_locacion: cap(t, /LOCACION\s*([A-Z0-9\-]+)/i) ?? cap(t, /LLL-\d+/i),
    destino_nombre: cap(t, /DENOMINAC\.?\s*([\w\-]+)/i),
    km_inicial: cap(t, /Km\s*[Ii]nicial:?\s*([\d\.]+)/i),
    km_final: cap(t, /Km\s*final\.?\s*([\d\.]+)/i),
    horarios,
  };
}

export function extraerTSB(texto) {
  const t = limpiar(texto);
  const horarios = parsearHorarios(t);

  const pesoRaw = cap(t, /Peso:?\s*=?\s*([\d,\.]+)/i);

  return {
    tenant: "tsb",
    nro_guia: cap(t, /N[°º]?\s*(\d{5,})/i),
    fecha_guia: normalizarFecha(cap(t, /\b(\d{2}\s?\d{2}\s?\d{2})\b/)) ?? horarios.fecha_remito,
    procedencia: cap(t, /PROCEDENCIA\s*(\w+)/i),
    destino: cap(t, /DESTINO:?\s*([^KON]+?)(?:CONDUCTOR|KMS|$)/i),
    chasis: cap(t, /CHASIS\s*([A-Z0-9\s]+?)\s*ACOPLADO/i),
    acoplado: cap(t, /ACOPLADO\s*(?:N[°º]?\s*)?([A-Z0-9\s]+?)(?:CONDUCTOR|SUB)/i),
    conductor: cap(t, /CONDUCTOR:?\s*([A-Za-z\s\.]+?)(?:OPERACION|Cajas|$)/i),
    peso_kg: normalizarPeso(pesoRaw),
    malla: cap(t, /Malla:?\s*=?\s*([\d\/]+)/i),
    remito_cliente: cap(t, /Remito:?\s*=?\s*([\d\s]+)/i),
    nro_interno: cap(t, /INTERNO\s*(\d+)/i),
    horarios,
  };
}

export function extraerFrio(texto) {
  const tenant = detectarTenant(texto);
  if (tenant === "corina") return extraerCorina(texto);

  const datos = tenant === "tsb" ? extraerTSB(texto) : extraerBeraldi(texto);

  const v = datos.horarios?.validacion ?? {};
  const camposCriticos = contarCampos(datos, tenant);

  return {
    ...datos,
    resumen: {
      tenant_detectado: tenant,
      horas_completas: v.valido === true,
      horas_faltantes: v.faltantes ?? [],
      horas_errores: v.errores ?? [],
      campos_extraidos: camposCriticos,
    },
  };
}

function contarCampos(d, tenant) {
  const keys =
    tenant === "tsb"
      ? ["nro_guia", "destino", "conductor", "peso_kg", "procedencia"]
      : ["nro_remito", "fecha_remito", "chofer", "destino_nombre", "peso_kg", "tractor"];
  const ok = keys.filter((k) => d[k] != null && d[k] !== "");
  return { total: keys.length, ok: ok.length, faltan: keys.filter((k) => !ok.includes(k)) };
}

export { normalizarFecha, normalizarHora };
