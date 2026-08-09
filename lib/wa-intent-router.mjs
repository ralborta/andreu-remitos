/**
 * Router de intención WhatsApp (inicio de conversación) — full IA.
 * Decide: remito | viaje | reclamo | rendicion | incidencia | chat | desconocido
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

/** Chofer quiere enviar / hablar de remito (no debe quedar atrapado en ETA Destinos). */
export function pareceQuiereRemito(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return false;
  return /\b(remito|gu[ií]a|foto\s+del\s+remito|enviar?\s+(mi\s+)?remito|mand(o|ar)\s+(el\s+|mi\s+)?remito|nro\.?\s*gu[ií]a|km\s*(inicial|final))\b/i.test(
    t,
  );
}

/** Emergencia si cae la IA — no es el camino normal. */
export function clasificarIntencionHeuristica(
  texto,
  { esChoferRemitos = false, esChoferFlotaViajes = false } = {},
) {
  const raw = String(texto ?? "").trim();
  const t = raw.toLowerCase();
  const esChoferIncidencia = esChoferRemitos || esChoferFlotaViajes;

  if (!raw) {
    return {
      intent: "desconocido",
      confianza: 0,
      mensaje: null,
      fuente: "heuristica",
    };
  }

  const esChoferOperativo = esChoferRemitos || esChoferFlotaViajes;

  // Rendición: choferes de Remitos o flota Viajes (demo TransitOne).
  if (
    esChoferOperativo &&
    /\b(rendici[oó]n|gasto|nafta|combustible|peaje|ticket|factura|comprobante|aceite|remolque|auxilio|taller)\b/i.test(
      t,
    ) &&
    !/\b(pinchazo|incidencia|accidente|polic[ií]a)\b/i.test(t)
  ) {
    return { intent: "rendicion", confianza: 0.8, mensaje: null, fuente: "heuristica" };
  }

  // Incidencia en ruta — flota Viajes o Remitos (antes de reclamo)
  if (
    esChoferIncidencia &&
    /\b(incidencia|incidente|pinchazo|pinch[eé]|accidente|choque|vuelco|polic[ií]a|control\s*(de\s*)?ruta|reten|desv[ií]o|estoy\s*parado|parada\s*no\s*prevista|problema\s*mec[aá]nico|no\s*arranca)\b/i.test(
      t,
    )
  ) {
    return { intent: "incidencia", confianza: 0.85, mensaje: null, fuente: "heuristica" };
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
    // Chofer hablando de demora/problema en ruta → incidencia, no reclamo de cliente
    if (
      esChoferIncidencia &&
      /\b(demora|retraso|parado|tr[aá]nsito|atasco|ruta)\b/i.test(t) &&
      !/\b(reclamo|cliente|entrega\s*mal|faltante|dañad)\b/i.test(t)
    ) {
      return { intent: "incidencia", confianza: 0.7, mensaje: null, fuente: "heuristica" };
    }
    return { intent: "reclamo", confianza: 0.7, mensaje: null, fuente: "heuristica" };
  }

  if (
    /\b(viaje|flete|transporte|necesito|necesitamos|solicitamos|pedimos|toneladas?|\btn\b|origen|destino|llevar\s+carga)\b/i.test(
      t,
    )
  ) {
    return { intent: "viaje", confianza: 0.7, mensaje: null, fuente: "heuristica" };
  }

  if (esChoferOperativo) {
    return { intent: "remito", confianza: 0.5, mensaje: null, fuente: "heuristica" };
  }

  return {
    intent: "desconocido",
    confianza: 0.4,
    mensaje: esChoferOperativo
      ? "Hola 👋 ¿En qué te puedo ayudar?\n\n" +
        "• *Remito* — foto / correcciones\n" +
        "• *Incidencia* — pinchazo, demora, control, mecánico…\n" +
        "• *Rendición* — gastos (nafta, peajes, arreglos…)\n" +
        "• *Viaje / flete*\n\n" +
        "Contame brevemente qué necesitás."
      : "Hola 👋 ¿En qué te puedo ayudar?\n\n" +
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
 *   intent: 'remito'|'viaje'|'reclamo'|'rendicion'|'incidencia'|'chat'|'desconocido',
 *   confianza: number,
 *   mensaje: string|null,
 *   fuente: string,
 * }>}
 */
