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

  const leido = extraerKmBeraldi(textoOcr);
  const motores = new Set([leido.motor_inicial, leido.motor_final].filter(Boolean));
  const esHorasMotor = (valor) => Boolean(valor && motores.has(valor));

  let kmIni = normalizarKmValor(d.km_inicial) ?? normalizarKmValor(frio.km_inicial);
  let kmFin = normalizarKmValor(d.km_final) ?? normalizarKmValor(frio.km_final);
  // El número pegado a "Hs. Motor" no es el odómetro, aunque el extractor lo haya puesto en KM.
  if (esHorasMotor(kmIni)) kmIni = leido.km_inicial || null;
  if (esHorasMotor(kmFin)) kmFin = leido.km_final || null;
  if (!kmIni && leido.km_inicial) kmIni = leido.km_inicial;
  if (!kmFin && leido.km_final) kmFin = leido.km_final;
  if (
    kmIni &&
    kmFin &&
    !parKmRazonable(kmIni, kmFin) &&
    leido.km_inicial &&
    leido.km_final &&
    parKmRazonable(leido.km_inicial, leido.km_final)
  ) {
    kmIni = leido.km_inicial;
    kmFin = leido.km_final;
  }

  if (kmIni) d.km_inicial = kmIni;
  if (kmFin) d.km_final = kmFin;

  // OCR a veces deja "Km Inicial / Km Final" sin valor en la misma línea y
  // los odómetros aparecen después como dos números sueltos (5–7 dígitos).
  if (!d.km_inicial || !d.km_final) {
    const huérfanos = extraerKmHuerfanosBeraldi(textoOcr, motores);
    if (!d.km_inicial && huérfanos.km_inicial) d.km_inicial = huérfanos.km_inicial;
    if (!d.km_final && huérfanos.km_final) d.km_final = huérfanos.km_final;
  }

  return d;
}

function textoPlanoKm(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim();
}

function parKmRazonable(ini, fin) {
  const a = Number(ini);
  const b = Number(fin);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
  return b - a <= 5000;
}

/** Horómetro: 3–5 dígitos. El odómetro del camión suele ser más largo. */
function pareceHorasMotor(valor) {
  const n = Number(valor);
  return valor.length >= 3 && valor.length <= 5 && n >= 100 && n < 30000;
}

function numerosCerca(texto, from, to) {
  const start = Math.max(0, from);
  const end = Math.min(texto.length, to);
  const slice = texto.slice(start, end);
  const out = [];
  for (const m of slice.matchAll(/\b(\d{3,7})\b/g)) {
    const index = start + m.index;
    const prev = texto[index - 1];
    const next = texto[index + m[1].length];
    if (prev === ":" || next === ":") continue;
    out.push({ valor: m[1], index });
  }
  return out;
}

function valorHorasMotor(texto, re) {
  const m = texto.match(re);
  if (!m) return null;
  const labelStart = m.index;
  const labelEnd = m.index + m[0].length;
  const antes = numerosCerca(texto, labelStart - 24, labelStart).filter(
    (n) => n.index + n.valor.length <= labelStart,
  );
  const despues = numerosCerca(texto, labelEnd, labelEnd + 24);
  const a = antes.at(-1) ?? null;
  const d = despues[0] ?? null;
  const gapAntes = a ? labelStart - (a.index + a.valor.length) : Infinity;
  const gapDespues = d ? d.index - labelEnd : Infinity;
  const candidatos = [];
  if (a && gapAntes <= 16 && pareceHorasMotor(a.valor)) {
    candidatos.push({ valor: a.valor, gap: gapAntes });
  }
  if (d && gapDespues <= 16 && pareceHorasMotor(d.valor)) {
    candidatos.push({ valor: d.valor, gap: gapDespues });
  }
  candidatos.sort((x, y) => x.gap - y.gap);
  return candidatos[0]?.valor ?? null;
}

function candidatosKm(texto, re, motores) {
  const m = texto.match(re);
  if (!m) return [];
  const labelStart = m.index;
  const labelEnd = m.index + m[0].length;
  const nums = [
    ...numerosCerca(texto, labelStart - 40, labelStart).filter(
      (n) => n.index + n.valor.length <= labelStart,
    ),
    ...numerosCerca(texto, labelEnd, labelEnd + 48),
  ];
  const vistos = new Set();
  const out = [];
  for (const n of nums) {
    if (motores.has(n.valor) || vistos.has(n.valor)) continue;
    const km = normalizarKmValor(n.valor);
    if (!km) continue;
    vistos.add(km);
    out.push(km);
  }
  return out;
}

function mejorParKm(iniciales, finales) {
  let best = null;
  for (const ini of iniciales) {
    for (const fin of finales) {
      if (!parKmRazonable(ini, fin)) continue;
      const delta = Number(fin) - Number(ini);
      if (!best || delta < best.delta) best = { km_inicial: ini, km_final: fin, delta };
    }
  }
  return best;
}

/**
 * Separa odómetro (Km Inicial/Final) del horómetro (Hs. Motor Inicial/Final).
 * En el formulario el valor suele ir a la izquierda de la etiqueta, así que el
 * número que queda entre "Km Inicial" y "Hs. Motor Inicial" es horas motor.
 */
export function extraerKmBeraldi(textoOcr = "") {
  const t = textoPlanoKm(textoOcr);
  if (!t) return {};

  const motorInicial = valorHorasMotor(t, /hs\.?\s*motor\s*inic\w*/i);
  const motorFinal = valorHorasMotor(t, /hs\.?\s*motor\s*fin\w*/i);
  const motores = new Set([motorInicial, motorFinal].filter(Boolean));
  const par = mejorParKm(
    candidatosKm(t, /km\s*inic\w*/i, motores),
    candidatosKm(t, /km\s*fin\w*/i, motores),
  );

  return {
    km_inicial: par?.km_inicial ?? null,
    km_final: par?.km_final ?? null,
    motor_inicial: motorInicial,
    motor_final: motorFinal,
  };
}

/**
 * Cuando las etiquetas Km Inicial/Final existen pero el valor no está al lado,
 * toma el primer par de odómetros consecutivos (fin > ini, delta razonable).
 */
export function extraerKmHuerfanosBeraldi(textoOcr = "", excluir = new Set()) {
  const t = String(textoOcr ?? "");
  if (!/km\s*inic/i.test(t) || !/km\s*fin/i.test(t)) return {};

  const afterLabels = t.split(/km\s*inic\w*/i).slice(1).join(" ") || t;
  const nums = [...afterLabels.matchAll(/\b(\d{5,7})\b/g)]
    .map((m) => m[1])
    .filter((n) => !excluir.has(n));

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
