/**
 * Completa campos MyESA (M&E) del Custom Extractor con regex sobre texto OCR.
 * Etiquetas típicas: LUGAR DE CARGA, DESTINO/POZO, CAMION, ACOPLADO, Peso Neto, Nº Remito.
 */
import { normalizarFecha, parsearHorarios } from "./horarios.mjs";
import { normalizarPatente } from "./normalizar-remito.mjs";
import { normalizarPeso } from "./extract-cold.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

function limpiar(valor) {
  if (valor == null || valor === "") return null;
  const s = String(valor).replace(/\s+/g, " ").trim();
  return s || null;
}

function limpiaPatenteRaw(valor) {
  let s = limpiar(valor);
  if (!s) return null;
  s = s
    .replace(/\bTAG\s*:?\s*/gi, " ")
    .replace(/\bACOP(?:LADO)?\b/gi, " ")
    .replace(/\bPRODU(?:CTO)?\b/gi, " ")
    .replace(/[:|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Preferir patrón patente AR
  const m = s.match(/([A-Z]{0,3}\d{3,4}[A-Z]{0,3}|\d{3,5}[A-Z]{2,3}|[A-Z]\d{3,5}[A-Z]{0,3})/i);
  if (m) return normalizarPatente(m[1]);
  return normalizarPatente(s);
}

function pareceFirmaOBasura(nombre) {
  const u = String(nombre ?? "").toUpperCase();
  if (!u || u.length < 4) return true;
  if (/FIRMA|ACLARAC|RECIB[IÍ]|CONFORME|RECISE/.test(u)) return true;
  if ((u.match(/\s+/g) || []).length > 4) return true;
  return false;
}

function matchGrupo(texto, re) {
  const m = String(texto ?? "").match(re);
  return m ? limpiar(m[1]) : null;
}

function fechaCabeceraMye(texto) {
  const t = String(texto ?? "");
  const candidatos = [
    t.match(/\bFecha\s*:?\s*(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4})/i)?.[1],
    t.match(/\bFecha\s*:?\s*(\d{1,2}\s+\d{1,2}\s+\d{2,4})/i)?.[1],
    t.match(/\b(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4})\b/)?.[1],
  ];
  for (const c of candidatos) {
    const f = normalizarFecha(c);
    if (f) return f;
  }
  return null;
}

function mejorTexto(actual, fallback) {
  const a = limpiar(actual);
  const b = limpiar(fallback);
  if (!b) return a;
  if (!a) return b;
  if (pareceFirmaOBasura(b) && !pareceFirmaOBasura(a)) return a;
  if (pareceFirmaOBasura(a) && !pareceFirmaOBasura(b)) return b;
  if (a.length < 3 && b.length >= 3) return b;
  if (b.length > a.length + 2 && !pareceFirmaOBasura(b)) return b;
  return a;
}

function mejorConductor(actual, fallback) {
  const a = limpiar(actual);
  const b = limpiar(fallback);
  if (a && !pareceFirmaOBasura(a)) return a;
  if (b && !pareceFirmaOBasura(b)) return b;
  return a || b;
}

function mejorPatente(actual, desdeTexto) {
  const a = limpiaPatenteRaw(actual);
  const b = limpiaPatenteRaw(desdeTexto);
  if (!b) return a;
  if (!a) return b;
  if (b.includes(a) || b.length > a.length) return b;
  return a;
}

/**
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function enriquecerMyeDesdeTexto(datos, textoOcr = "") {
  if (!datos || !textoOcr?.trim()) return datos;
  const d = { ...datos };
  const t = textoOcr;
  const horarios = parsearHorarios(textoOcr);

  const fecha =
    normalizarFecha(d.fecha_guia) ??
    horarios.fecha_remito ??
    fechaCabeceraMye(textoOcr);
  if (fecha) {
    d.fecha_guia = fecha;
    if (d.horarios && typeof d.horarios === "object") {
      d.horarios = { ...d.horarios, fecha_remito: fecha };
    }
  }

  const nroInterno = matchGrupo(t, /N[°º]?\s*0*(\d{5,})/i);
  const nroRemito = matchGrupo(
    t,
    /N[°º.]?\s*Remito\s*:?\s*([\d\-–—]+)/i,
  ) ?? matchGrupo(t, /Remito\s*N[ií°º.]?\s*:?\s*([\d\-–—]+)/i);

  if (!d.nro_guia && (nroRemito || nroInterno)) {
    d.nro_guia = normalizarNroRemitoGuia(nroRemito || nroInterno);
  }
  if (!d.remito_cliente && nroRemito) d.remito_cliente = limpiar(nroRemito);
  if (!d.nro_interno && nroInterno) d.nro_interno = nroInterno;

  d.conductor = mejorConductor(
    d.conductor,
    matchGrupo(t, /CHOFER\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ\s.]+?)(?=\s*(?:EQUIPO|CAMION|ACOPLADO|PRODUCTO|$))/i),
  );

  // Preferir conductor del extractor si el regex no encontró uno limpio
  if (pareceFirmaOBasura(d.conductor)) d.conductor = null;

  const camion =
    matchGrupo(t, /CAMION\s*:?\s*([A-Z0-9\s:]{4,18})/i) ??
    matchGrupo(t, /EQUIPO\s*:?\s*[\d\/]+\s*[^\n]*?([A-Z]?\d{3,5}\s*[A-Z:]{0,6})/i);
  d.chasis = mejorPatente(d.chasis, camion);

  const acoplado = matchGrupo(t, /ACOPLADO\s*:?\s*([A-Z0-9\s:]{4,18})/i);
  d.acoplado = mejorPatente(d.acoplado, acoplado);

  d.procedencia = mejorTexto(
    d.procedencia,
    matchGrupo(
      t,
      /LUGAR\s+DE\s+CARGA\s*:?\s*([^\n]+?)(?=\s*(?:DESTINO|CHOFER|EQUIPO|CAMION|$))/i,
    ),
  );

  let destino = mejorTexto(
    d.destino,
    matchGrupo(t, /DESTINO\s*\/?\s*POZO\s*:?\s*([^\n]+?)(?=\s*(?:CHOFER|EQUIPO|CAMION|PRODUCTO|$))/i),
  );
  if (destino === ":" || destino === "-" || (destino && destino.length < 2)) destino = null;
  d.destino = destino;

  // nro_interno en MyESA suele ser el N° de remito interno (0018xxxx), no EQUIPO
  if (d.nro_interno && /[\/]/.test(String(d.nro_interno))) {
    const nroHdr = matchGrupo(t, /N[°º]?\s*(0*1\d{6,})/i);
    if (nroHdr) d.nro_interno = nroHdr.replace(/^0+/, "") ? nroHdr : d.nro_interno;
    // Si parece equipo (544/998), preferir el N° de cabecera
    if (/^\d{2,4}\s*\/\s*\d/.test(String(d.nro_interno))) {
      const cab = matchGrupo(t, /\bN[°º]?\s*(00?\d{6,})\b/i);
      if (cab) d.nro_interno = cab;
    }
  }

  d.malla = mejorTexto(
    d.malla,
    matchGrupo(t, /PRODUCTO\s+TRANSPORTADO\s*:?\s*([^\n]+)/i),
  );

  if (!d.peso_kg) {
    const pesoRaw =
      matchGrupo(t, /Peso\s+Neto\s*:?\s*([\d.,]+)/i) ??
      matchGrupo(t, /CANTIDAD\s*:?\s*[^\d]*([\d.,]+)/i);
    if (pesoRaw) d.peso_kg = normalizarPeso(pesoRaw);
  }

  return d;
}
