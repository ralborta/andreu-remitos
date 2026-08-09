/**
 * Agente Destinos (Confirmación de Destinos): interpreta respuestas del cliente
 * con Gemini y arma respuestas conversacionales.
 */
import { GoogleAuth } from "google-auth-library";
import { gcpClientOptions } from "./gcp-credentials.mjs";
import { esConfirmacionDestino, extraerDireccionCorreccion } from "./destinos.mjs";

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
  if (process.env.CORRECCION_IA_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
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

  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model =
    process.env.GEMINI_DESTINOS_MODEL?.trim() ||
    process.env.GEMINI_CORRECCION_MODEL?.trim() ||
    "gemini-2.5-flash";

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

Clasificá la intención:
- "confirm": confirma que la dirección está bien (sí, ok, dale, correcto…).
- "pedir_direccion": rechaza o dice que está mal PERO no da una dirección usable todavía. Pedile calle, número y localidad, o pin de ubicación. Explicá brevemente que lo necesitamos para que el chofer entregue bien.
- "correccion": trae una dirección nueva o corregida (aunque diga "no, es…"). Extraé solo la dirección en "direccion".
- "chat": pregunta, duda o charla ("¿por qué me escriben?", "quiénes son?", etc.). Respondé en "mensaje" y volvé a guiar a confirmar o corregir.

Reglas:
- Si solo dice "no" / "incorrecto" → pedir_direccion (no inventes dirección).
- mensaje: español rioplatense, sin markdown excesivo; podés usar *negrita* de WhatsApp.
- En confirm o correccion, mensaje puede ser null.`;

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
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              intent: { type: "string" },
              direccion: { type: "string", nullable: true },
              mensaje: { type: "string", nullable: true },
            },
            required: ["intent"],
          },
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.DESTINOS_IA_TIMEOUT_MS) || 12000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const partText =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    const parsed = extraerJson(partText);
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
          fuente: "ia",
        };
      }
    }

    log?.info?.({ intent, fuente: "ia" }, "Destinos agente IA");
    return { intent, direccion, mensaje, fuente: "ia" };
  } catch (err) {
    log?.warn?.({ err: err.message }, "IA destinos no disponible");
    return null;
  }
}
