/**
 * Completa campos Beraldi del Custom Extractor con regex sobre texto OCR.
 * Prioriza DENOMIC como destino, OT, nro con copia -1/-2/-3 y limpia basura de lugares.
 */
import { extraerBeraldi } from "./extract-cold.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";
import {
  fusionarSlotsHorarios,
  normalizarFecha,
  parsearHorarios,
  validarOrdenHorarios,
} from "./horarios.mjs";
import {
  extraerPatentesManuscritasBeraldi,
  mejorPatenteOcr,
} from "./patente-ocr.mjs";
import { sanearFechaRespectoRecepcion } from "./validacion-calidad-beraldi.mjs";

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
  // Etiquetas del formulario sin valor. "DENOMINAC" puede ser el destino real.
  if (/^(hora|peso|chofer|tractor|semi|cimsa|locacion|destino|origen)$/i.test(s)) {
    return true;
  }
  return false;
}

/** Códigos de pozo/locación YPF (LCAV-174-2, LLL-12…); no son el DENOMINAC. */
function pareceCodigoLocacion(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return false;
  if (/^[A-Z]{2,5}[-\s]?\d{1,4}([-\s]\d{1,4})?/i.test(s)) return true;
  if (/\bTrack[-\s]?\d+/i.test(s)) return true;
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

/**
 * Destino Beraldi = lo escrito en DENOMIC/DENOMINAC (Antonela).
 * Nunca preferir el código LOCACION (LCAV-…) sobre el nombre.
 */
function mejorDestinoBeraldi(actual, frio) {
  const cand = [
    frio?.destino_nombre,
    frio?.destino,
    actual?.destino_nombre,
    actual?.destino,
  ]
    .map((v) => limpiarTextoOcr(v))
    .filter((v) => v && !pareceBasuraLugar(v) && !pareceCodigoLocacion(v));
  if (cand.length) return cand[0];

  const loc =
    limpiarTextoOcr(actual?.destino_locacion) ||
    limpiarTextoOcr(frio?.destino_locacion) ||
    limpiarTextoOcr(actual?.destino) ||
    limpiarTextoOcr(frio?.destino);
  if (loc && !pareceBasuraLugar(loc)) return loc;
  return null;
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

/** Año claramente viejo para un remito operativo (OCR leyó 20 en vez de 26). */
function fechaAnioSospechoso(iso) {
  const y = Number(String(iso ?? "").slice(0, 4));
  if (!Number.isFinite(y)) return false;
  const actual = new Date().getFullYear();
  return y < actual - 1;
}

/** Si el año quedó en el pasado lejano, rearmar con año actual (o anterior si caería a futuro). */
function sanearFechaRemitoReciente(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mo = +m[2];
  const d = +m[3];
  const now = new Date();
  const yActual = now.getFullYear();
  for (const y of [yActual, yActual - 1]) {
    const cand = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dt = new Date(`${cand}T12:00:00`);
    if (Number.isNaN(dt.getTime())) continue;
    if (dt.getFullYear() !== y || dt.getMonth() + 1 !== mo || dt.getDate() !== d) continue;
    // No aceptar fechas a más de 2 días en el futuro.
    if (dt.getTime() - now.getTime() > 2 * 24 * 3600 * 1000) continue;
    return cand;
  }
  return null;
}

/** OT Beraldi: latin/griego/cirílico + "Not:" / "OT-354070" manuscrito habitual. */
export function extraerOtBeraldi(textoOcr = "") {
  const t = String(textoOcr ?? "");
  const patterns = [
    /[OΟОо]\s*[.\-]?\s*[TТт]\s*[-–—.:]?\s*(\d{4,7})\b/i,
    /(?:^|\n)\s*Not\s*[.:]?\s*(\d{4,7})/im,
    /N[°ºo.]?\s*(?:DE\s*)?OT\s*[-–—.:]?\s*(\d{4,7})/i,
    /\bOT\s*[-–—.:]?\s*(\d{4,7})\b/i,
    // Junto a CLIENTE / YPF (posición típica arriba derecha)
    /(?:CLIENTE|YPF)[^\n]{0,40}?[OΟОо]\s*[TТт]\s*[-–—.:]?\s*(\d{4,7})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      return sanearOtDigitoExtra(m[1]);
    }
  }
  return null;
}

/** OT Beraldi suele tener 6 dígitos; OCR a veces inserta un dígito (3351633 → 351633). */
function sanearOtDigitoExtra(digits) {
  const d = String(digits ?? "").replace(/\D/g, "");
  if (d.length >= 4 && d.length <= 6) return d;
  if (d.length !== 7) return d.length <= 7 ? d : d.slice(0, 7);
  // Quitar el primero de un par consecutivo repetido (33… / 55…).
  for (let i = 0; i < d.length - 1; i++) {
    if (d[i] === d[i + 1]) {
      const alt = d.slice(0, i) + d.slice(i + 1);
      if (alt.length === 6) return alt;
    }
  }
  // Sin dobles: descartar el 2º dígito (caso 3X51633 mal leído).
  return d[0] + d.slice(2);
}

/** Alias OCR frecuentes → forma canónica para matching de localidades. */
export function normalizarAliasLugarBeraldi(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor).replace(/\s+/g, " ").trim();
  if (!s) return null;
  // TRON-22 / Iron 22 / TQN-22 / Ton-22 / Trom 22
  s = s.replace(/\b(iron|tq[nm]|ton|trom|tron\.?)\s*[-–—]?\s*(\d{1,3})\b/gi, "TRON-$2");
  s = s.replace(/\btron\s+(\d{1,3})\b/gi, "TRON-$1");
  // Loma Campana
  s = s.replace(/\b(coma|loma|lomá)\s+campan[ao]s?\b/gi, "LOMA CAMPANA");
  s = s.replace(/\blcav\b/gi, "LCAV");
  // Laje / Lote cerca de TRON: conservar pero limpiar
  s = s.replace(/\blaje\b/gi, "Laje");
  s = s.replace(/\blote\b/gi, "Lote");
  return s;
}

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 * @param {{ referenciaFecha?: string|Date|null }} [opts]
 *   referenciaFecha = created_at del remito (no “hoy”), para no reescribir fechas al listar.
 */
