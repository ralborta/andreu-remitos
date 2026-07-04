import speech from "@google-cloud/speech";
import { gcpClientOptions } from "./gcp-credentials.mjs";

let speechClient;

function getSpeechClient() {
  if (speechClient) return speechClient;
  speechClient = new speech.SpeechClient(gcpClientOptions());
  return speechClient;
}

function filenameFor(mimeType = "", filename = "") {
  if (filename) return filename;
  const m = (mimeType + filename).toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "audio.mp3";
  if (m.includes("webm")) return "audio.webm";
  return "audio.ogg";
}

function mimeForBlob(mimeType = "", filename = "") {
  const m = (mimeType + filename).toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "audio/mpeg";
  if (m.includes("webm")) return "audio/webm";
  return "audio/ogg";
}

function encodingFor(mimeType = "", filename = "") {
  const m = (mimeType + filename).toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "OGG_OPUS";
  if (m.includes("webm")) return "WEBM_OPUS";
  if (m.includes("mp3") || m.includes("mpeg")) return "MP3";
  return "OGG_OPUS";
}

function openAiHabilitado() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function speechHabilitado() {
  if (process.env.SPEECH_ENABLED === "false") return false;
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

function promptOpenAI(contexto = "correccion") {
  if (contexto === "horarios") {
    return (
      "Nota de voz de chofer corrigiendo HORARIOS de remito. " +
      "Ejemplos: salida carga 19:44, entrada carga 08:30, llegada descarga 21:10, fin descarga 00:15. " +
      "Solo la corrección, sin saludos."
    );
  }
  return (
    "Nota de voz de chofer corrigiendo remito de transporte. " +
    "Ejemplos: peso 29460, semi ABC123, km final 71221, destino Pacheco. " +
    "Solo la corrección, sin saludos."
  );
}

/** Descarta saludos, alucinaciones y frases sin datos útiles. */
function normalizarTranscripcion(text) {
  let t = String(text ?? "").trim();
  if (!t) return null;

  if (/^(subtitles?|thanks for watching|gracias por ver|\.{2,}|…+)$/i.test(t) || /amara\.org/i.test(t)) {
    return null;
  }

  if (/^(hola|buen[oa]s(?:\s+(?:d[ií]a|d[ií]as|tarde|tardes))?|hey|eh|che|mm+|ah+|eh+|ok|si|s[ií]|dale|listo)[.!?,?\s]*$/i.test(t)) {
    return null;
  }

  const tieneDato = /\d/.test(t) ||
    /peso|km|semi|patente|destino|origen|salida|entrada|descarga|carga|horario|gu[ií]a|remito|chasis|tractor|acoplado/i.test(t);

  if (!tieneDato && t.split(/\s+/).filter(Boolean).length <= 2) {
    return null;
  }

  return t;
}

/** OpenAI gpt-4o-mini-transcribe: ~USD 0.003/min — mejor relación costo/precisión para notas WA cortas. */
async function transcribirConOpenAI(buffer, opts) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurado");

  const model = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeForBlob(opts.mimeType, opts.filename) }), filenameFor(opts.mimeType, opts.filename));
  form.append("model", model);
  form.append("language", "es");
  form.append("prompt", promptOpenAI(opts.contexto));

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS) || 25000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI transcribe HTTP ${res.status}: ${errBody.slice(0, 250)}`);
  }

  const data = await res.json();
  const text = normalizarTranscripcion(data.text);
  if (!text) throw new Error("OpenAI no devolvió corrección útil (audio muy corto o solo saludo)");

  opts.log?.info?.({ engine: "openai", model, len: text.length, contexto: opts.contexto }, "Audio transcrito");
  return text;
}

/** Fallback GCP — 60 min/mes gratis; una sola pasada (sin reintentos costosos). */
async function transcribirConSpeech(buffer, opts) {
  const encoding = encodingFor(opts.mimeType, opts.filename);
  const languageCode = process.env.SPEECH_LANGUAGE_CODE?.trim() || "es-419";

  const [response] = await getSpeechClient().recognize({
    config: {
      encoding,
      languageCode,
      model: "latest_short",
      enableAutomaticPunctuation: true,
    },
    audio: { content: buffer.toString("base64") },
  });

  const text = (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) throw new Error("Speech sin transcripción");
  const util = normalizarTranscripcion(text);
  if (!util) throw new Error("Speech sin corrección útil");
  opts.log?.info?.({ engine: "speech", languageCode }, "Audio transcrito");
  return util;
}

/**
 * Transcribe nota de voz WhatsApp (ogg/opus) a texto.
 * Orden: OpenAI mini (barato + fiable) → Google Speech (free tier) si falla.
 * @param {Buffer} buffer
 * @param {{ mimeType?: string, filename?: string, log?: { info?: Function, warn?: Function } }} [opts]
 */
export async function transcribirAudio(buffer, opts = {}) {
  if (!buffer?.length) throw new Error("Audio vacío");
  if (buffer.length < 2000) {
    throw new Error("Audio demasiado corto — grabá al menos 2-3 segundos");
  }

  opts.log?.info?.({ bytes: buffer.length, mime: opts.mimeType }, "Transcribiendo audio");

  /** @type {Error|null} */
  let primaryError = null;

  if (openAiHabilitado()) {
    try {
      return await transcribirConOpenAI(buffer, opts);
    } catch (err) {
      primaryError = err instanceof Error ? err : new Error(String(err));
      opts.log?.warn?.({ err: primaryError.message }, "OpenAI transcribe falló");
    }
  }

  if (speechHabilitado()) {
    try {
      return await transcribirConSpeech(buffer, opts);
    } catch (err) {
      const speechErr = err instanceof Error ? err : new Error(String(err));
      opts.log?.warn?.({ err: speechErr.message }, "Speech fallback falló");
      throw primaryError ?? speechErr;
    }
  }

  throw primaryError ?? new Error("Sin motor de transcripción (OPENAI_API_KEY o credenciales GCP)");
}

export function esAudioMime(mime = "") {
  return /^audio\//i.test(mime) || /ogg|opus|webm|mpeg|mp3|wav|flac/i.test(mime);
}
