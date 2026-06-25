import speech from "@google-cloud/speech";
import { gcpClientOptions } from "./gcp-credentials.mjs";

let client;

function getClient() {
  if (client) return client;
  client = new speech.SpeechClient(gcpClientOptions());
  return client;
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

/**
 * Transcribe nota de voz WhatsApp (ogg/opus) a texto.
 * @param {Buffer} buffer
 * @param {{ mimeType?: string, filename?: string }} [opts]
 */
export async function transcribirAudio(buffer, opts = {}) {
  const encoding = encodingFor(opts.mimeType, opts.filename);
  const [response] = await getClient().recognize({
    config: {
      encoding,
      languageCode: process.env.SPEECH_LANGUAGE_CODE || "es-AR",
      alternativeLanguageCodes: ["es-419", "es-ES"],
      enableAutomaticPunctuation: true,
      model: "latest_long",
    },
    audio: { content: buffer.toString("base64") },
  });

  const text = (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) {
    throw new Error("No se pudo transcribir el audio (sin voz detectada)");
  }
  return text;
}

export function esAudioMime(mime = "") {
  return /^audio\//i.test(mime) || /ogg|opus|webm|mpeg|mp3|wav|flac/i.test(mime);
}
