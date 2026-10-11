/**
 * Fallback OCR / extracción cuando Document AI falla (billing, cuota, etc.).
 * Usa OpenAI vision; mismo shape que document-ai.mjs para el pipeline de remitos.
 */

function mimeFor(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function parseJson(text) {
  const t = String(text ?? "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

async function callOpenAiVision({ system, userText, buffer, filename, maxTokens = 1200 }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !buffer?.length) return null;

  const model =
    process.env.OPENAI_REMITO_OCR_MODEL?.trim() ||
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const mime = mimeFor(filename);
  const imageBase64 = Buffer.from(buffer).toString("base64");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${imageBase64}` },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.REMITO_OCR_IA_TIMEOUT_MS) || 45000),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenAI OCR ${res.status}: ${errTxt.slice(0, 200)}`);
  }
  const data = await res.json();
  return parseJson(data?.choices?.[0]?.message?.content);
}

/** ¿Usar fallback? Default sí si hay API key. */
export function openaiOcrFallbackHabilitado() {
  if (process.env.DOCUMENT_AI_OPENAI_FALLBACK === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * OCR de texto plano (reemplazo de ocrDocumento).
 * @returns {Promise<{ texto: string, paginas: number, entidades: any[], processor_id: string, motor: string }>}
 */
export async function ocrDocumentoOpenAi(buffer, filename = "") {
  const json = await callOpenAiVision({
    system:
      "Sos un OCR de documentos logísticos argentinos (remitos, hojas de ruta, tickets). " +
      "Respondé SOLO JSON válido.",
    userText: `Leé TODO el texto visible del documento (impreso y manuscrito).
Conservá saltos de línea aproximados. No inventes campos.

JSON:
{ "texto": string }`,
    buffer,
    filename,
    maxTokens: 2500,
  });

  const texto = String(json?.texto ?? "").trim();
  if (!texto) throw new Error("OpenAI OCR sin texto");

  return {
    texto,
    paginas: 1,
    entidades: [],
    processor_id: "openai-vision",
    processor_version: null,
    motor: "openai-vision-ocr",
  };
}

const BERALDI_KEYS = [
  "nro_remito",
  "fecha",
  "ot",
  "chofer",
  "tractor",
  "semi",
  "peso",
  "destino",
  "origen",
  "unidad",
  "hora_carga_entrada",
  "hora_carga_salida",
  "hora_descarga_llegada",
  "hora_descarga_inicio",
  "hora_descarga_fin",
  "km_inicial",
  "km_final",
  "cliente",
  "producto",
];

/**
 * Extracción estructurada Beraldi (reemplazo de procesarBeraldiFoundation).
 */
export async function procesarBeraldiOpenAi(buffer, filename = "") {
  const json = await callOpenAiVision({
    system:
      "Sos un extractor de remitos Transportes Beraldi / YPF (logística Argentina). " +
      "Respondé SOLO JSON válido. Si un campo no se lee, null.",
    userText: `Extraé campos del remito Beraldi (aunque el cliente sea YPF S.A. — eso NO es ticket de nafta).

Campos:
- nro_remito (ej 00009-00176982-1)
- fecha (dd/mm/aa o similar)
- ot, chofer, tractor, semi, peso (kg), destino, origen (planta/yacimiento), unidad
- hora_carga_entrada, hora_carga_salida, hora_descarga_llegada, hora_descarga_inicio, hora_descarga_fin
- km_inicial, km_final, cliente, producto
- texto: transcripción completa del papel

JSON:
{
  "texto": string,
  "nro_remito": string|null,
  "fecha": string|null,
  "ot": string|null,
  "chofer": string|null,
  "tractor": string|null,
  "semi": string|null,
  "peso": string|null,
  "destino": string|null,
  "origen": string|null,
  "unidad": string|null,
  "hora_carga_entrada": string|null,
  "hora_carga_salida": string|null,
  "hora_descarga_llegada": string|null,
  "hora_descarga_inicio": string|null,
  "hora_descarga_fin": string|null,
  "km_inicial": string|null,
  "km_final": string|null,
  "cliente": string|null,
  "producto": string|null
}`,
    buffer,
    filename,
    maxTokens: 2200,
  });

  if (!json) throw new Error("OpenAI Beraldi sin JSON");

  const texto = String(json.texto ?? "").trim();
  const entidades = BERALDI_KEYS.filter((k) => json[k] != null && String(json[k]).trim())
    .map((k) => ({
      tipo: k,
      valor: String(json[k]).trim(),
      confianza: 0.7,
    }));

  if (!texto && !entidades.length) throw new Error("OpenAI Beraldi vacío");

  return {
    texto: texto || entidades.map((e) => `${e.tipo}: ${e.valor}`).join("\n"),
    paginas: 1,
    entidades,
    processor_id: "openai-vision-beraldi",
    processor_version: null,
    motor: "openai-vision-beraldi",
  };
}

/** Extracción genérica TSB/MYE/Corina vía texto OCR OpenAI (entidades vacías; frío/enriquecedores completan). */
export async function procesarTenantOpenAiComoOcr(buffer, filename = "", motorLabel = "openai-vision") {
  const ocr = await ocrDocumentoOpenAi(buffer, filename);
  return { ...ocr, motor: motorLabel, processor_id: motorLabel };
}
