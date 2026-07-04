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

function extraerTexto(response) {
  return (response.results ?? [])
    .map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Estrategias de reconocimiento — es-AR no soporta `latest_long` en Speech v1. */
function estrategiasReconocimiento() {
  const primary = process.env.SPEECH_LANGUAGE_CODE?.trim() || "es-419";
  const model = process.env.SPEECH_MODEL?.trim() || null;

  const base = model ? [{ languageCode: primary, model }] : [{ languageCode: primary }];

  const fallbacks = [
    { languageCode: "es-419" },
    { languageCode: "es-AR" },
    { languageCode: "es-ES" },
  ];

  const seen = new Set();
  const out = [];
  for (const s of [...base, ...fallbacks]) {
    const key = `${s.languageCode}|${s.model ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
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

  const encoding = encodingFor(opts.mimeType, opts.filename);
  const speechClient = getClient();
  /** @type {Error|null} */
  let lastError = null;

  for (const strategy of estrategiasReconocimiento()) {
    try {
      const config = {
        encoding,
        languageCode: strategy.languageCode,
        alternativeLanguageCodes: ["es-419", "es-ES"].filter((l) => l !== strategy.languageCode),
        enableAutomaticPunctuation: true,
      };
      if (strategy.model) config.model = strategy.model;

      const [response] = await speechClient.recognize({
        config,
        audio: { content: buffer.toString("base64") },
      });

      const text = extraerTexto(response);
      if (text) {
        opts.log?.info?.(
          { languageCode: strategy.languageCode, model: strategy.model ?? "default", len: text.length },
          "Audio transcrito",
        );
        return text;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      opts.log?.warn?.(
        { languageCode: strategy.languageCode, err: lastError.message },
        "Intento Speech falló",
      );
    }
  }

  throw lastError ?? new Error("No se pudo transcribir el audio (sin voz detectada)");
}

export function esAudioMime(mime = "") {
  return /^audio\//i.test(mime) || /ogg|opus|webm|mpeg|mp3|wav|flac/i.test(mime);
}
