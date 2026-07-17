/**
 * Completa campos Beraldi del Custom Extractor con regex sobre texto OCR.
 * Prioriza DENOMIC como destino, OT, nro con copia -1/-2/-3 y limpia basura de lugares.
 */
import { extraerBeraldi } from "./extract-cold.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

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
  if (/hora[_\s]?(ent|sal|ini|fin)/i.test(s)) return true;
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

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function enriquecerBeraldiDesdeTexto(datos, textoOcr = "") {
  if (!textoOcr?.trim()) return datos;
  const frio = extraerBeraldi(textoOcr);
  const d = { ...datos };

  d.nro_remito = mejorNro(d.nro_remito, frio.nro_remito);
  if (!d.ot && frio.ot) d.ot = frio.ot;
  if (!d.fecha_remito && frio.fecha_remito) d.fecha_remito = frio.fecha_remito;

  const destino = mejorTexto(
    d.destino_nombre ?? d.destino ?? d.destino_locacion,
    frio.destino_nombre ?? frio.destino,
  );
  if (destino) {
    d.destino_nombre = destino;
    d.destino = destino;
  }

  const origen = mejorTexto(d.origen, frio.origen);
  if (origen) d.origen = origen;

  if ((d.peso_kg == null || d.peso_kg === "") && frio.peso_kg != null) {
    d.peso_kg = frio.peso_kg;
  }

  if (!d.chofer && frio.chofer) d.chofer = frio.chofer;
  if (!d.tractor && frio.tractor) d.tractor = frio.tractor;
  if (!d.semi && frio.semi) d.semi = frio.semi;
  if (!d.unidad && frio.unidad) d.unidad = frio.unidad;

  return d;
}
