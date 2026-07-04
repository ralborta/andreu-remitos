import {
  ocrDocumento,
  procesarBeraldiFoundation,
  procesarCorinaFoundation,
  procesarTSBFoundation,
} from "./document-ai.mjs";
import { extraerFrio, detectarCorina } from "./extract-cold.mjs";
import {
  detectarTenantConConfianza,
  detectarTenantConIA,
  elegirTenantFinal,
} from "./detectar-tenant.mjs";
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

async function lecturaDesdeTenant(buffer, filename, tenant) {
  if (tenant === "corina") return lecturaDesdeCorina(buffer, filename);
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
 * Auto-detecta TSB vs Beraldi: heurística OCR + dual processor + IA si hace falta.
 */
async function autoDetectarTenant(buffer, filename, opts = {}) {
  const ocrBase = await ocrDocumento(buffer, filename);
  const detectado = detectarTenantConConfianza(ocrBase.texto);

  if (detectado.scores.corina >= 10 || detectarCorina(ocrBase.texto)) {
    return lecturaDesdeCorina(buffer, filename);
  }

  const tieneBeraldi = Boolean(process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID);
  const tieneTsb = Boolean(process.env.DOCUMENT_AI_CUSTOM_TSB_ID);

  /** @type {import("./extract-foundation.mjs").extraerBeraldiFoundation extends Function ? ReturnType<typeof extraerBeraldiFoundation> : never} */
  let lecturaBeraldi;
  /** @type {ReturnType<typeof extraerTSBFoundation> | undefined} */
  let lecturaTsb;
  let ocrBeraldi;
  let ocrTsb;

  const duda =
    detectado.margen < 4 ||
    detectado.tenant === "desconocido" ||
    (detectado.tenant === "tsb" && detectado.scores.beraldi >= 3);

  if (tieneBeraldi && tieneTsb && duda) {
    [ocrBeraldi, ocrTsb] = await Promise.all([
      procesarBeraldiFoundation(buffer, filename),
      procesarTSBFoundation(buffer, filename),
    ]);
    lecturaBeraldi = extraerBeraldiFoundation(entidadesAMapa(ocrBeraldi.entidades), ocrBeraldi.texto);
    lecturaTsb = extraerTSBFoundation(entidadesAMapa(ocrTsb.entidades), ocrTsb.texto);
  } else if (detectado.tenant === "tsb" && tieneTsb) {
    ocrTsb = await procesarTSBFoundation(buffer, filename);
    lecturaTsb = extraerTSBFoundation(entidadesAMapa(ocrTsb.entidades), ocrTsb.texto);
  } else if (tieneBeraldi) {
    ocrBeraldi = await procesarBeraldiFoundation(buffer, filename);
    lecturaBeraldi = extraerBeraldiFoundation(entidadesAMapa(ocrBeraldi.entidades), ocrBeraldi.texto);
  } else if (tieneTsb) {
    ocrTsb = await procesarTSBFoundation(buffer, filename);
    lecturaTsb = extraerTSBFoundation(entidadesAMapa(ocrTsb.entidades), ocrTsb.texto);
  }

  let ia = null;
  if (duda) {
    ia = await detectarTenantConIA(ocrBase.texto, { log: opts.log });
  }

  const eleccion = elegirTenantFinal({
    detectado,
    lecturaBeraldi,
    lecturaTsb,
    ia,
    sugerido: opts.tenantSugerido ?? null,
  });

  let ocr;
  let lectura;

  if (eleccion.tenant === "tsb" && lecturaTsb) {
    ocr = ocrTsb;
    lectura = lecturaTsb;
  } else if (eleccion.tenant === "beraldi" && lecturaBeraldi) {
    ocr = ocrBeraldi;
    lectura = lecturaBeraldi;
  } else if (eleccion.tenant === "tsb" && tieneTsb) {
    ({ ocr, lectura } = await lecturaDesdeTenant(buffer, filename, "tsb"));
  } else if (tieneBeraldi) {
    ({ ocr, lectura } = await lecturaDesdeTenant(buffer, filename, "beraldi"));
  } else {
    ocr = ocrBase;
    lectura = extraerFrio(ocrBase.texto);
  }

  lectura.tenant = eleccion.tenant;
  lectura.resumen = lectura.resumen ?? {};
  lectura.resumen.tenant_detectado = eleccion.tenant;
  lectura.resumen.tenant_razon = eleccion.razon;
  lectura.resumen.tenant_confianza = eleccion.confianza;
  if (eleccion.advertencia) {
    lectura.resumen.advertencia_tenant = eleccion.advertencia;
  }

  return { ocr, lectura, eleccion };
}

/**
 * Pipeline: imagen → Document AI → extracción → validación
 * @param {Buffer} buffer
 * @param {{ filename?: string, telefono?: string, tenantForzado?: string, tenantSugerido?: string, log?: object }} opts
 */
export async function leerRemito(buffer, opts = {}) {
  let ocr;
  let lectura;
  const forzado = opts.tenantForzado;

  if (forzado === "corina" || forzado === "tsb" || forzado === "beraldi") {
    ({ ocr, lectura } = await lecturaDesdeTenant(buffer, opts.filename, forzado));
    lectura.tenant = forzado;

    const detectadoDoc = detectarTenantConConfianza(ocr.texto);
    if (detectadoDoc.tenant !== "desconocido" && detectadoDoc.tenant !== forzado && detectadoDoc.margen >= 4) {
      lectura.resumen = lectura.resumen ?? {};
      lectura.resumen.advertencia_tenant = {
        esperado: forzado,
        detectado: detectadoDoc.tenant,
        mensaje: `Subiste como ${forzado.toUpperCase()} pero el papel parece ${detectadoDoc.tenant.toUpperCase()} — revisá en mesa de control`,
      };
    }
  } else {
    ({ ocr, lectura } = await autoDetectarTenant(buffer, opts.filename, opts));
  }

  const tenantFinal = lectura.tenant ?? forzado ?? opts.tenantSugerido ?? "beraldi";
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
