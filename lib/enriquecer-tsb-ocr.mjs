/**
 * Completa campos TSB del Custom Extractor con regex sobre texto OCR.
 * Las guías manuscritas suelen fallar en fecha, patentes y procedencia.
 */
import { extraerTSB } from "./extract-cold.mjs";
import { normalizarFecha, parsearHorarios } from "./horarios.mjs";
import { normalizarPatente } from "./normalizar-remito.mjs";

/** Corrige caracteres cirílicos u otros ruidos OCR en texto. */
function limpiarTextoOcr(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor)
    .replace(/[дД]/g, "a")
    .replace(/[аА]/g, "a")
    .replace(/[еЕ]/g, "e")
    .replace(/[оО]/g, "o")
    .replace(/[сС]/g, "c")
    .replace(/[рР]/g, "p")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

function mejorConductor(actual, fallback) {
  const a = limpiarTextoOcr(actual);
  const b = limpiarTextoOcr(fallback);
  if (!b) return a;
  if (!a) return b;
  const aw = a.split(/\s+/).filter(Boolean);
  const bw = b.split(/\s+/).filter(Boolean);
  if (bw.length >= 2 && aw.length < 2) return b;
  if (aw[0] && bw[0] && aw[0].slice(0, 2).toLowerCase() === bw[0].slice(0, 2).toLowerCase() && b.length > a.length) {
    return b;
  }
  return a;
}

function patenteDesdeTexto(texto, tipo) {
  const t = String(texto ?? "").replace(/\n/g, " ");
  const stop = String.raw`(?=\s*(?:CONDUCTOR|CHOFER|SUB|Peso|PESO|KMS|$))`;
  const re =
    tipo === "chasis"
      ? new RegExp(String.raw`CHASIS\s*N[°º]?\s*:?\s*([A-Z]{2}\s*\d{3}\s*[A-Z]{2}|[A-Z0-9]{5,8})${stop}`, "i")
      : new RegExp(String.raw`ACOPLADO\s*N[°º]?\s*:?\s*([A-Z]{2,3}\s*\d{3}\s*[A-Z]{2}|[A-Z0-9]{5,8})${stop}`, "i");
  const m = t.match(re);
  return m ? normalizarPatente(m[1]) : null;
}

function fechaCabeceraTSB(texto) {
  const t = String(texto ?? "");
  const candidatos = [
    t.match(/N[°º]?\s*\d{5,}[\s\S]{0,50}?(\d{1,2}\s+\d{1,2}\s+\d{2,4})/i)?.[1],
    t.match(/\bFECHA\s*:?\s*(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4})/i)?.[1],
    t.match(/\b(\d{1,2}\s+\d{1,2}\s+\d{2,4})\b/)?.[1],
  ];
  for (const c of candidatos) {
    const f = normalizarFecha(c);
    if (f) return f;
  }
  return null;
}

function mejorPatente(actual, desdeTexto) {
  const a = actual ? normalizarPatente(actual) : null;
  const b = desdeTexto ? normalizarPatente(desdeTexto) : null;
  if (!b) return a;
  if (!a) return b;
  if (b.includes(a) || b.length > a.length) return b;
  return a;
}

function mejorTexto(actual, fallback) {
  const a = limpiarTextoOcr(actual);
  const b = limpiarTextoOcr(fallback);
  if (!b) return a;
  if (!a) return b;
  if (a.length < 3 && b.length >= 3) return b;
  if (/[а-яА-ЯёЁдД]/.test(a) && b) return b;
  return a;
}

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function enriquecerTSBDesdeTexto(datos, textoOcr = "") {
  if (!datos || !textoOcr?.trim()) return datos;
  const d = { ...datos };
  const frio = extraerTSB(textoOcr);
  const horarios = parsearHorarios(textoOcr);

  const fecha =
    normalizarFecha(d.fecha_guia) ??
    normalizarFecha(frio.fecha_guia) ??
    horarios.fecha_remito ??
    fechaCabeceraTSB(textoOcr);
  if (fecha) {
    d.fecha_guia = fecha;
    if (d.horarios && typeof d.horarios === "object") {
      d.horarios = { ...d.horarios, fecha_remito: fecha };
    }
  }

  d.conductor = mejorConductor(d.conductor, frio.conductor);
  d.procedencia = mejorTexto(d.procedencia, frio.procedencia);
  d.destino = mejorTexto(d.destino, frio.destino);

  const chasisTxt = patenteDesdeTexto(textoOcr, "chasis");
  const acopladoTxt = patenteDesdeTexto(textoOcr, "acoplado");
  d.chasis = mejorPatente(d.chasis, chasisTxt ?? frio.chasis);
  d.acoplado = mejorPatente(d.acoplado, acopladoTxt ?? frio.acoplado);

  if (!d.peso_kg && frio.peso_kg != null) d.peso_kg = frio.peso_kg;
  if (!d.nro_guia && frio.nro_guia) d.nro_guia = frio.nro_guia;

  return d;
}
