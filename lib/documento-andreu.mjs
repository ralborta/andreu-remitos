/**
 * Clasificación de documentos Andreu por OCR/texto.
 * Evita mezclar remitos ↔ rendiciones ↔ hoja de ruta.
 */
import { pareceDocumentoHojaRuta } from "./hoja-ruta.mjs";
import { pareceDocumentoGasto } from "./rendicion-wa.mjs";

/**
 * Remito de cliente (TSB / Beraldi / Corina / MYE) — no es ticket de gasto.
 */
export function pareceDocumentoRemito(ocrTexto) {
  const t = String(ocrTexto ?? "").toLowerCase();
  if (!t.trim()) return false;

  // Señal fuerte: dice remito y no es peaje/nafta
  if (/\bremito\b/.test(t) && !pareceDocumentoGasto(t)) return true;

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
  if (/\b(tsb|cervecer[ií]a\s+y\s+malter[ií]a|eco\s*de\s*los\s*andes)\b/.test(t) && !pareceDocumentoGasto(t)) {
    // TSB/Corina: exigir algo de formulario para no confundir chats
    if (/\b(cliente|chofer|producto|bultos|destinatario|gu[ií]a|n[°º]|administraci[oó]n|pinzon)\b/.test(t)) {
      return true;
    }
  }

  // Marcas de remito conocidas + campos de formulario
  const marca =
    /\b(mye\s*s\.?\s*a|m\s*&\s*e|beraldi|tsb|cervecer[ií]a|eco\s*de\s*los\s*andes)\b/.test(t);
  const campos =
    /\b(cliente|chofer|producto|bultos|destinatario|nro\.?\s*(guia|guía|remito)|n[°º]\s*\d{5,}|administraci[oó]n)\b/.test(
      t,
    );
  if (marca && campos) return true;

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

  // Orden: hoja (formulario Andreu) → gasto (peaje/nafta) → remito (papel de cliente)
  if (pareceDocumentoHojaRuta(t) && !pareceDocumentoRemito(t)) return "hoja";
  // Si el OCR dice remito con claridad, gana sobre gasto (evita "comprobante"/sticky)
  if (pareceDocumentoRemito(t)) return "remito";
  if (pareceDocumentoGasto(t)) return "gasto";
  // Hoja sin contradicción remito
  if (pareceDocumentoHojaRuta(t)) return "hoja";
  return null;
}
