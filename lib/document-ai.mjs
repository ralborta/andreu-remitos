import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { BERALDI_DOCUMENT_SCHEMA } from "./schema-beraldi.mjs";
import { CORINA_DOCUMENT_SCHEMA } from "./schema-corina.mjs";
import { MYE_DOCUMENT_SCHEMA } from "./schema-mye.mjs";
import { TSB_DOCUMENT_SCHEMA } from "./schema-tsb.mjs";
import { gcpClientOptions } from "./gcp-credentials.mjs";
import {
  openaiOcrFallbackHabilitado,
  ocrDocumentoOpenAi,
  procesarBeraldiOpenAi,
  procesarTenantOpenAiComoOcr,
} from "./ocr-openai-fallback.mjs";

function esFalloDocAiRecuperable(err) {
  const msg = String(err?.message ?? err ?? "");
  return /PERMISSION_DENIED|billing|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE|quota|403|429|5\d\d|Faltan GOOGLE_CLOUD/i.test(
    msg,
  );
}

async function conFallbackOpenAi(fnDocAi, fnOpenAi, label) {
  try {
    return await fnDocAi();
  } catch (err) {
    if (!openaiOcrFallbackHabilitado() || !esFalloDocAiRecuperable(err)) throw err;
    console.warn(`[document-ai] ${label} falló (${err.message?.slice?.(0, 120)}); usando OpenAI`);
    return fnOpenAi();
  }
}

let client;

function getClient() {
  if (client) return client;
  const location = process.env.DOCUMENT_AI_LOCATION || "us";
  client = new DocumentProcessorServiceClient(
    gcpClientOptions(`${location}-documentai.googleapis.com`),
  );
  return client;
}

function mimeFor(buffer, filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

function mapDocResult(doc, processorId, processorVersion) {
  return {
    texto: (doc.text || "").trim(),
    paginas: doc.pages?.length ?? 0,
    entidades: (doc.entities || []).map((e) => ({
      tipo: e.type,
      valor: e.mentionText ?? e.normalizedValue?.text ?? "",
      confianza: e.confidence ?? null,
    })),
    processor_id: processorId,
    processor_version: processorVersion ?? null,
  };
}

/**
 * OCR genérico (baseline / TSB en frío).
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @param {string} [processorId]
 */
export async function ocrDocumento(buffer, filename = "", processorId) {
  return conFallbackOpenAi(
    async () => {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.DOCUMENT_AI_LOCATION || "us";
      const pid = processorId || process.env.DOCUMENT_AI_PROCESSOR_ID;

      if (!project || !pid) {
        throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_PROCESSOR_ID");
      }

      const name = `projects/${project}/locations/${location}/processors/${pid}`;
      const [result] = await getClient().processDocument({
        name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: mimeFor(buffer, filename),
        },
      });

      return mapDocResult(result.document, pid);
    },
    () => ocrDocumentoOpenAi(buffer, filename),
    "ocrDocumento",
  );
}

/**
 * Custom Extractor Beraldi — foundation model con schema propio.
 * Usa versión desplegada (beraldi-foundation-v1) si DOCUMENT_AI_BERALDI_VERSION está seteado.
 */
export async function procesarBeraldiFoundation(buffer, filename = "") {
  return conFallbackOpenAi(
    async () => {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.DOCUMENT_AI_LOCATION || "us";
      const pid = process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID;
      const version = process.env.DOCUMENT_AI_BERALDI_VERSION;

      if (!project || !pid) {
        throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_CUSTOM_BERALDI_ID");
      }

      const name = version
        ? `projects/${project}/locations/${location}/processors/${pid}/processorVersions/${version}`
        : `projects/${project}/locations/${location}/processors/${pid}`;

      const [result] = await getClient().processDocument({
        name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: mimeFor(buffer, filename),
        },
        processOptions: {
          schemaOverride: BERALDI_DOCUMENT_SCHEMA,
        },
      });

      return {
        ...mapDocResult(result.document, pid, version ?? "default"),
        motor: "beraldi-foundation-v1",
      };
    },
    () => procesarBeraldiOpenAi(buffer, filename),
    "procesarBeraldiFoundation",
  );
}