export async function clasificarIntencionWhatsApp({
  texto,
  esChoferRemitos = false,
  esChoferFlotaViajes = false,
  nombre = null,
  log = null,
} = {}) {
  const emergency = () =>
    clasificarIntencionHeuristica(texto, { esChoferRemitos, esChoferFlotaViajes });

  if (!iaHabilitada()) return emergency();

  const esChoferIncidencia = esChoferRemitos || esChoferFlotaViajes;

  const prompt = `Clasificá el mensaje de WhatsApp para una logística argentina (SOL / TransitOne).
Tu trabajo es 100% semántico: NO dependas de palabras clave exactas.

Contexto:
- es_chofer_remitos: ${esChoferRemitos ? "sí" : "no"} (Parámetros/Remitos)
- es_chofer_flota_viajes: ${esChoferFlotaViajes ? "sí" : "no"} (Gestión de Viajes → Choferes)
- es_chofer_operativo: ${esChoferIncidencia ? "sí" : "no"} (cualquiera de los dos → remitos, rendición, incidencias)
- nombre: ${nombre || "desconocido"}

Mensaje:
"""
${texto}
"""

Intents:
- "incidencia": evento EN RUTA del chofer — pinchazo, accidente, control policial, desvío, parado, demora en viaje, problema mecánico, "incidencia". SOLO si es_chofer_operativo=sí. NO es queja de cliente.
- "rendicion": gastos menores del viaje — nafta, peajes, tickets, facturas, aceite, remolque, auxilio, arreglos, "rendición" (comprobante). SOLO si es_chofer_operativo=sí. Pinchazo SIN pedir rendir gasto → "incidencia".
- "viaje": pide transporte/flete, o aporta datos de un viaje (origen, destino, toneladas, tipo de carga, fecha/hora)
- "reclamo": QUEJA DE CLIENTE — demora de entrega, faltante, daño, extravío, producto equivocado. NUNCA si es chofer reportando algo en ruta.
- "remito": foto/corrección/confirmación de remito, km, patente, guía, "quiero enviar mi remito", "OK" de remito. SOLO si es_chofer_operativo=sí.
- "chat": saludo o pregunta general sin pedido concreto
- "desconocido": no se entiende

Reglas:
- Si es_chofer_operativo=no: NUNCA elijas "rendicion" ni "remito" ni "incidencia".
- Si es_chofer_operativo=sí y habla de remito / foto de remito / guía / enviar remito → "remito".
- Si es_chofer_operativo=sí y habla de evento en ruta / pinchazo / policía / accidente / estoy parado → "incidencia".
- Si es_chofer_operativo=sí y habla de gasto/comprobante/nafta/peaje/taller para rendir → "rendicion".
- Preferí "viaje" si hay indicios de pedir o cargar un flete, aunque falten datos.
- Si pide transporte/flete aunque sea chofer → "viaje".
- Si no es chofer y no está claro → "desconocido" o "chat" y armá mensaje corto preguntando solo viaje o reclamo.
- Si es chofer operativo y saluda sin pedido → "chat" ofreciendo remito, incidencia, rendición o viaje.
- mensaje: solo si intent es chat/desconocido (texto WhatsApp). Si no, null.

JSON:
{
  "intent": "remito"|"viaje"|"reclamo"|"rendicion"|"incidencia"|"chat"|"desconocido",
  "confianza": 0.0-1.0,
  "mensaje": string|null
}`;

  const parsed = await callOpenAiRouter(prompt, log);
  if (!parsed) {
    log?.warn?.("WA router: IA sin respuesta → emergencia heurística");
    return emergency();
  }

  let intent = String(parsed.intent || "").toLowerCase().trim();
  const allowed = new Set([
    "remito",
    "viaje",
    "reclamo",
    "rendicion",
    "incidencia",
    "chat",
    "desconocido",
  ]);
  if (!allowed.has(intent)) return emergency();

  // Gate: clientes nunca caen en flujos internos de chofer.
  if (!esChoferIncidencia && (intent === "rendicion" || intent === "remito")) {
    intent = "desconocido";
  }
  if (!esChoferIncidencia && intent === "incidencia") {
    intent = "reclamo";
  }

  let mensaje = parsed.mensaje != null ? String(parsed.mensaje).trim() : null;
  if ((intent === "desconocido" || intent === "chat") && !mensaje) {
    mensaje = emergency().mensaje;
  }
  // Por si la IA ofreció rendición a un cliente en el mensaje.
  if (!esChoferIncidencia && mensaje && /rendici[oó]n/i.test(mensaje)) {
    mensaje = emergency().mensaje;
  }

  return {
    intent,
    confianza: Number(parsed.confianza) || 0.8,
    mensaje,
    fuente: "ia",
  };
}