export function enriquecerBeraldiDesdeTexto(datos, textoOcr = "", opts = {}) {
  if (!textoOcr?.trim()) return datos;
  const frio = extraerBeraldi(textoOcr);
  const d = { ...datos };
  const refFecha = opts.referenciaFecha ? new Date(opts.referenciaFecha) : new Date();
  const refOk = !Number.isNaN(refFecha.getTime()) ? refFecha : new Date();
  const edicionManual = d._editado_manual === true;

  d.nro_remito = mejorNro(d.nro_remito, frio.nro_remito);
  const otTxt = extraerOtBeraldi(textoOcr);
  const otFrio = frio.ot ? String(frio.ot).replace(/\D/g, "") : null;
  const otActual = d.ot ? String(d.ot).replace(/\D/g, "") : null;
  // Preferir OT del texto si la del extractor está vacía o tiene largo raro (dígito de más).
  if (!otActual && (otFrio || otTxt)) d.ot = otFrio || otTxt;
  else if (otActual && otActual.length > 7 && (otTxt || otFrio)) d.ot = otTxt || otFrio;
  else if (otActual && otActual.length === 7 && otTxt && otTxt.length === 6) d.ot = otTxt;
  else if (otActual) d.ot = otActual;

  const fechaActual = normalizarFecha(d.fecha_remito);
  const fechaFrio = normalizarFecha(frio.fecha_remito);
  // Preferir fecha reciente del OCR frío si Document AI dejó un año viejo (20→2020).
  if (!fechaActual && fechaFrio) d.fecha_remito = fechaFrio;
  else if (fechaActual && fechaFrio && fechaAnioSospechoso(fechaActual) && !fechaAnioSospechoso(fechaFrio)) {
    d.fecha_remito = fechaFrio;
  } else if (fechaActual && fechaAnioSospechoso(fechaActual)) {
    const saneada = sanearFechaRemitoReciente(fechaActual);
    if (saneada) d.fecha_remito = saneada;
  } else if (fechaActual) {
    d.fecha_remito = fechaActual;
  }
  // Mes mal leído (17/12 vs 17/11): acercar a la fecha de recepción del remito (created_at).
  // No reajustar si mesa/chofer ya editaron manualmente.
  if (d.fecha_remito && !edicionManual) {
    const ajustada = sanearFechaRespectoRecepcion(d.fecha_remito, refOk);
    if (ajustada.iso && (ajustada.corregida || !ajustada.sospechosa)) {
      if (fechaFrio) {
        const af = sanearFechaRespectoRecepcion(fechaFrio, refOk);
        const aa = sanearFechaRespectoRecepcion(d.fecha_remito, refOk);
        if (af.iso && !af.sospechosa && aa.sospechosa) d.fecha_remito = af.iso;
        else if (ajustada.corregida && !ajustada.sospechosa) d.fecha_remito = ajustada.iso;
      } else if (ajustada.corregida && !ajustada.sospechosa) {
        d.fecha_remito = ajustada.iso;
      }
    }
  }

  const destino = normalizarAliasLugarBeraldi(mejorDestinoBeraldi(d, frio));
  if (destino) {
    d.destino_nombre = destino;
    d.destino = destino;
    // Conservar código LOCACION aparte si el destino elegido es el nombre.
    const loc = normalizarAliasLugarBeraldi(
      limpiarTextoOcr(frio.destino_locacion) ||
        (pareceCodigoLocacion(d.destino_locacion) ? limpiarTextoOcr(d.destino_locacion) : null),
    );
    d.destino_locacion = loc && pareceCodigoLocacion(loc) ? loc : destino;
  }

  const origen = normalizarAliasLugarBeraldi(mejorTexto(d.origen, frio.origen));
  if (origen && !pareceCodigoLocacion(origen)) d.origen = origen;
  else if (origen && (!d.origen || pareceBasuraLugar(d.origen))) d.origen = origen;

  if ((d.peso_kg == null || d.peso_kg === "" || d._peso_estimado) && frio.peso_kg != null) {
    d.peso_kg = frio.peso_kg;
    delete d._peso_estimado;
  }

  if (!d.chofer && frio.chofer) d.chofer = frio.chofer;

  const manuscritas = extraerPatentesManuscritasBeraldi(textoOcr);
  const tractorTxt = frio.tractor || manuscritas.tractor;
  const semiTxt = frio.semi || manuscritas.semi;
  d.tractor = elegirPatenteBeraldi(d.tractor, tractorTxt, textoOcr, "TRACTOR");
  d.semi = elegirPatenteBeraldi(d.semi, semiTxt, textoOcr, "SEMI");
  // Evitar copiar la misma patente a tractor y semi.
  if (d.tractor && d.semi && String(d.tractor).toUpperCase() === String(d.semi).toUpperCase()) {
    if (semiTxt && String(semiTxt).toUpperCase() !== String(d.tractor).toUpperCase()) {
      d.semi = mejorPatenteOcr(null, semiTxt);
    } else if (tractorTxt && String(tractorTxt).toUpperCase() !== String(d.semi).toUpperCase()) {
      d.tractor = mejorPatenteOcr(null, tractorTxt);
    }
  }
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
  // Preferir odómetro 6 dígitos del texto si Document AI trajo un 5 dígitos raro (ej. 96848).
  if (
    leido.km_inicial &&
    leido.km_final &&
    parKmRazonable(leido.km_inicial, leido.km_final) &&
    leido.km_inicial.length >= 6 &&
    leido.km_final.length >= 6 &&
    (!kmIni || !kmFin || kmIni.length <= 5 || kmFin.length <= 5 || !parKmRazonable(kmIni, kmFin))
  ) {
    kmIni = leido.km_inicial;
    kmFin = leido.km_final;
  }
  // KM FIN truncado (2027) frente a un inicio 6 dígitos: descartar el fin basura.
  if (kmIni && kmFin && kmIni.length >= 6 && kmFin.length <= 4) {
    kmFin = leido.km_final && parKmRazonable(kmIni, leido.km_final) ? leido.km_final : null;
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

  // Document AI suele traer 2–4 horas; completar huecos con OCR en frío.
  const frioHorarios = frio.horarios?.horarios ?? parsearHorarios(textoOcr).horarios;
  const fechaBase =
    normalizarFecha(d.fecha_remito) ??
    normalizarFecha(frio.fecha_remito) ??
    normalizarFecha(d.horarios?.fecha_remito) ??
    null;
  const actualSlots = d.horarios?.horarios ?? d.horarios ?? {};
  const mergedSlots = fusionarSlotsHorarios(actualSlots, frioHorarios, fechaBase);
  const validacion = validarOrdenHorarios(mergedSlots, { fechaRemito: fechaBase });
  d.horarios = {
    tenant: "beraldi",
    fecha_remito: fechaBase,
    horarios: validacion.horarios ?? mergedSlots,
    validacion,
  };

  // Nro remito a veces está solo como 00009-… / 00003-… sin etiqueta clara.
  if (!d.nro_remito) {
    const nroTxt = extraerNroRemitoBeraldiTexto(textoOcr);
    if (nroTxt) d.nro_remito = nroTxt;
  }

  return d;
}

/** Busca nro remito Beraldi suelto en el OCR (esquina / prefijo 00009). */
export function extraerNroRemitoBeraldiTexto(textoOcr = "") {
  const t = String(textoOcr ?? "");
  const patterns = [
    /REMITO\s*N[°ºo.]?\s*((?:\d{4,5}\s*[-–—]\s*)?\d{5,10}(?:\s*[-–—]\s*\d{1,2})?)/i,
    /N(?:RO|UMERO|\.|°|º)?\s*(?:DE\s*)?REMITO\s*:?\s*((?:\d{4,5}\s*[-–—]\s*)?\d{5,10}(?:\s*[-–—]\s*\d{1,2})?)/i,
    /\b(00009\s*[-–—]?\s*\d{5,8}(?:\s*[-–—]\s*\d{1,2})?)\b/i,
    /\b(\d{5}\s*[-–—]\s*\d{6,10}(?:\s*[-–—]\s*\d{1,2})?)\b/,
    /\b(\d{4}\s*[-–—]\s*\d{6,10}(?:\s*[-–—]\s*\d{1,2})?)\b/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    const n = normalizarNroRemitoGuia(m[1], { tenant: "beraldi" });
    if (n) return n;
  }
  return null;
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

/**
 * Odómetros manuscritos suelen venir con miles: "89 390" / "89.390".
 * También captura corridos 4–7 dígitos.
 */
function numerosCerca(texto, from, to) {
  const start = Math.max(0, from);
  const end = Math.min(texto.length, to);
  const slice = texto.slice(start, end);
  const out = [];
  const vistos = new Set();
  // No mezclar "125.105 125.263" en un solo match (espacio ≠ miles si ya hubo punto).
  const re = /\b(\d{1,3}(?:\.\d{3}){1,2}|\d{1,3}(?:\s\d{3}){1,2}|\d{3,7})\b/g;
  for (const m of slice.matchAll(re)) {
    const index = start + m.index;
    const prev = texto[index - 1];
    const next = texto[index + m[1].length];
    if (prev === ":" || next === ":") continue;
    const km = normalizarKmValor(m[1]);
    if (!km || vistos.has(`${index}:${km}`)) continue;
    // Si el match corto (390) está dentro de un "89 390" ya tomado, saltearlo
    let cubierto = false;
    for (const prevN of out) {
      if (index >= prevN.index && index < prevN.index + prevN.rawLength) {
        cubierto = true;
        break;
      }
    }
    if (cubierto) continue;
    vistos.add(`${index}:${km}`);
    out.push({ valor: km, index, rawLength: m[1].length });
  }
  return out;
}

function valorHorasMotor(texto, re, excluir = new Set()) {
  const m = texto.match(re);
  if (!m) return null;
  const labelStart = m.index;
  const labelEnd = m.index + m[0].length;
  const antes = numerosCerca(texto, labelStart - 24, labelStart).filter(
    (n) => n.index + (n.rawLength || n.valor.length) <= labelStart,
  );
  const despues = numerosCerca(texto, labelEnd, labelEnd + 24);
  const a = antes.at(-1) ?? null;
  const d = despues[0] ?? null;
  const gapAntes = a ? labelStart - (a.index + (a.rawLength || a.valor.length)) : Infinity;
  const gapDespues = d ? d.index - labelEnd : Infinity;
  const candidatos = [];
  if (a && gapAntes <= 16 && pareceHorasMotor(a.valor) && !excluir.has(a.valor)) {
    candidatos.push({ valor: a.valor, gap: gapAntes, lado: "antes" });
  }
  if (d && gapDespues <= 16 && pareceHorasMotor(d.valor) && !excluir.has(d.valor)) {
    // Preferir el valor a la derecha de la etiqueta si el de la izquierda
    // ya es el otro horómetro (Ini 8270 … Fin 8277).
    candidatos.push({ valor: d.valor, gap: gapDespues - 0.5, lado: "despues" });
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
      (n) => n.index + (n.rawLength || n.valor.length) <= labelStart,
    ),
    ...numerosCerca(texto, labelEnd, labelEnd + 48),
  ];
  const vistos = new Set();
  const out = [];
  for (const n of nums) {
    if (motores.has(n.valor) || vistos.has(n.valor)) continue;
    const km = normalizarKmValor(n.valor);
    if (!km) continue;
    // Preferir odómetro 5–7 dígitos sobre trozos de 3–4 (miles partidos)
    if (km.length < 4) continue;
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
      // Preferir pares de odómetro (más dígitos) y, a igual largo, el delta menor
      const score = Math.min(ini.length, fin.length) * 10000 - delta;
      if (!best || score > best.score) {
        best = { km_inicial: ini, km_final: fin, delta, score };
      }
    }
  }
  return best;
}

