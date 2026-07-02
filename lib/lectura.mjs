import {
  ocrDocumento,
  procesarBeraldiFoundation,
  procesarCorinaFoundation,
  procesarTSBFoundation,
} from "./document-ai.mjs";
import { extraerFrio, detectarTenant, detectarCorina } from "./extract-cold.mjs";
import { entidadesAMapa, extraerBeraldiFoundation, extraerTSBFoundation } from "./extract-foundation.mjs";
import { extraerCorina, extraerCorinaFoundation, calcularEstadoCorina } from "./extract-corina.mjs";

export function calcularEstado(lectura, validacionExterna) {
  if (lectura.tenant === "corina") return calcularEstadoCorina(lectura);
  const v = validacionExterna ?? lectura.horarios?.validacion;
  if (!v) return "error_lectura";
  if (v.valido) return "pendiente_revision";
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

/**
 * Pipeline: imagen → Document AI → extracción → validación
 * @param {Buffer} buffer
 * @param {{ filename?: string, telefono?: string, tenantForzado?: string }} opts
 */
export async function leerRemito(buffer, opts = {}) {
  let ocr;
  let lectura;
  const tf = opts.tenantForzado;

  if (tf === "corina") {
    ({ ocr, lectura } = await lecturaDesdeCorina(buffer, opts.filename));
  } else if (tf === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
    ocr = await procesarTSBFoundation(buffer, opts.filename);
    lectura = extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
  } else if (tf === "beraldi" && process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID) {
    ocr = await procesarBeraldiFoundation(buffer, opts.filename);
    lectura = extraerBeraldiFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
  } else {
    ocr = await ocrDocumento(buffer, opts.filename);
    const detectado = detectarTenant(ocr.texto);

    if (detectado === "corina") {
      if (process.env.DOCUMENT_AI_CUSTOM_CORINA_ID) {
        ({ ocr, lectura } = await lecturaDesdeCorina(buffer, opts.filename));
      } else {
        lectura = extraerCorina(ocr.texto);
      }
    } else if (detectado === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
      ocr = await procesarTSBFoundation(buffer, opts.filename);
      lectura = extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
    } else if (process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID) {
      ocr = await procesarBeraldiFoundation(buffer, opts.filename);
      lectura = extraerBeraldiFoundation(entidadesAMapa(ocr.entidades), ocr.texto);

      if (detectado === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
        ocr = await procesarTSBFoundation(buffer, opts.filename);
        lectura = extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
      }
    } else {
      lectura = extraerFrio(ocr.texto);
    }
  }

  if (opts.tenantForzado && lectura.tenant !== opts.tenantForzado) {
    lectura.resumen = lectura.resumen ?? {};
    lectura.resumen.advertencia_tenant = {
      esperado: opts.tenantForzado,
      detectado: lectura.tenant,
      mensaje: "OCR detectó otro cliente — se usó chofer / asignación manual",
    };
  }

  const tenantFinal = opts.tenantForzado ?? lectura.tenant;
  lectura.tenant = tenantFinal;

  const estado = calcularEstado(lectura);

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
  procesarTSBFoundation,
};
