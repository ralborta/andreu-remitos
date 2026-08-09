/**
 * Agente Destinos (Confirmación de Destinos): interpreta respuestas del cliente
 * con Gemini y arma respuestas conversacionales.
 */
import { GoogleAuth } from "google-auth-library";
import { gcpClientOptions } from "./gcp-credentials.mjs";
import {
  esConfirmacionDestino,
  extraerDireccionCorreccion,
  formatearEtaMinutos,
  parseEtaHeuristica,
  pareceDemoraChofer,
} from "./destinos.mjs";

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
  if (process.env.DESTINOS_IA_ENABLED === "false") return false;
  // OpenAI alcanza aunque Vertex/Gemini no tenga permiso (403).
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.OPENAI_API_KEY?.trim());
}

async function callLlmJson(prompt, { log, maxTokens = 512 } = {}) {
  const gemini = await callGeminiJson(prompt, { log, maxTokens });
  if (gemini) return { parsed: gemini, motor: "gemini" };
  const openai = await callOpenAiJson(prompt, { log, maxTokens });
  if (openai) return { parsed: openai, motor: "openai" };
  return null;
}

async function callGeminiJson(prompt, { log, maxTokens = 512 } = {}) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project) return null;
  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model =
    process.env.GEMINI_DESTINOS_MODEL?.trim() ||
    process.env.GEMINI_CORRECCION_MODEL?.trim() ||
    "gemini-2.5-flash";
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
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.DESTINOS_IA_TIMEOUT_MS) || 15000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 160)}`);
    }
    const data = await res.json();
    const partText =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    return extraerJson(partText);
  } catch (err) {
    log?.warn?.({ err: err.message }, "Gemini destinos falló — pruebo OpenAI");
    return null;
  }
}

async function callOpenAiJson(prompt, { log, maxTokens = 512 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_DESTINOS_MODEL?.trim() || "gpt-4o-mini";
  try {
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
          {
            role: "system",
            content: "Sos un agente logístico. Respondé SOLO un JSON válido, sin markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.DESTINOS_IA_TIMEOUT_MS) || 15000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${res.status}: ${errBody.slice(0, 160)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return extraerJson(text);
  } catch (err) {
    log?.warn?.({ err: err.message }, "OpenAI destinos no disponible");
    return null;
  }
}

function extraerJson(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/** "No", "incorrecto", "está mal" sin dirección útil. */
export function esRechazoSinDireccion(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return false;
  if (esConfirmacionDestino(t)) return false;
  const extraida = extraerDireccionCorreccion(t);
  const soloRechazo =
    /^(no|nop|nope|incorrecto|incorrecta|esta mal|está mal|mal|no es|no esta|no está|error|falso)[\s!.?]*$/i.test(
      t,
    );
  if (soloRechazo) return true;
  if (/^(no|incorrecto)/i.test(t) && (!extraida || extraida.length < 8 || /^no\b/i.test(extraida))) {
    return !/\d/.test(t) && !/(calle|av\.?|avenida|ruta|pasaje|barrio)/i.test(t);
  }
  return false;
}

const MSG_PEDIR_DIRECCION =
  `Entiendo, esa dirección no es correcta ✅\n\n` +
  `Para que el chofer llegue bien, necesito la *dirección de entrega* ` +
  `(calle, número y localidad) o tu *ubicación* por WhatsApp 📌\n\n` +
  `¿Me la pasás?`;

const MSG_SIN_CONTENIDO =
  `Para confirmar el destino de entrega necesito que me digas si la dirección es correcta (*SÍ*) ` +
  `o, si no, la dirección correcta / tu ubicación 📌`;

/**
 * @returns {Promise<{
 *   intent: 'confirm'|'pedir_direccion'|'correccion'|'chat',
 *   direccion: string|null,
 *   mensaje: string|null,
 *   fuente: 'ia'|'heuristica'
 * }>}
 */
export async function interpretarRespuestaDestinoCliente(texto, { pending, log } = {}) {
  const t = String(texto ?? "").trim();
  if (!t) {
    return { intent: "pedir_direccion", direccion: null, mensaje: MSG_SIN_CONTENIDO, fuente: "heuristica" };
  }

  const ia = await parseConIA(t, { pending, log });
  if (ia) return ia;

  if (esConfirmacionDestino(t)) {
    return { intent: "confirm", direccion: null, mensaje: null, fuente: "heuristica" };
  }
  if (esRechazoSinDireccion(t)) {
    return {
      intent: "pedir_direccion",
      direccion: null,
      mensaje: MSG_PEDIR_DIRECCION,
      fuente: "heuristica",
    };
  }

  const direccion = extraerDireccionCorreccion(t);
  return { intent: "correccion", direccion, mensaje: null, fuente: "heuristica" };
}

async function parseConIA(texto, { pending, log } = {}) {
  if (!iaHabilitada()) return null;

  const propuesta = pending?.formatted_address ?? "(sin dirección propuesta)";
  const cliente = pending?.cliente ?? "cliente";

  const prompt = `Sos el agente de Confirmación de Destinos de una logística argentina (SOL / TransitOne).
