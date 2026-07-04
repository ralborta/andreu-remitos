import speech from "@google-cloud/speech";
import { GoogleAuth } from "google-auth-library";
import { gcpClientOptions } from "./gcp-credentials.mjs";

let speechClient;
let authClient;

function getSpeechClient() {
  if (speechClient) return speechClient;
  speechClient = new speech.SpeechClient(gcpClientOptions());
  return speechClient;
}

function getAuth() {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      ...gcpClientOptions(),
    });
  }
  return authClient;
}

function encodingFor(mimeType = "", filename = "") {
  const m = (mimeType + filename).toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "OGG_OPUS";
  if (m.includes("webm")) return "WEBM_OPUS";
  if (m.includes("mp3") || m.includes("mpeg")) return "MP3";
  if (m.includes("wav")) return "LINEAR16";
  if (m.includes("flac")) return "FLAC";
  return "OGG_OPUS";
}

function mimeParaGemini(mimeType = "", filename = "") {
  const m = (mimeType + filename).toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "audio/mpeg";
  if (m.includes("webm")) return "audio/webm";
  return "audio/ogg";
}

function extraerTexto(response) {
  return (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(" ")
    .trim();
}

const FRASES_LOGISTICA = [
  "peso", "kilos", "kg", "km", "semi", "acoplado", "chasis", "tractor", "patente",
  "destino", "origen", "procedencia", "salida", "carga", "descarga", "guía", "remito",
  "horario", "entrada", "correcto", "OK",
];

/** Estrategias Speech — notas de voz WA son cortas (1–15 s), OGG Opus ~48 kHz. */
function estrategiasSpeech(encoding) {
  const primary = process.env.SPEECH_LANGUAGE_CODE?.trim() || "es-419";
  const langs = [...new Set([primary, "es-AR", "es-ES", "es-419"])];

  /** @type {Array<{ languageCode: string, model?: string, sampleRateHertz?: number }>} */
  const out = [];
  for (const languageCode of langs) {
    out.push({ languageCode });
    out.push({ languageCode, model: "latest_short" });
    out.push({ languageCode, model: "command_and_search" });
    if (encoding === "OGG_OPUS") {
      out.push({ languageCode, model: "latest_short", sampleRateHertz: 48000 });
      out.push({ languageCode, model: "latest_short", sampleRateHertz: 16000 });
    }
  }
  if (process.env.SPEECH_MODEL?.trim()) {
    out.unshift({ languageCode: primary, model: process.env.SPEECH_MODEL.trim() });
  }
  return out;
}

async function transcribirConSpeech(buffer, opts) {
  const encoding = encodingFor(opts.mimeType, opts.filename);
  const client = getSpeechClient();
  /** @type {Error|null} */
  let lastError = null;

  for (const strategy of estrategiasSpeech(encoding)) {
    try {
      /** @type {import("@google-cloud/speech").protos.google.cloud.speech.v1.IRecognitionConfig} */
      const config = {
        encoding,
        languageCode: strategy.languageCode,
        enableAutomaticPunctuation: true,
        speechContexts: [{ phrases: FRASES_LOGISTICA, boost: 15 }],
      };
      if (strategy.model) config.model = strategy.model;
      if (strategy.sampleRateHertz) config.sampleRateHertz = strategy.sampleRateHertz;

      const [response] = await client.recognize({
        config,
        audio: { content: buffer.toString("base64") },
      });

      const text = extraerTexto(response);
      if (text) {
        opts.log?.info?.(
          { engine: "speech", languageCode: strategy.languageCode, model: strategy.model ?? "default" },
          "Audio transcrito",
        );
        return text;
      }
      lastError = new Error("Speech sin transcripción (audio muy corto o silencio)");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      opts.log?.warn?.(
        { engine: "speech", languageCode: strategy.languageCode, err: lastError.message },
        "Intento Speech falló",
      );
    }
  }

  throw lastError ?? new Error("Speech no devolvió texto");
}

async function transcribirConGemini(buffer, opts) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT no configurado");

  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model =
    process.env.GEMINI_AUDIO_MODEL?.trim() ||
    process.env.GEMINI_CORRECCION_MODEL?.trim() ||
    "gemini-2.5-flash";

  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Sin token GCP para Gemini");

  const mimeType = mimeParaGemini(opts.mimeType, opts.filename);
  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: buffer.toString("base64"),
              },
            },
            {
              text:
                "Transcribí literalmente lo que dice esta nota de voz en español rioplatense (Argentina). " +
                "Solo el texto hablado, sin comillas ni explicaciones. Si no hay voz audible, respondé vacío.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 512,
      },
    }),
    signal: AbortSignal.timeout(Number(process.env.GEMINI_AUDIO_TIMEOUT_MS) || 20000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini audio HTTP ${res.status}: ${errBody.slice(0, 250)}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text || /^(\[\s*\]|vac[ií]o|sin voz)/i.test(text)) {
    throw new Error("Gemini no detectó voz en el audio");
  }

  opts.log?.info?.({ engine: "gemini", model, len: text.length }, "Audio transcrito");
  return text;
}

function geminiHabilitado() {
  if (process.env.GEMINI_AUDIO_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

/**
 * Transcribe nota de voz WhatsApp (ogg/opus) a texto.
 * @param {Buffer} buffer
 * @param {{ mimeType?: string, filename?: string, log?: { info?: Function, warn?: Function } }} [opts]
 */
export async function transcribirAudio(buffer, opts = {}) {
  if (!buffer?.length) {
    throw new Error("Audio vacío");
  }

  opts.log?.info?.({ bytes: buffer.length, mime: opts.mimeType }, "Transcribiendo audio");

  /** @type {Error|null} */
  let speechError = null;
  try {
    return await transcribirConSpeech(buffer, opts);
  } catch (err) {
    speechError = err instanceof Error ? err : new Error(String(err));
    opts.log?.warn?.({ err: speechError.message }, "Speech agotado, probando Gemini");
  }

  if (geminiHabilitado()) {
    try {
      return await transcribirConGemini(buffer, opts);
    } catch (err) {
      const geminiErr = err instanceof Error ? err : new Error(String(err));
      opts.log?.warn?.({ err: geminiErr.message }, "Gemini audio falló");
      throw speechError ?? geminiErr;
    }
  }

  throw speechError ?? new Error("No se pudo transcribir el audio");
}

export function esAudioMime(mime = "") {
  return /^audio\//i.test(mime) || /ogg|opus|webm|mpeg|mp3|wav|flac/i.test(mime);
}
