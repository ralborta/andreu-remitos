/**
 * Router de intención WhatsApp (inicio de conversación) — full IA.
 * Decide: remito | viaje | reclamo | rendicion | chat | desconocido
 * OpenAI primero; heurística SOLO si la IA no responde.
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

/** Emergencia si cae la IA — no es el camino normal. */
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

  if (
    /\b(rendici[oó]n|gasto|nafta|combustible|peaje|ticket|factura|comprobante|llanta|aceite|remolque|auxilio|taller)\b/i.test(
      t,
    )
  ) {
    return { intent: "rendicion", confianza: 0.8, mensaje: null, fuente: "heuristica" };
  }

  if (
    /\b(remito|gu[ií]a|km\s*(inicial|final)|patente|tractor|semi|foto del remito|nro\.?\s*gu[ií]a)\b/i.test(
      t,
    )
  ) {
    return { intent: "remito", confianza: 0.7, mensaje: null, fuente: "heuristica" };
  }

  if (
    /\b(reclamo|queja|problema|demora|faltante|roto|dañad|danad|extraviad|no\s+lleg[oó]|mal\s+estado|indemniz)\b/i.test(
      t,
    )
  ) {
    return { intent: "reclamo", confianza: 0.7, mensaje: null, fuente: "heuristica" };
  }

  if (
    /\b(viaje|flete|transporte|necesito|necesitamos|solicitamos|pedimos|toneladas?|\btn\b|origen|destino|llevar\s+carga)\b/i.test(
      t,
    )
  ) {
    return { intent: "viaje", confianza: 0.7, mensaje: null, fuente: "heuristica" };
  }

  if (esChoferRemitos) {
    return { intent: "remito", confianza: 0.5, mensaje: null, fuente: "heuristica" };
  }

  return {
    intent: "desconocido",
    confianza: 0.4,
    mensaje:
      "Hola 👋 ¿En qué te puedo ayudar?\n\n" +
      "• *Viaje / flete* — pedir transporte\n" +
      "• *Rendición* — gastos (nafta, peajes, arreglos…)\n" +
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
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sos el router IA de un bot logístico argentino por WhatsApp. Clasificás intención con criterio humano. Respondé SOLO JSON válido.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.WA_ROUTER_IA_TIMEOUT_MS) || 15000),
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
 *   intent: 'remito'|'viaje'|'reclamo'|'rendicion'|'chat'|'desconocido',
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
  const emergency = () => clasificarIntencionHeuristica(texto, { esChoferRemitos });

  if (!iaHabilitada()) return emergency();

  const prompt = `Clasificá el mensaje de WhatsApp para una logística argentina (SOL / TransitOne).
Tu trabajo es 100% semántico: NO dependas de palabras clave exactas.

Contexto:
- es_chofer_remitos: ${esChoferRemitos ? "sí" : "no"} (si sí, puede mandar fotos/correcciones de remitos)
- nombre: ${nombre || "desconocido"}

Mensaje:
"""
${texto}
"""

Intents:
- "rendicion": gastos menores del viaje — nafta, peajes, tickets, facturas, llantas, aceite, remolque, auxilio mecánico, arreglos del vehículo, "rendición"
- "viaje": pide transporte/flete, o aporta datos de un viaje (origen, destino, toneladas, tipo de carga, fecha/hora)
- "reclamo": queja, demora, faltante, daño, extravío, problema con entrega/viaje
- "remito": foto/corrección/confirmación de remito, km, patente, guía, "OK" de remito (típico de chofer de remitos)
- "chat": saludo o pregunta general sin pedido concreto
- "desconocido": no se entiende

Reglas:
- Si habla de gasto/comprobante/nafta/peaje/taller → "rendicion" (aunque sea chofer de remitos).
- Preferí "viaje" si hay indicios de pedir o cargar un flete, aunque falten datos.
- Si es_chofer_remitos=no, casi nunca elijas "remito" (salvo que explícitamente hable de remito/guía/km).
- Si pide transporte/flete aunque sea chofer de remitos → "viaje".
- Si no es chofer y no está claro → "desconocido" o "chat" y armá mensaje corto preguntando viaje, rendición o reclamo.
- mensaje: solo si intent es chat/desconocido (texto WhatsApp). Si no, null.

JSON:
{
  "intent": "remito"|"viaje"|"reclamo"|"rendicion"|"chat"|"desconocido",
  "confianza": 0.0-1.0,
  "mensaje": string|null
}`;

  const parsed = await callOpenAiRouter(prompt, log);
  if (!parsed) {
    log?.warn?.("WA router: IA sin respuesta → emergencia heurística");
    return emergency();
  }

  const intent = String(parsed.intent || "").toLowerCase().trim();
  const allowed = new Set(["remito", "viaje", "reclamo", "rendicion", "chat", "desconocido"]);
  if (!allowed.has(intent)) return emergency();

  let mensaje = parsed.mensaje != null ? String(parsed.mensaje).trim() : null;
  if ((intent === "desconocido" || intent === "chat") && !mensaje) {
    mensaje = emergency().mensaje;
  }

  return {
    intent,
    confianza: Number(parsed.confianza) || 0.8,
    mensaje,
    fuente: "ia",
  };
}
