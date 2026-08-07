import {
  ocrDocumento,
  procesarBeraldiFoundation,
  procesarCorinaFoundation,
  procesarMyeFoundation,
  procesarTSBFoundation,
} from "./document-ai.mjs";
import { extraerFrio } from "./extract-cold.mjs";
import {
  entidadesAMapa,
  extraerBeraldiFoundation,
  extraerMyeFoundation,
  extraerTSBFoundation,
} from "./extract-foundation.mjs";
import { extraerCorina, extraerCorinaFoundation, calcularEstadoCorina } from "./extract-corina.mjs";
import { motivosBloqueoProcesoTsb } from "./remito-procesable.mjs";

export function calcularEstado(lectura, validacionExterna, tenant) {
  const t = tenant ?? lectura.tenant;
  if (t === "corina") return calcularEstadoCorina(lectura);
  const v = validacionExterna ?? lectura.horarios?.validacion;
  if (!v) return "error_lectura";
  if (v.valido) return "pendiente_revision";
  if ((t === "tsb" || t === "mye") && motivosBloqueoProcesoTsb(v).length === 0) {
    return "pendiente_revision";
  }
  if (v.errores?.length) return "bloqueado";
  if (v.faltantes?.length) return "incompleto";
  return "pendiente_revision";
}

async function lecturaDesdeCorina(buffer, filename) {
  if (process.env.DOCUMENT_AI_CUSTOM_CORINA_ID) {
    const ocr = await procesarCorinaFoundation(buffer, filename);
    return {
      ocr,
      lectura: extraerCorinaFoundation(entidadesAMapa(ocr.entidades), ocr.texto),
    };
  }
  const ocr = await ocrDocumento(buffer, filename);
  return { ocr, lectura: extraerCorina(ocr.texto) };
}

async function lecturaDesdeTenant(buffer, filename, tenant) {
  if (tenant === "corina") return lecturaDesdeCorina(buffer, filename);
  if (tenant === "mye" && process.env.DOCUMENT_AI_CUSTOM_MYE_ID) {
    const ocr = await procesarMyeFoundation(buffer, filename);
    return { ocr, lectura: extraerMyeFoundation(entidadesAMapa(ocr.entidades), ocr.texto) };
  }
  if (tenant === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
    const ocr = await procesarTSBFoundation(buffer, filename);
    return { ocr, lectura: extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto) };
  }
  if (tenant === "beraldi" && process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID) {
    const ocr = await procesarBeraldiFoundation(buffer, filename);
    return { ocr, lectura: extraerBeraldiFoundation(entidadesAMapa(ocr.entidades), ocr.texto) };
  }
  const ocr = await ocrDocumento(buffer, filename);
  return { ocr, lectura: extraerFrio(ocr.texto) };
}

/**
 * Pipeline demo TransitOne: siempre perfil guía TSB (una sola empresa).
 * @param {Buffer} buffer
 * @param {{ filename?: string, telefono?: string, tenantForzado?: string, tenantSugerido?: string, log?: object }} opts
 */
export async function leerRemito(buffer, opts = {}) {
  const { ocr, lectura } = await lecturaDesdeTenant(buffer, opts.filename, "tsb");
  lectura.tenant = "tsb";
  lectura.resumen = lectura.resumen ?? {};
  lectura.resumen.tenant_detectado = "tsb";
  lectura.resumen.tenant_razon = "demo_transitone";
  lectura.resumen.tenant_confianza = 1;

  const tenantFinal = "tsb";
  const estado = calcularEstado(lectura, undefined, tenantFinal);

  return {
    estado,
    telefono_chofer: opts.telefono ?? null,
    tenant: tenantFinal,
    ocr: {
      texto: ocr.texto,
      paginas: ocr.paginas,
      entidades: ocr.entidades,
      processor_id: ocr.processor_id,
      processor_version: ocr.processor_version ?? null,
      motor: ocr.motor ?? lectura._fuente ?? "ocr-frio",
    },
    lectura,
    validacion: lectura.horarios?.validacion ?? null,
  };
}

export {
  extraerFrio,
  ocrDocumento,
  procesarBeraldiFoundation,
  procesarCorinaFoundation,
  procesarMyeFoundation,
  procesarTSBFoundation,
};
