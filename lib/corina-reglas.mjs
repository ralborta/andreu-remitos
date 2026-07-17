/**
 * Reglas de negocio Corina / Quilmes (parseo post-OCR).
 * Definidas en reunión 17/07: nro con guion, CHEP 40517, mapa lugares, semi por tractor.
 */

import { normalizarPatente } from "./normalizar-remito.mjs";

/** Prefijo típico de remito Quilmes Andreu. */
export const CORINA_PREFIJO_REMITO = "3264";

/**
 * Semi por defecto según tractor (1:1).
 * Completar a medida que lleguen unidades; sin Excel todavía.
 * @type {Record<string, string>}
 */
export const SEMI_POR_TRACTOR_CORINA = {
  // Ejemplo: AE001XX: "AB123CD",
};

/** Typos OCR → nombre canónico de chofer. */
export const ALIAS_CHOFER_CORINA = [
  { match: /macarena\s+pana/i, nombre: "MACARENA PADILLA" },
];

/**
 * Códigos / textos del remito → nombre en parámetros (localidades Corina).
 * Orden: primer match gana.
 */
export const MAPEO_LUGARES_CORINA = [
  {
    id: "origen_tunuyan",
    match: /tunuy[aá]n\s*6\d{2,4}/i,
    campo: "origen",
    canon: "Planta Eco Tunuyan",
  },
  {
    id: "origen_planta_eco",
    match: /planta\s*eco\s*tunuy[aá]n/i,
    campo: "origen",
    canon: "Planta Eco Tunuyan",
  },
  {
    id: "destino_andreu",
    match: /ark?1k[-\s]?andreu/i,
    campo: "destino",
    canon: "ANDREU-MENDOZA-DEPOSITOS",
  },
  {
    id: "destino_andreu_nombre",
    match: /andreu\s*[-–]?\s*mendoza\s*[-–]?\s*dep[oó]sito/i,
    campo: "destino",
    canon: "ANDREU-MENDOZA-DEPOSITOS",
  },
  {
    id: "destino_all_palmeras",
    match: /all\s*palmir/i,
    campo: "destino",
    canon: "ALL PALMIRAS",
  },
];

/** Código de línea CHEP retornable. */
export const COD_CHEP_CORINA = "40517";

/**
 * @param {string|null|undefined} nombre
 * @returns {string|null}
 */
export function normalizarChoferCorina(nombre) {
  if (nombre == null || nombre === "") return null;
  let s = String(nombre).replace(/\s+/g, " ").trim().toUpperCase();
  for (const a of ALIAS_CHOFER_CORINA) {
    if (a.match.test(s)) return a.nombre;
  }
  return s || null;
}

/**
 * @param {string|null|undefined} tractor
 * @returns {string|null}
 */
export function semiDefaultPorTractor(tractor) {
  const p = normalizarPatente(tractor);
  if (!p) return null;
  const semi = SEMI_POR_TRACTOR_CORINA[p] ?? SEMI_POR_TRACTOR_CORINA[p.toUpperCase()];
  return semi ? normalizarPatente(semi) : null;
}