Hablás por WhatsApp con el receptor de una entrega. Sos amable, claro y breve (máx 3-4 líneas).
NO sos el bot de remitos: tu único trabajo es validar o corregir la dirección de entrega.

Destino propuesto ahora:
"""
${propuesta}
"""
Cliente: ${cliente}

Mensaje del cliente:
"""
${texto}
"""

Devolvé JSON con:
- intent: "confirm" | "pedir_direccion" | "correccion" | "chat"
- direccion: string|null (solo si correccion)
- mensaje: string|null

Reglas:
- "confirm": sí/ok/dale/correcto…
- "pedir_direccion": rechaza sin dirección usable; pedí calle/número/localidad o pin; explicá por qué.
- "correccion": trae dirección nueva; extraé en "direccion".
- "chat": pregunta/duda; respondé en "mensaje" y guiá a confirmar/corregir.
- Solo "no"/"incorrecto" → pedir_direccion.`;

  try {
    const out = await callLlmJson(prompt, { log, maxTokens: 512 });
    if (!out?.parsed) return null;
    const parsed = out.parsed;
    const intent = String(parsed?.intent ?? "").toLowerCase().trim();
    if (!["confirm", "pedir_direccion", "correccion", "chat"].includes(intent)) return null;

    let direccion = parsed?.direccion != null ? String(parsed.direccion).trim() : null;
    if (direccion && direccion.length < 4) direccion = null;
    let mensaje = parsed?.mensaje != null ? String(parsed.mensaje).trim() : null;
    if (mensaje && !mensaje.length) mensaje = null;

    if (intent === "pedir_direccion" && !mensaje) mensaje = MSG_PEDIR_DIRECCION;
    if (intent === "correccion" && !direccion) {
      direccion = extraerDireccionCorreccion(texto);
      if (!direccion || direccion.length < 4) {
        return {
          intent: "pedir_direccion",
          direccion: null,
          mensaje: mensaje || MSG_PEDIR_DIRECCION,
          fuente: out.motor,
        };
      }
    }

    log?.info?.({ intent, fuente: out.motor }, "Destinos agente IA");
    return { intent, direccion, mensaje, fuente: out.motor };
  } catch (err) {
    log?.warn?.({ err: err.message }, "IA destinos no disponible");
    return null;
  }
}

const MSG_PEDIR_ETA =
  `Necesito un *tiempo estimado de llegada* (ej: *25 min* o *1 hora*).\n` +
  `Y si más adelante hay retraso, avisame por acá.`;

/**
 * Interpreta respuesta del chofer: ETA inicial o demora.
 * @returns {Promise<{
 *   intent: 'eta'|'demora'|'pedir_eta'|'chat',
 *   minutos: number|null,
 *   etaTexto: string|null,
 *   mensaje: string|null,
 *   fuente: string
 * }>}
 */
export async function interpretarRespuestaChoferEta(texto, { pending, log } = {}) {
  const t = String(texto ?? "").trim();
  if (!t) {
    return {
      intent: "pedir_eta",
      minutos: null,
      etaTexto: null,
      mensaje: MSG_PEDIR_ETA,
      fuente: "heuristica",
    };
  }

  // Siempre IA primero (agente conversacional). Heurística solo si Gemini falla.
  const ia = await parseEtaChoferConIA(t, { pending, log });
  if (ia) {
    // Si la IA devolvió minutos, cruzar con heurística por si quedó corto (ej. solo 30 de 1h30)
    if ((ia.intent === "eta" || ia.intent === "demora") && ia.minutos != null) {
      const h = parseEtaHeuristica(t);
      if (h && h.minutos > ia.minutos && /\bhoras?\b|\bhrs?\b|\bh\b/i.test(t)) {
        log?.warn?.(
          { iaMin: ia.minutos, heurMin: h.minutos, texto: t.slice(0, 80) },
          "ETA IA menor que heurística con horas — uso heurística",
        );
        return {
          ...ia,
          minutos: h.minutos,
          etaTexto: h.texto,
          fuente: "ia+heuristica",
        };
      }
    }
    return ia;
  }

  log?.warn?.({ texto: t.slice(0, 80) }, "ETA chofer sin IA — fallback heurística");
  const parsed = parseEtaHeuristica(t);
  if (parsed) {
    const demora =
      (pareceDemoraChofer(t) || /corrig|no era|no es|mal|equivo/i.test(t)) &&
      pending?.estado === "en_ruta";
    return {
      intent: demora ? "demora" : "eta",
      minutos: parsed.minutos,
      etaTexto: parsed.texto,
      mensaje: null,
      fuente: "heuristica",
    };
  }

  if (pending?.estado === "esperando_eta_chofer") {
    return {
      intent: "pedir_eta",
      minutos: null,
      etaTexto: null,
      mensaje: MSG_PEDIR_ETA,
      fuente: "heuristica",
    };
  }

  return {
    intent: "pedir_eta",
    minutos: null,
    etaTexto: null,
    mensaje:
      `¿Cuánto estimás ahora de demora o llegada? (ej: *1 hora 30* o *15 min más*)`,
    fuente: "heuristica",
  };
}

async function parseEtaChoferConIA(texto, { pending, log } = {}) {
  if (!iaHabilitada()) {
    log?.warn?.("DESTINOS IA deshabilitada (sin GCP ni OPENAI_API_KEY)");
    return null;
  }

  const prompt = `Sos el agente de Confirmación de Destinos de una logística argentina. Hablás con el *chofer* por WhatsApp.