/**
 * Custom Extractor TSB — foundation model con schema propio.
 */
export async function procesarTSBFoundation(buffer, filename = "") {
  return conFallbackOpenAi(
    async () => {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.DOCUMENT_AI_LOCATION || "us";
      const pid = process.env.DOCUMENT_AI_CUSTOM_TSB_ID;
      const version = process.env.DOCUMENT_AI_TSB_VERSION;

      if (!project || !pid) {
        throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_CUSTOM_TSB_ID");
      }

      const name = version
        ? `projects/${project}/locations/${location}/processors/${pid}/processorVersions/${version}`
        : `projects/${project}/locations/${location}/processors/${pid}`;

      const [result] = await getClient().processDocument({
        name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: mimeFor(buffer, filename),
        },
        processOptions: {
          schemaOverride: TSB_DOCUMENT_SCHEMA,
        },
      });

      const motorNames = {
        "4f86defcad447cf8": "tsb-foundation-v1",
        "80ad0851388be9d1": "tsb-finetuned-v1",
      };

      return {
        ...mapDocResult(result.document, pid, version ?? "default"),
        motor: motorNames[version] ?? "tsb-custom",
      };
    },
    () => procesarTenantOpenAiComoOcr(buffer, filename, "openai-vision-tsb"),
    "procesarTSBFoundation",
  );
}

/**
 * Custom Extractor MyESA / M&E — mismos campos que TSB.
 */
export async function procesarMyeFoundation(buffer, filename = "") {
  return conFallbackOpenAi(
    async () => {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.DOCUMENT_AI_LOCATION || "us";
      const pid = process.env.DOCUMENT_AI_CUSTOM_MYE_ID;
      const version = process.env.DOCUMENT_AI_MYE_VERSION;

      if (!project || !pid) {
        throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_CUSTOM_MYE_ID");
      }

      const name = version
        ? `projects/${project}/locations/${location}/processors/${pid}/processorVersions/${version}`
        : `projects/${project}/locations/${location}/processors/${pid}`;

      const [result] = await getClient().processDocument({
        name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: mimeFor(buffer, filename),
        },
        processOptions: {
          schemaOverride: MYE_DOCUMENT_SCHEMA,
        },
      });

      return {
        ...mapDocResult(result.document, pid, version ?? "default"),
        motor: "mye-foundation-v1",
      };
    },
    () => procesarTenantOpenAiComoOcr(buffer, filename, "openai-vision-mye"),
    "procesarMyeFoundation",
  );
}

/**
 * Custom Extractor Corina — remitos Quilmes (viajes cortos).
 */
export async function procesarCorinaFoundation(buffer, filename = "") {
  return conFallbackOpenAi(
    async () => {
      const project = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.DOCUMENT_AI_LOCATION || "us";
      const pid = process.env.DOCUMENT_AI_CUSTOM_CORINA_ID;
      const version = process.env.DOCUMENT_AI_CORINA_VERSION;

      if (!project || !pid) {
        throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_CUSTOM_CORINA_ID");
      }

      const name = version
        ? `projects/${project}/locations/${location}/processors/${pid}/processorVersions/${version}`
        : `projects/${project}/locations/${location}/processors/${pid}`;

      const [result] = await getClient().processDocument({
        name,
        rawDocument: {
          content: buffer.toString("base64"),
          mimeType: mimeFor(buffer, filename),
        },
        processOptions: {
          schemaOverride: CORINA_DOCUMENT_SCHEMA,
        },
      });

      return {
        ...mapDocResult(result.document, pid, version ?? "default"),
        motor: "corina-foundation-v1",
      };
    },
    () => procesarTenantOpenAiComoOcr(buffer, filename, "openai-vision-corina"),
    "procesarCorinaFoundation",
  );
}
