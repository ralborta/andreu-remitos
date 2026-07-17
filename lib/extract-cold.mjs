/**
 * Extracción en frío desde texto OCR (sin Custom Extractor).
 * Regex + heurísticas por tenant.
 */
import { parsearHorarios, normalizarFecha, normalizarHora } from "./horarios.mjs";
import { detectarCorina, extraerCorina } from "./extract-corina.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

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
  if (raw == null || raw === "") return null;
  const original = String(raw).trim().toLowerCase();
  const esToneladas = /(tns?|ton|tons?|tonel)/i.test(original);

  let s = original
    .replace(/\b(kgs?|kilos?|kilogramos?|toneladas?|tns?|tons?)\b/gi, "")
    .replace(/\s/g, "");

  if (!s) return null;

  if (/^\d+$/.test(s)) return parseInt(s, 10);

  // 29,220 o 29.220 (miles)
  const miles = s.match(/^(\d{1,2})[,.](\d{3})$/);
  if (miles) return parseInt(miles[1] + miles[2], 10);

  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    return parseInt(s.replace(/,/g, ""), 10);
  }

  const dec = s.match(/^(\d+)[,.](\d+)$/);
  if (dec) {
    const frac = dec[2];
    if (frac.length === 3 && !esToneladas) {
      return parseInt(dec[1] + frac, 10);
    }
    const val = parseFloat(`${dec[1]}.${frac}`);
    if (Number.isNaN(val)) return null;
    if (esToneladas || frac.length <= 2) return Math.round(val * 1000);
    return Math.round(val);
  }

  const n = parseInt(s.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

import { detectarTenant as detectarTenantNuevo } from "./detectar-tenant.mjs";

export function detectarTenant(texto) {
  return detectarTenantNuevo(texto);
}

export function extraerBeraldi(texto) {
  const t = limpiar(texto);
  const horarios = parsearHorarios(t);

  const nroRemito =
    cap(t, /REMITO\s*N[°º]?\s*((?:\d{5}[-\s]?)?\d{5,}(?:\s*[-–—]\s*[123])?)/i) ??
    cap(t, /N[°º]?\s*((?:00009[-\s]?)?\d{5,}(?:\s*[-–—]\s*[123])?)/i);

  const fechaRemito =
    normalizarFecha(cap(t, /FECHA:?\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i)) ??
    horarios.fecha_remito;

  const pesoRaw =
    cap(t, /(\d{1,2}[,.]\d{2,3})\s*(?:Tns|TOS|tn|kg)/i) ??
    cap(t, /CANTIDAD[\s\S]{0,40}?(\d{1,2}[,.]\d{2,3})/i) ??
    cap(t, /PESO\s*:?\s*(\d{4,6})/i);

  // Destino: Antonela — siempre lo escrito en DENOMIC / DENOMINAC.
  const stopLugar =
    "(?=\\s*(?:PESO|HORA|CHOFER|TRACTOR|SEMI|OBSERV|ORIGEN|DESTINO|DENOM|LOCACION|CLIENTE|UNIDAD|PRODUCTO|TIPO|Km|OT\\b|N[°º]|$))";
  const destinoDenomic =
    cap(t, `DENOMIC\\.?\\s*:?\\s*([A-Za-z0-9][A-Za-z0-9.\\s\\-]{0,40}?)${stopLugar}`) ??
    cap(t, `DENOMINAC\\.?\\s*:?\\s*([A-Za-z0-9][A-Za-z0-9.\\s\\-]{0,40}?)${stopLugar}`) ??
    cap(t, "DENOMINAC\\.?\\s*([\\w.\\-]+(?:\\s+[\\w.\\-]+)?)");

  const origen =
    cap(t, `ORIGEN\\s*:?\\s*([A-Za-z0-9][A-Za-z0-9.\\s\\-]{0,40}?)${stopLugar}`) ??
    cap(t, `(?:ALMACEN|CARGA)\\s*:?\\s*([A-Za-z0-9][A-Za-z0-9.\\s\\-]{0,40}?)${stopLugar}`);

  return {
    tenant: "beraldi",
    nro_remito: normalizarNroRemitoGuia(nroRemito, { tenant: "beraldi" }),
    fecha_remito: fechaRemito,
    ot: cap(t, /[OΟ]\.?T\.?\s*:?\s*(\d{4,})/i),
    cliente: cap(t, /CLIENTE:?\s*([A-Z][A-Z\s\.]+?)(?:N[°º]|SERVICIO|$)/i),
    unidad: cap(t, /UNIDAD\s*(\d+)/i),
    tractor: cap(t, /TRACTOR\s*([A-Z]{2}\s?\d{3}\s?[A-Z]{2})/i),
    semi: cap(t, /SEMI\s*(?:AD\s*)?([A-Z]{2}\s?\d{3}\s?[A-Z]{2})/i) ?? cap(t, /AD\s*(\d{3}\s?MS)/i),
    chofer: cap(t, /CHOFER\s*([A-Za-záéíóúñ\s\.]+?)(?:TIPO|Km|REMITO|OBSERV)/i),
    producto: cap(t, /PRODUCTO[\s\S]{0,20}?(Arena|WET|DRY)/i) ?? cap(t, /(Arena)/i),
    tipo: cap(t, /(\d{2}\/\d{2,3})\s*(?:DRY|WET)/i) ?? cap(t, /TIPO[\s\S]{0,15}?(\d{2}\/\d+)/i),
    peso_kg: normalizarPeso(pesoRaw),
    origen: limpiarLugarBeraldi(origen),
    destino_locacion: cap(t, /LOCACION\s*([A-Z0-9\-]+)/i) ?? cap(t, /LLL-\d+/i),
    destino_nombre: limpiarLugarBeraldi(destinoDenomic),
    destino: limpiarLugarBeraldi(destinoDenomic),
    km_inicial: cap(t, /Km\s*[Ii]nicial:?\s*([\d\.]+)/i),
    km_final: cap(t, /Km\s*final\.?\s*([\d\.]+)/i),
    horarios,
  };
}

/** Quita basura OCR tipo "Hora_ent:13" pegada a origen/destino. */
function limpiarLugarBeraldi(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor)
    .replace(/\bHora[_\s]?ent\.?:?\s*\d{1,2}(?::\d{2})?/gi, "")
    .replace(/\bHora[_\s]?(?:sal|ini|fin)\.?:?\s*\d{1,2}(?::\d{2})?/gi, "")
    .replace(/[дД]/g, "a")
    .replace(/[аА]/g, "a")
    .replace(/\s+/g, " ")
    .replace(/[.`'"´]+$/g, "")
    .trim();
  if (!s || s.length < 2) return null;
  if (/^(hora|peso|chofer|tractor|semi)$/i.test(s)) return null;
  return s;
}

export function extraerTSB(texto) {
  const t = limpiar(texto);
  const horarios = parsearHorarios(t);

  const pesoRaw = cap(t, /Peso:?\s*=?\s*([\d,\.]+)/i);

  return {
    tenant: "tsb",
    nro_guia: normalizarNroRemitoGuia(cap(t, /N[°º]?\s*(\d{5,})/i)),
    fecha_guia: normalizarFecha(cap(t, /\b(\d{1,2}\s+\d{1,2}\s+\d{2,4})\b/)) ??
      normalizarFecha(cap(t, /\b(\d{2}\s?\d{2}\s?\d{2})\b/)) ??
      horarios.fecha_remito,
    procedencia: cap(t, /PROCEDENCIA\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ\w]+)/i),
    destino: cap(t, /DESTINO:?\s*([^KON]+?)(?:CONDUCTOR|KMS|$)/i),
    chasis: cap(t, /CHASIS\s*N[°º]?\s*:?\s*([A-Z]{2}\s*\d{3}\s*[A-Z]{2}|[A-Z0-9]{5,8})(?=\s*ACOPLADO|\s*CONDUCTOR|$)/i),
    acoplado: cap(t, /ACOPLADO\s*N[°º]?\s*:?\s*([A-Z]{2,3}\s*\d{3}\s*[A-Z]{2}|[A-Z0-9]{5,8})(?=\s*CONDUCTOR|\s*SUB|\s*Peso|$)/i),
    conductor: cap(t, /CONDUCTOR:?\s*([A-Za-záéíóúñ\s\.]+?)(?:OPERACION|Cajas|Peso|SUB|$)/i),
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