Tenés que ENTENDER lenguaje natural siempre (abreviaturas, typos, correcciones).

Estado del pedido: ${pending?.estado ?? "desconocido"}
Destino: ${pending?.formatted_address ?? "—"}
Cliente: ${pending?.cliente ?? "—"}
ETA que ya le comunicamos al cliente (si hay): ${pending?.eta_texto ?? "ninguno"}

Mensaje del chofer:
"""
${texto}
"""

Devolvé JSON:
- intent: "eta" | "demora" | "pedir_eta" | "chat"
- minutos: entero total en minutos (ej. 1h30 → 90)
- eta_texto: español corto (ej. "1 h 30 min")
- mensaje: solo si hay que hablar / pedir aclaración

Reglas:
- "1 hrs y 30 minutos" / "1h30" / "una hora y 30" → minutos=90
- "30 min" → 30; "media hora" → 30; "hora y media" → 90
- Si corrige un ETA mal entendido → intent "demora" con el tiempo CORRECTO
- Nunca ignores las horas: horas*60 + minutos`;

  try {
    const out = await callLlmJson(prompt, { log, maxTokens: 400 });
    if (!out?.parsed) return null;
    const parsed = out.parsed;
    const intent = String(parsed?.intent ?? "").toLowerCase().trim();
    if (!["eta", "demora", "pedir_eta", "chat"].includes(intent)) return null;

    let minutos = parsed?.minutos != null ? Math.round(Number(parsed.minutos)) : null;
    if (!Number.isFinite(minutos) || minutos <= 0) minutos = null;
    let etaTexto = parsed?.eta_texto ? String(parsed.eta_texto).trim() : null;
    if (!etaTexto && minutos) etaTexto = formatearEtaMinutos(minutos);
    else if (!minutos && etaTexto) {
      const h = parseEtaHeuristica(etaTexto);
      if (h) {
        minutos = h.minutos;
        etaTexto = h.texto;
      }
    }
    if (!minutos) {
      const h = parseEtaHeuristica(texto);
      if (h) {
        minutos = h.minutos;
        etaTexto = etaTexto || h.texto;
      }
    } else {
      etaTexto = formatearEtaMinutos(minutos) || etaTexto;
    }
    let mensaje = parsed?.mensaje ? String(parsed.mensaje).trim() : null;

    if ((intent === "eta" || intent === "demora") && !etaTexto) {
      return {
        intent: "pedir_eta",
        minutos: null,
        etaTexto: null,
        mensaje: mensaje || MSG_PEDIR_ETA,
        fuente: out.motor,
      };
    }

    log?.info?.({ intent, minutos, etaTexto, fuente: out.motor }, "Destinos ETA chofer IA");
    return { intent, minutos, etaTexto, mensaje, fuente: out.motor };
  } catch (err) {
    log?.warn?.({ err: err.message }, "IA ETA chofer no disponible");
    return null;
  }
}
