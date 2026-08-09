/**
 * Router de intención WhatsApp (inicio de conversación).
 * Decide: remito | viaje | reclamo | chat | desconocido
 * OpenAI primero; heurística de respaldo.
 */

function iaHabilitada() {
  if (process.env.WA_ROUTER_IA_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

function extraerJson(text) {
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

/** Heurística rápida si cae la IA. */
export function clasificarIntencionHeuristica(texto, { esChoferRemitos = false } = {}) {
  const raw = String(texto ?? "").trim();
  const t = raw.toLowerCase();

  if (!raw) {
    return {
      intent: "desconocido",
      confianza: 0,
      mensaje: null,
      fuente: "heuristica",
    };
  }

  // Remito / foto / corrección
  if (
    /\b(remito|gu[ií]a|km\s*(inicial|final)|patente|tractor|semi|foto del remito|nro\.?\s*gu[ií]a)\b/i.test(
      t,
    )
  ) {
    return { intent: "remito", confianza: 0.85, mensaje: null, fuente: "heuristica" };
  }

  // Reclamo
  if (
    /\b(reclamo|queja|problema|demora|faltante|roto|dañad|danad|extraviad|no\s+lleg[oó]|mal\s+estado|indemniz)\b/i.test(
      t,
    )
  ) {
    return {
      intent: "reclamo",
      confianza: 0.8,
      mensaje: null,
      fuente: "heuristica",
    };
  }

  // Viaje / flete
  if (
    /\b(viaje|flete|transporte|necesitamos|solicitamos|pedimos|retiro|camión|camion|tolva|toneladas?|\btn\b)\b/i.test(
      t,
    ) ||
    /\b(desde|de)\s+.+\s+(a|hacia|→)\s+/i.test(raw)
  ) {
    return { intent: "viaje", confianza: 0.8, mensaje: null, fuente: "heuristica" };
  }

  if (esChoferRemitos) {
    return { intent: "remito", confianza: 0.55, mensaje: null, fuente: "heuristica" };
  }

  return {
    intent: "desconocido",
    confianza: 0.4,
    mensaje:
      "Hola 👋 ¿En qué te puedo ayudar?\n\n" +
      "• *Viaje / flete* — pedir transporte\n" +
      "• *Reclamo* — demora, faltante, daño…\n\n" +
      "Contame brevemente qué necesitás.",
    fuente: "heuristica",
  };
}

async function callOpenAiRouter(prompt, log) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_WA_ROUTER_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    process.env.OPENAI_DESTINOS_MODEL?.trim() ||
    "gpt-4o-mini";
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
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sos el router de un bot logístico argentino por WhatsApp. Respondé SOLO JSON válido.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.WA_ROUTER_IA_TIMEOUT_MS) || 12000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "WA router OpenAI falló");
    return null;
  }
}

/**
 * @returns {Promise<{
 *   intent: 'remito'|'viaje'|'reclamo'|'chat'|'desconocido',
 *   confianza: number,
 *   mensaje: string|null,
 *   fuente: string,
 * }>}
 */
export async function clasificarIntencionWhatsApp({
  texto,
  esChoferRemitos = false,
  nombre = null,
  log = null,
} = {}) {
  const heur = clasificarIntencionHeuristica(texto, { esChoferRemitos });
  if (!iaHabilitada()) return heur;

  const prompt = `Clasificá el mensaje de WhatsApp para una logística argentina.

Contexto:
- es_chofer_remitos: ${esChoferRemitos ? "sí" : "no"} (si sí, suele mandar fotos/correcciones de remitos)
- nombre: ${nombre || "desconocido"}

Mensaje:
"""
${texto}
"""

Intents posibles:
- "remito": foto/corrección/confirmación de remito, km, patente, guía
- "viaje": pedir flete/transporte, origen-destino, toneladas, tipo de carga, disponibilidad
- "reclamo": queja, demora, faltante, daño, extravío, problema con un viaje/entrega
- "chat": saludo o pregunta general sin pedido concreto
- "desconocido": no se entiende

Reglas:
- Si pide transporte/flete/viaje aunque sea chofer de remitos → "viaje"
- Si es reclamo → "reclamo"
- Si es chofer de remitos y habla de guía/km/foto/ok → "remito"
- Si no es chofer de remitos y no está claro → "desconocido" y armá un mensaje corto (rioplatense) preguntando si quiere viaje o reclamo
- mensaje: solo si intent es chat/desconocido (texto para WhatsApp). Si no, null.

JSON:
{
  "intent": "remito"|"viaje"|"reclamo"|"chat"|"desconocido",
  "confianza": 0.0-1.0,
  "mensaje": string|null
}`;

  const parsed = await callOpenAiRouter(prompt, log);
  if (!parsed) return heur;

  const intent = String(parsed.intent || "").toLowerCase().trim();
  const allowed = new Set(["remito", "viaje", "reclamo", "chat", "desconocido"]);
  if (!allowed.has(intent)) return heur;

  let mensaje = parsed.mensaje != null ? String(parsed.mensaje).trim() : null;
  if ((intent === "desconocido" || intent === "chat") && !mensaje) {
    mensaje = heur.mensaje;
  }

  return {
    intent,
    confianza: Number(parsed.confianza) || 0.7,
    mensaje,
    fuente: "ia",
  };
}
