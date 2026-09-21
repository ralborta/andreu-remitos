/**
 * Completa campos Beraldi del Custom Extractor con regex sobre texto OCR.
 * Prioriza DENOMIC como destino, OT, nro con copia -1/-2/-3 y limpia basura de lugares.
 */
import { extraerBeraldi } from "./extract-cold.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";
import {
  extraerPatentesManuscritasBeraldi,
  mejorPatenteOcr,
} from "./patente-ocr.mjs";

function limpiarTextoOcr(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor)
    .replace(/\bHora[_\s]?ent\.?:?\s*\d{1,2}(?::\d{2})?/gi, "")
    .replace(/\bHora[_\s]?(?:sal|ini|fin)\.?:?\s*\d{1,2}(?::\d{2})?/gi, "")
    .replace(/[дД]/g, "a")
    .replace(/[аА]/g, "a")
    .replace(/[еЕ]/g, "e")
    .replace(/[оО]/g, "o")
    .replace(/\s+/g, " ")
    .replace(/[.`'"´]+$/g, "")
    .trim();
  return s || null;
}

function pareceBasuraLugar(valor) {
  const s = String(valor ?? "").trim();
  if (!s || s.length < 2) return true;
  if (/hora[_\s]?(ent|sal|ini|fin|lleg)/i.test(s)) return true;
  if (/hora\s+de\s+(llegada|entrada|salida|inicio|fin)/i.test(s)) return true;
  if (/^(hora\s+de\s+llegada|llegada|entrada|salida)$/i.test(s)) return true;
  if (/\d{1,2}:\d{2}/.test(s)) return true;
  if (/\.\d{2,}$/.test(s)) return true; // Lach.874
  if (/^[A-Za-z]{2,10}\.\s*$/.test(s)) return true; // Cimsa.
  if (/^(hora|peso|chofer|tractor|semi|cimsa)$/i.test(s)) return true;
  return false;
}

function mejorTexto(actual, fallback) {
  const a = limpiarTextoOcr(actual);
  const b = limpiarTextoOcr(fallback);
  if (!b) return a;
  if (!a || pareceBasuraLugar(a)) return b;
  if (pareceBasuraLugar(b)) return a;
  if (a.length < 3 && b.length >= 3) return b;
  if (b.length >= a.length + 3) return b;
  return a;
}

function mejorNro(actual, fallback) {
  const a = normalizarNroRemitoGuia(actual, { tenant: "beraldi" });
  const b = normalizarNroRemitoGuia(fallback, { tenant: "beraldi" });
  if (!b) return a;
  if (!a) return b;
  // Preferir el que trae sufijo de copia.
  if (/-[123]$/.test(b) && !/-[123]$/.test(a)) return b;
  if (b.length > a.length) return b;
  return a;
}

/** OT Beraldi: latin/griego/cirílico + "Not:" manuscrito habitual. */
export function extraerOtBeraldi(textoOcr = "") {
  const t = String(textoOcr ?? "");
  const patterns = [
    /[OΟОо]\s*[.\-]?\s*[TТт]\s*[.:]?\s*(\d{4,8})/i,
    /(?:^|\n)\s*Not\s*[.:]?\s*(\d{4,8})/im,
    /N[°ºo.]?\s*(?:DE\s*)?OT\s*[.:]?\s*(\d{4,8})/i,
    /\bOT\s+(\d{4,8})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function enriquecerBeraldiDesdeTexto(datos, textoOcr = "") {
  if (!textoOcr?.trim()) return datos;
  const frio = extraerBeraldi(textoOcr);
  const d = { ...datos };

  d.nro_remito = mejorNro(d.nro_remito, frio.nro_remito);
  const otTxt = extraerOtBeraldi(textoOcr);
  if (!d.ot && (frio.ot || otTxt)) d.ot = frio.ot || otTxt;
  if (!d.fecha_remito && frio.fecha_remito) d.fecha_remito = frio.fecha_remito;

  const destino = mejorTexto(
    d.destino_nombre ?? d.destino ?? d.destino_locacion,
    frio.destino_nombre ?? frio.destino,
  );
  if (destino) {
    d.destino_nombre = destino;
    d.destino = destino;
    d.destino_locacion = destino;
  }

  const origen = mejorTexto(d.origen, frio.origen);
  if (origen) d.origen = origen;

  if ((d.peso_kg == null || d.peso_kg === "") && frio.peso_kg != null) {
    d.peso_kg = frio.peso_kg;
  }

  if (!d.chofer && frio.chofer) d.chofer = frio.chofer;

  const manuscritas = extraerPatentesManuscritasBeraldi(textoOcr);
  d.tractor = mejorPatenteOcr(d.tractor, manuscritas.tractor ?? frio.tractor);
  d.semi = mejorPatenteOcr(d.semi, manuscritas.semi ?? frio.semi);
  if (!d.unidad && frio.unidad) d.unidad = frio.unidad;

  const kmIni = normalizarKmValor(d.km_inicial) ?? normalizarKmValor(frio.km_inicial);
  const kmFin = normalizarKmValor(d.km_final) ?? normalizarKmValor(frio.km_final);
  if (kmIni) d.km_inicial = kmIni;
  if (kmFin) d.km_final = kmFin;

  // OCR a veces deja "Km Inicial / Km Final" sin valor en la misma línea y
  // los odómetros aparecen después como dos números sueltos (5–7 dígitos).
  if (!d.km_inicial || !d.km_final) {
    const huérfanos = extraerKmHuerfanosBeraldi(textoOcr);
    if (!d.km_inicial && huérfanos.km_inicial) d.km_inicial = huérfanos.km_inicial;
    if (!d.km_final && huérfanos.km_final) d.km_final = huérfanos.km_final;
  }

  return d;
}

/**
 * Cuando las etiquetas Km Inicial/Final existen pero el valor no está al lado,
 * toma el primer par de odómetros consecutivos (fin > ini, delta razonable).
 */
export function extraerKmHuerfanosBeraldi(textoOcr = "") {
  const t = String(textoOcr ?? "");
  if (!/km\s*inic/i.test(t) || !/km\s*fin/i.test(t)) return {};

  const afterLabels = t.split(/km\s*inic\w*/i).slice(1).join(" ") || t;
  const nums = [...afterLabels.matchAll(/\b(\d{5,7})\b/g)].map((m) => m[1]);

  for (let i = 0; i < nums.length - 1; i++) {
    const a = nums[i];
    const b = nums[i + 1];
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) continue;
    if (nb <= na) continue;
    if (nb - na > 5000) continue; // viaje Beraldi típico << 5000 km
    return {
      km_inicial: normalizarKmValor(a),
      km_final: normalizarKmValor(b),
    };
  }
  return {};
}

/** Odómetro Beraldi: 4–7 dígitos; O/I/l → 0/1 (confusiones OCR frecuentes). */
export function normalizarKmValor(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  // Basura típica OCR (fechas 13/8, etc.).
  if (/[\/]/.test(s)) return null;
  const digits = s
    .replace(/[Oo]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/[^\d]/g, "");
  // Odómetros típicos 4–7 dígitos; menos de 4 suele ser basura OCR.
  if (digits.length < 4 || digits.length > 7) return null;
  return digits;
}