/**
 * Aplica mapa de origen/destino sobre texto OCR + campos ya leídos.
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function mapearLugaresCorina(datos, textoOcr = "") {
  const d = { ...datos };
  const blob = `${textoOcr}\n${d.origen ?? ""}\n${d.destino ?? ""}\n${d.cliente ?? ""}`;

  for (const regla of MAPEO_LUGARES_CORINA) {
    if (!regla.match.test(blob)) continue;
    if (regla.campo === "origen" && (!d.origen || regla.match.test(String(d.origen)) || /tunuy/i.test(blob))) {
      d.origen = regla.canon;
    }
    if (regla.campo === "destino") {
      d.destino = regla.canon;
      if (d.cliente && /ark?1k/i.test(String(d.cliente))) {
        d.cliente_codigo = d.cliente;
      }
    }
  }

  // Origen por defecto si el encabezado trae Tunuyán y aún no hay origen.
  if (!d.origen && /tunuy[aá]n\s*6/i.test(textoOcr)) {
    d.origen = "Planta Eco Tunuyan";
  }
  // Destino AR1K sin mapear aún.
  if (!d.destino || /ark?1k/i.test(String(d.destino))) {
    if (/ark?1k[-\s]?andreu/i.test(blob)) d.destino = "ANDREU-MENDOZA-DEPOSITOS";
  }

  return d;
}

/**
 * Reaplica reglas Corina usando texto OCR guardado (CHEP, lugares, chofer, semi).
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function enriquecerCorinaDesdeOcr(datos, textoOcr = "") {
  if (!datos || typeof datos !== "object") return datos;
  let d = { ...datos };
  if (d.conductor) d.conductor = normalizarChoferCorina(d.conductor) ?? d.conductor;
  if ((!d.semi || String(d.semi).trim() === "") && d.tractor) {
    const semi = semiDefaultPorTractor(d.tractor);
    if (semi) d.semi = semi;
  }
  d = mapearLugaresCorina(d, textoOcr);
  const chep = extraerPalletsChep40517(textoOcr);
  if (chep != null) {
    d.pallets_chep = chep;
    d.total_bultos = chep;
  }
  const marca = inferirMarcaClienteCorina(d, textoOcr);
  if (marca) d.cliente_marca = marca;
  return d;
}

/**
 * Hipótesis reunión: remitos desde Planta Eco Tunuyán → Eco de los Andes.
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function inferirMarcaClienteCorina(datos, textoOcr = "") {
  const origen = String(datos.origen ?? "");
  const blob = `${textoOcr}\n${origen}`.toUpperCase();
  if (/ECO\s*DE\s*LOS\s*ANDES|PLANT A?\s*ECO|TUNUY/i.test(blob) || /planta eco tunuyan/i.test(origen)) {
    return "Eco de los Andes";
  }
  if (/CERVECER[IÍ]A|QUILMES|MALTER[IÍ]A/i.test(blob)) {
    return "Cervecería";
  }
  return null;
}

/**
 * Extrae cantidad de pallets CHEP (código 40517) desde el texto OCR.
 * Ejemplos reales:
 *   "24,00 PC\n40517\nPALETA CHEP"
 *   "26.00 PC 40517"
 * @param {string} textoOcr
 * @returns {number|null}
 */
export function extraerPalletsChep40517(textoOcr) {
  if (!textoOcr?.trim()) return null;
  const t = String(textoOcr);

  const patrones = [
    // cantidad PC … 40517 (misma línea o cerca)
    new RegExp(`([\\d]{1,3}(?:[.,]\\d{2})?)\\s*PC\\s*${COD_CHEP_CORINA}\\b`, "i"),
    new RegExp(`([\\d]{1,3}(?:[.,]\\d{2})?)\\s*PC[\\s\\S]{0,40}?\\b${COD_CHEP_CORINA}\\b`, "i"),
    // 40517 … cantidad PC
    new RegExp(`\\b${COD_CHEP_CORINA}\\b[\\s\\S]{0,40}?([\\d]{1,3}(?:[.,]\\d{2})?)\\s*PC`, "i"),
    // "40517" en línea de CHEP con número suelto antes
    new RegExp(`([\\d]{1,3})(?:[.,]00)?\\s*(?:PC)?\\s*\\n\\s*${COD_CHEP_CORINA}\\b`, "i"),
    // OCR degradado: "PO 40517" / "PC40517" sin cantidad → no inventar
  ];

  for (const re of patrones) {
    const m = t.match(re);
    if (!m) continue;
    const n = parseCantidadChep(m[1]);
    if (n != null) return n;
  }
  return null;
}

function parseCantidadChep(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw).trim();
  // "24,00" / "26.00" → 24 / 26
  if (/^\d{1,3}[.,]\d{2}$/.test(s)) {
    s = s.replace(/[.,]\d{2}$/, "");
  }
  s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return Math.round(n);
}