/**
 * Separa odómetro (Km Inicial/Final) del horómetro (Hs. Motor Inicial/Final).
 * En el formulario el valor suele ir a la izquierda de la etiqueta, así que el
 * número que queda entre "Km Inicial" y "Hs. Motor Inicial" es horas motor.
 * Etiquetas reales: "Km. Inicial" / "Km Inicial" (con o sin punto).
 */
export function extraerKmBeraldi(textoOcr = "") {
  const t = textoPlanoKm(textoOcr);
  if (!t) return {};

  const motorInicial = valorHorasMotor(t, /hs\.?\s*motor\s*inic\w*/i);
  const motorFinal = valorHorasMotor(
    t,
    /hs\.?\s*motor\s*fin\w*/i,
    new Set([motorInicial].filter(Boolean)),
  );
  const motores = new Set([motorInicial, motorFinal].filter(Boolean));
  const par = mejorParKm(
    candidatosKm(t, /km\.?\s*inic\w*/i, motores),
    candidatosKm(t, /km\.?\s*fin\w*/i, motores),
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
 * También intenta si OCR solo trajo una etiqueta (Inicio o Fin).
 */
export function extraerKmHuerfanosBeraldi(textoOcr = "", excluir = new Set()) {
  const t = String(textoOcr ?? "");
  const hasIni = /km\.?\s*inic/i.test(t) || /\binicio\b/i.test(t);
  const hasFin = /km\.?\s*fin/i.test(t);
  if (!hasIni && !hasFin && !/\bkm\b/i.test(t)) return {};

  const afterLabels =
    (hasIni ? t.split(/km\.?\s*inic\w*/i).slice(1).join(" ") : "") ||
    (hasFin ? t.split(/km\.?\s*fin\w*/i).slice(0, 1).join(" ") : "") ||
    t;
  const reKm = /\b(\d{1,3}(?:\.\d{3}){1,2}|\d{1,3}(?:\s\d{3}){1,2}|\d{4,7})\b/g;
  const nums = [...afterLabels.matchAll(reKm)]
    .map((m) => normalizarKmValor(m[1]))
    .filter((n) => n && !excluir.has(n));

  for (let i = 0; i < nums.length - 1; i++) {
    const a = nums[i];
    const b = nums[i + 1];
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) continue;
    if (nb <= na) continue;
    if (nb - na > 5000) continue; // viaje Beraldi típico << 5000 km
    // Preferir pares de odómetro (5–7 dígitos) sobre horómetro+odómetro
    if (a.length >= 5 && b.length >= 5) {
      return { km_inicial: a, km_final: b };
    }
  }
  for (let i = 0; i < nums.length - 1; i++) {
    if (parKmRazonable(nums[i], nums[i + 1]) && nums[i].length >= 4 && nums[i + 1].length >= 4) {
      return { km_inicial: nums[i], km_final: nums[i + 1] };
    }
  }

  // Solo hay un odómetro legible cerca de "Km Fin": buscar el anterior razonable.
  if (nums.length >= 1 && hasFin) {
    const fin = nums.find((n) => n.length >= 5) ?? nums[nums.length - 1];
    const antes = [...t.matchAll(reKm)]
      .map((m) => normalizarKmValor(m[1]))
      .filter((n) => n && !excluir.has(n) && n !== fin);
    for (let i = antes.length - 1; i >= 0; i--) {
      if (parKmRazonable(antes[i], fin)) {
        return { km_inicial: antes[i], km_final: fin };
      }
    }
  }
  return {};
}

/**
 * Elige patente: si la del extractor no aparece en el OCR pero la del texto sí,
 * preferir la del texto (evita UN100AD inventado por Vision).
 */
function elegirPatenteBeraldi(actual, fallback, textoOcr, etiqueta) {
  const t = String(textoOcr ?? "").toUpperCase().replace(/\s+/g, "");
  const a = actual ? String(actual).toUpperCase().replace(/\s+/g, "") : "";
  const f = fallback ? String(fallback).toUpperCase().replace(/\s+/g, "") : "";
  const aEnTexto = a && t.includes(a);
  const fEnTexto = f && t.includes(f);
  if (fEnTexto && !aEnTexto) return mejorPatenteOcr(null, fallback);
  // Preferir valor junto a la etiqueta TRACTOR/SEMI del formulario.
  if (etiqueta && f) {
    const re = new RegExp(`${etiqueta}\\s*[.:]?\\s*${f.slice(0, 4)}`, "i");
    if (re.test(String(textoOcr ?? "")) && fEnTexto) return mejorPatenteOcr(null, fallback);
  }
  return mejorPatenteOcr(actual, fallback);
}

/** Odómetro Beraldi: 4–7 dígitos; admite "89 390" / "89.390"; O/I/l → 0/1. */
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
