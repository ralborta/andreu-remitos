import { GoogleAuth } from "google-auth-library";
import { gcpClientOptions } from "./gcp-credentials.mjs";

let authClient;

function getAuth() {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      ...gcpClientOptions(),
    });
  }
  return authClient;
}

function iaHabilitada() {
  if (process.env.VIAJES_IA_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

/** Heurística: ¿parece pedido de transporte y no remito/corrección? */
export function pareceSolicitudViaje(texto) {
  const raw = String(texto ?? "").trim();
  if (raw.length < 12) return false;

  const t = raw.toLowerCase();
  if (/remito|gu[ií]a de transporte|km final|km inicial|patente|tractor|semi|foto del/i.test(t)) {
    return false;
  }

  const tieneRuta =
    /\b(desde|de)\s+[\wáéíóúñ\s.-]{2,40}\s+(a|hacia|→|->)\s+[\wáéíóúñ\s.-]{2,40}/i.test(raw) ||
    /\b[\wáéíóúñ\s.-]{2,40}\s*(→|->)\s*[\wáéíóúñ\s.-]{2,40}/i.test(raw);

  const tieneCarga = /\b\d{1,3}\s*(t|tn|ton|toneladas?)\b/i.test(raw);
  const keywords =
    /\b(necesitamos|solicitamos|pedimos|transporte|viaje|retiro|entrega|carga|movimiento|flete)\b/i.test(t);

  return (tieneRuta && (tieneCarga || keywords)) || (keywords && /\b(origen|destino|retiro)\b/i.test(t));
}

function parseRegex(texto) {
  const raw = String(texto ?? "").trim();
  const tonMatch = raw.match(/\b(\d{1,3})\s*(?:t|tn|ton|toneladas?)\b/i);
  const toneladas = tonMatch ? Number(tonMatch[1]) : null;

  let origen = null;
  let destino = null;
  const rutaDesde = raw.match(/\bdesde\s+([^,.\n]+?)\s+(?:a|hacia|→|->)\s+([^,.\n]+)/i);
  const rutaDe = raw.match(/\bde\s+([^,.\n]{2,40}?)\s+(?:a|hacia|→|->)\s+([^,.\n]+)/i);
  const ruta2 = raw.match(/\b([^,.\n]{3,40})\s*(?:→|->)\s*([^,.\n]{3,40})/);
  if (rutaDesde) {
    origen = rutaDesde[1].trim();
    destino = rutaDesde[2].trim();
  } else if (rutaDe) {
    origen = rutaDe[1].trim();
    destino = rutaDe[2].trim();
  } else if (ruta2) {
    origen = ruta2[1].trim();
    destino = ruta2[2].trim();
  }

  const retiro = raw.match(/\bretiro[^,.\n]*?(?:mañana|hoy|\d{1,2}[:\/]\d{2}|\d{1,2}\s*h(?:s|rs)?)/i)?.[0] ?? null;
  const clienteMatch = raw.match(/(?:cliente|empresa|para)\s*[:—-]?\s*([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s.&-]{2,40})/i);

  return {
    cliente: clienteMatch?.[1]?.trim() || null,
    origen,
    destino,
    toneladas,
    carga: toneladas ? `${toneladas} t` : null,
    fecha_retiro: retiro,
    confianza: origen && destino ? 0.75 : 0.4,
    fuente: "regex",
  };
}

function extraerJson(text) {
  const t = String(text ?? "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : t;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function parseConIA(texto, opts = {}) {
  if (!iaHabilitada()) return null;

  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model = process.env.GEMINI_VIAJES_MODEL?.trim() || process.env.GEMINI_CORRECCION_MODEL?.trim() || "gemini-2.5-flash";

  const prompt =
    `Interpretá esta solicitud de transporte (email o WhatsApp) y devolvé JSON.\n` +
    `Campos: cliente, origen, destino, toneladas (número), carga (texto corto), fecha_retiro (texto), notas.\n` +
    `Si falta cliente, inferí un nombre razonable del remitente: ${opts.remitente ?? "desconocido"}.\n\n` +
    `Texto:\n${texto}`;

  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) return null;

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
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              cliente: { type: "string" },
              origen: { type: "string" },
              destino: { type: "string" },
              toneladas: { type: "number", nullable: true },
              carga: { type: "string", nullable: true },
              fecha_retiro: { type: "string", nullable: true },
              notas: { type: "string", nullable: true },
            },
            required: ["origen", "destino"],
          },
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.VIAJES_IA_TIMEOUT_MS) || 15000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const partText = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    const parsed = extraerJson(partText);
    if (!parsed?.origen || !parsed?.destino) return null;

    return {
      cliente: String(parsed.cliente ?? opts.remitente ?? "Cliente").trim(),
      origen: String(parsed.origen).trim(),
      destino: String(parsed.destino).trim(),
      toneladas: parsed.toneladas != null ? Number(parsed.toneladas) : null,
      carga: parsed.carga ? String(parsed.carga).trim() : null,
      fecha_retiro: parsed.fecha_retiro ? String(parsed.fecha_retiro).trim() : null,
      notas: parsed.notas ? String(parsed.notas).trim() : null,
      confianza: 0.92,
      fuente: "ia",
    };
  } catch (err) {
    opts.log?.warn?.({ err: err.message }, "IA viajes no disponible");
    return null;
  }
}

/**
 * @param {string} texto
 * @param {{ remitente?: string, canal?: string, log?: { warn?: Function } }} [opts]
 */
export async function parseSolicitudViaje(texto, opts = {}) {
  const raw = String(texto ?? "").trim();
  if (!raw) {
    throw Object.assign(new Error("Texto vacío"), { statusCode: 400 });
  }

  const ia = await parseConIA(raw, opts);
  const base = ia ?? parseRegex(raw);

  if (!base.origen || !base.destino) {
    throw Object.assign(new Error("No pude identificar origen y destino en la solicitud"), {
      statusCode: 422,
      parsed: base,
    });
  }

  return {
    ...base,
    cliente: base.cliente || opts.remitente || "Cliente",
    canal: opts.canal || "desconocido",
    texto_original: raw,
  };
}
