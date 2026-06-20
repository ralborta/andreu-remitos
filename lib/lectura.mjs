import { ocrDocumento, procesarBeraldiFoundation, procesarTSBFoundation } from "./document-ai.mjs";
import { extraerFrio, detectarTenant } from "./extract-cold.mjs";
import { entidadesAMapa, extraerBeraldiFoundation, extraerTSBFoundation } from "./extract-foundation.mjs";

export function calcularEstado(lectura) {
  const v = lectura.horarios?.validacion;
  if (!v) return "error_lectura";
  if (v.valido) return "pendiente_revision";
  if (v.errores?.length) return "bloqueado";
  if (v.faltantes?.length) return "incompleto";
  return "pendiente_revision";
}

/**
 * Pipeline: imagen → Document AI → extracción → validación
 * @param {Buffer} buffer
 * @param {{ filename?: string, telefono?: string, tenantForzado?: string }} opts
 */
export async function leerRemito(buffer, opts = {}) {
  let ocr;
  let lectura;

  if (opts.tenantForzado === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
    ocr = await procesarTSBFoundation(buffer, opts.filename);
    lectura = extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
  } else if (process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID) {
    ocr = await procesarBeraldiFoundation(buffer, opts.filename);
    lectura = extraerBeraldiFoundation(entidadesAMapa(ocr.entidades), ocr.texto);

    if (!opts.tenantForzado && detectarTenant(ocr.texto) === "tsb" && process.env.DOCUMENT_AI_CUSTOM_TSB_ID) {
      ocr = await procesarTSBFoundation(buffer, opts.filename);
      lectura = extraerTSBFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
    }
  } else {
    ocr = await ocrDocumento(buffer, opts.filename);
    lectura = extraerFrio(ocr.texto);
  }

  if (opts.tenantForzado && lectura.tenant !== opts.tenantForzado) {
    lectura.resumen = lectura.resumen ?? {};
    lectura.resumen.advertencia_tenant = {
      esperado: opts.tenantForzado,
      detectado: lectura.tenant,
      mensaje: "Teléfono chofer y lectura no coinciden — revisar (caso Castro)",
    };
  }

  const estado = calcularEstado(lectura);

  return {
    estado,
    telefono_chofer: opts.telefono ?? null,
    tenant: lectura.tenant,
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

export { extraerFrio, ocrDocumento, procesarBeraldiFoundation, procesarTSBFoundation };
