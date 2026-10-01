/**
 * Clasificación de documentos Andreu por OCR/texto.
 * Evita mezclar remitos ↔ rendiciones ↔ hoja de ruta.
 */
import { pareceDocumentoHojaRuta } from "./hoja-ruta.mjs";
import { pareceDocumentoGasto } from "./rendicion-wa.mjs";

/** Campos típicos del formulario logístico aunque el OCR no lea la palabra "remito". */
function tieneCamposRemitoLogistico(t) {
  const campos =
    /\b(tractor|semi|km\s*inicial|hs\.?\s*motor|n[°º]\s*contrato|unidad|bultos|destinatario)\b/.test(
      t,
    );
  const actores = /\b(chofer|cliente|producto)\b/.test(t);
  return campos && actores;
}

/**
 * Remito de cliente (TSB / Beraldi / Corina / MYE) — no es ticket de gasto.
 */
export function pareceDocumentoRemito(ocrTexto) {
  const t = String(ocrTexto ?? "").toLowerCase();
  if (!t.trim()) return false;

  // Hoja de ruta Andreu: tiene chofer/km y NO es remito de cliente
  if (pareceDocumentoHojaRuta(t)) return false;

  // Título REMITO: gana aunque el cliente sea YPF (antes el YPF lo robaba a nafta)
  if (/\bremito\b/.test(t) && !/ticket\s*de\s*peaje|comprobante\s*de\s*peaje/.test(t)) {
    return true;
  }

  // Formularios típicos MYE / logística
  if (
    /llegada\s+a\s+la\s+carga|inicio\s+de\s+la\s+carga|salida\s+de\s+la\s+planta|fin\s+de\s+la\s+descarga/.test(
      t,
    )
  ) {
    return true;
  }

  // Membretados de clientes logísticos (alcanza con la marca del papel)
  if (
    /transportes\s+beraldi|beraldi\s+s\.?\s*a|mye\s*s\.?\s*a|m\s*&\s*e\s*s\.?\s*a/.test(t)
  ) {
    return true;
  }
  if (
    /\b(tsb|cervecer[ií]a\s+y\s+malter[ií]a|eco\s*de\s*los\s*andes)\b/.test(t) &&
    !pareceDocumentoGasto(t)
  ) {
    if (
      /\b(cliente|chofer|producto|bultos|destinatario|gu[ií]a|n[°º]|administraci[oó]n|pinzon)\b/.test(
        t,
      )
    ) {
      return true;
    }
  }

  // Marcas de remito conocidas + campos de formulario
  const marca =
    /\b(mye\s*s\.?\s*a|m\s*&\s*e|beraldi|tsb|cervecer[ií]a|eco\s*de\s*los\s*andes)\b/.test(t);
  const campos =
    /\b(cliente|chofer|producto|bultos|destinatario|nro\.?\s*(guia|guía|remito)|n[°º]\s*\d{5,}|administraci[oó]n|tractor|semi)\b/.test(
      t,
    );
  if (marca && campos) return true;

  // Foto de costado: a veces no lee "remito" ni la marca, pero sí el formulario
  if (tieneCamposRemitoLogistico(t) && !pareceDocumentoGasto(t)) return true;

  // "Original" / "Duplicado" + nro tipico de remito argentino
  if (/\b(original|duplicado)\b/.test(t) && /\bn[°º]\s*\d{5,}/.test(t) && !pareceDocumentoGasto(t)) {
    return true;
  }

  return false;
}

/**
 * @returns {'hoja'|'gasto'|'remito'|null}
 */
export function clasificarDocumentoAndreu(ocrTexto) {
  const t = String(ocrTexto ?? "");
  if (!t.trim()) return null;

  // Hoja Andreu primero: el formulario tiene chofer/km y no debe ir a remitos
  if (pareceDocumentoHojaRuta(t)) return "hoja";
  // Remito de cliente (Beraldi/YPF, etc.)
  if (pareceDocumentoRemito(t)) return "remito";
  if (pareceDocumentoGasto(t)) return "gasto";
  return null;
}

/** Caption vago: no alcanza para forzar rendición. */
export function captionVagoDocumento(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return true;
  return /^(comprobante|foto|imagen|documento|doc|ticket|factura)\b/.test(t);
}

export function mensajePreguntarTipoDocumento() {
  return (
    `No me queda claro si es un *remito*, una *hoja de ruta* o un *ticket* (peaje / nafta).\n\n` +
    `Respondé *remito*, *hoja* o *ticket* y volvé a mandar la foto.`
  );
}

export function interpretarRespuestaTipoDocumento(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (/^(remito|es\s+un\s+remito|foto\s+del?\s*remito)\b/.test(t)) return "remito";
  if (/^(hoja|hoja\s+de\s+ruta|hdr)\b/.test(t)) return "hoja";
  if (
    /^(ticket|peaje|nafta|gasto|combustible|es\s+un\s+ticket|boleta)\b/.test(t)
  ) {
    return "gasto";
  }
  return null;
}
