/**
 * Reglas de negocio Corina / Quilmes (parseo post-OCR).
 * Definidas en reunión 17/07: nro con guion, CHEP 40517, mapa lugares, semi por tractor.
 */

import { normalizarPatente } from "./normalizar-remito.mjs";

/** Prefijo típico de remito Quilmes Andreu. */
export const CORINA_PREFIJO_REMITO = "3264";

/**
 * Semi por defecto según tractor (1:1).
 * Preferir `semi_patente` en Parámetros → Unidades (tipo tractor).
 * Fallback: mapa hardcodeado.
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
 *
 * Prioridad de destino (reunión Gisela/Mauricio):
 * 1) Entrega Andreu (AR1K-ANDREU / Acceso Sur / Andreu Mendoza Depósitos)
 * 2) ALL PALMIRAS
 * 3) Entrega a planta Cervecería (solo si NO hay señal Andreu)
 *
 * Miguel Cervantes 2289 / Planta Mendoza = emisor Quilmes → ORIGEN (CERVECERIA ANDES),
 * no destino. El letterhead "Cervecería y Maltería Quilmes" tampoco es destino.
 */
export const DESTINO_ANDREU_CORINA = "ANDREU-MENDOZA-DEPOSITOS";
export const ORIGEN_CERVECERIA_ANDES = "CERVECERIA ANDES";

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
    id: "origen_miguel_cervantes",
    match: /miguel\s*cervantes|cervantes\s*2289|planta\s*mendoza/i,
    campo: "origen",
    canon: ORIGEN_CERVECERIA_ANDES,
  },
  {
    id: "destino_andreu",
    match: /ark?1k[-\s]?andreu/i,
    campo: "destino",
    canon: DESTINO_ANDREU_CORINA,
  },
  {
    id: "destino_andreu_nombre",
    match: /andreu\s*[-–]?\s*mendoza\s*[-–]?\s*dep[oó]sito/i,
    campo: "destino",
    canon: DESTINO_ANDREU_CORINA,
  },
  {
    id: "destino_acceso_sur",
    match: /acceso\s*sur/i,
    campo: "destino",
    canon: DESTINO_ANDREU_CORINA,
  },
  {
    id: "destino_all_palmeras",
    match: /all\s*palmir/i,
    campo: "destino",
    canon: "ALL PALMIRAS",
  },
];

/** Señales de entrega a depósitos Andreu (no al letterhead Quilmes). */
export function esEntregaAndreuCorina(texto = "") {
  const t = String(texto);
  return (
    /ark?1k[-\s]?andreu/i.test(t) ||
    /acceso\s*sur/i.test(t) ||
    /andreu\s*[-–]?\s*mendoza\s*[-–]?\s*dep[oó]sito/i.test(t) ||
    new RegExp(`^\\s*${DESTINO_ANDREU_CORINA}\\s*$`, "i").test(t.trim())
  );
}

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
 * @param {Array<{ tipo?: string, patente?: string, semi_patente?: string|null }>|null} [unidades]
 * @returns {string|null}
 */
export function semiDefaultPorTractor(tractor, unidades = null) {
  const p = normalizarPatente(tractor);
  if (!p) return null;
  if (Array.isArray(unidades)) {
    const u = unidades.find(
      (row) =>
        row?.tipo === "tractor" &&
        normalizarPatente(row.patente) === p &&
        row.semi_patente,
    );
    if (u?.semi_patente) return normalizarPatente(u.semi_patente);
  }
  const semi = SEMI_POR_TRACTOR_CORINA[p] ?? SEMI_POR_TRACTOR_CORINA[p.toUpperCase()];
  return semi ? normalizarPatente(semi) : null;
}

/**
 * Aplica mapa de origen/destino sobre texto OCR + campos ya leídos.
 * Portal y WhatsApp usan el mismo path (`enriquecerCorinaDesdeOcr` / extract).
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 */
export function mapearLugaresCorina(datos, textoOcr = "") {
  const d = { ...datos };
  const blob = `${textoOcr}\n${d.origen ?? ""}\n${d.destino ?? ""}\n${d.cliente ?? ""}`;
  const entregaAndreu = esEntregaAndreuCorina(blob);

  // Origen: Eco Tunuyán o emisor Quilmes (Miguel Cervantes), nunca como destino.
  if (/tunuy[aá]n\s*6\d{2,4}|planta\s*eco\s*tunuy[aá]n/i.test(blob)) {
    d.origen = "Planta Eco Tunuyan";
  } else if (/miguel\s*cervantes|cervantes\s*2289|planta\s*mendoza/i.test(blob)) {
    const origenActual = String(d.origen ?? "");
    if (
      !origenActual ||
      /cervecer|quilmes|miguel|planta\s*mendoza|andes/i.test(origenActual)
    ) {
      d.origen = ORIGEN_CERVECERIA_ANDES;
    }
  } else if (!d.origen && /tunuy[aá]n\s*6/i.test(textoOcr)) {
    d.origen = "Planta Eco Tunuyan";
  }

  // Destino: Andreu gana siempre si hay señal de entrega.
  if (entregaAndreu) {
    d.destino = DESTINO_ANDREU_CORINA;
    if (d.cliente && /ark?1k/i.test(String(d.cliente))) {
      d.cliente_codigo = d.cliente;
    }
  } else if (/all\s*palmir/i.test(blob)) {
    d.destino = "ALL PALMIRAS";
  } else if (
    // Viaje hacia planta Cervecería (sin Acceso Sur / AR1K).
    /(?:destino|entrega|ship\s*to)[\s\S]{0,120}?(?:miguel\s*cervantes|planta\s*mendoza|cervecer[ií]a\s*andes)/i.test(
      blob,
    )
  ) {
    d.destino = ORIGEN_CERVECERIA_ANDES;
  } else {
    // Letterhead Quilmes / Miguel Cervantes no son destino.
    const dest = String(d.destino ?? "");
    if (
      /cervecer[ií]a\s*(y\s*malter[ií]a\s*)?(andes|quilmes)/i.test(dest) ||
      /miguel\s*cervantes/i.test(dest) ||
      /^cervecer[ií]a\s*quilmes$/i.test(dest.trim())
    ) {
      d.destino = null;
    }
  }

  return d;
}

/**
 * Reaplica reglas Corina usando texto OCR guardado (CHEP, lugares, chofer, semi).
 * @param {Record<string, unknown>} datos
 * @param {string} [textoOcr]
 * @param {{ unidades?: Array<{ tipo?: string, patente?: string, semi_patente?: string|null }> }} [opts]
 */
export function enriquecerCorinaDesdeOcr(datos, textoOcr = "", opts = {}) {
  if (!datos || typeof datos !== "object") return datos;
  let d = { ...datos };
  if (d.conductor) d.conductor = normalizarChoferCorina(d.conductor) ?? d.conductor;
  if ((!d.semi || String(d.semi).trim() === "") && d.tractor) {
    const semi = semiDefaultPorTractor(d.tractor, opts.unidades ?? null);
    if (semi) d.semi = semi;
  }
  d = mapearLugaresCorina(d, textoOcr);
  const chep = extraerPalletsChep40517(textoOcr);
  if (chep != null) {
    d.pallets_chep = chep;
    d.total_bultos = chep;
  }
  const marca = inferirMarcaClienteCorina(d, textoOcr);
  if (marca && !d.cliente_marca) d.cliente_marca = marca;
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
