/**
 * Agente conversacional de Gestión de Viajes (WhatsApp).
 * Recolecta datos → match flota → asigna → confirma con cliente y chofer.
 */
import { pareceSolicitudViaje } from "./viajes-solicitud.mjs";

const CAMPOS_REQUERIDOS = ["origen", "destino", "toneladas", "tipo_carga", "fecha_retiro"];

const LABELS = {
  origen: "origen (desde dónde)",
  destino: "destino (hacia dónde)",
  toneladas: "toneladas / peso",
  tipo_carga: "tipo de carga (granos, frío, general, líquido, arena…)",
  fecha_retiro: "fecha de retiro (hoy / mañana / 12/08)",
  cliente: "nombre del cliente / empresa",
};

function iaHabilitada() {
  if (process.env.VIAJES_IA_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.OPENAI_API_KEY?.trim());
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

export function camposFaltantes(datos = {}) {
  const faltan = [];
  for (const k of CAMPOS_REQUERIDOS) {
    const v = datos[k];
    if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
      faltan.push(k);
    }
  }
  return faltan;
}

export function mensajePedirDatos(faltan, { datos = {}, primera = false } = {}) {
  const lista = faltan.map((k) => `• ${LABELS[k] ?? k}`).join("\n");
  const resumen = resumenDatosParciales(datos);
  if (primera) {
    return (
      `Hola 👋 Soy el agente de *Gestión de Viajes*.\n\n` +
      `Para asignar el transporte correcto necesito estos datos:\n${lista}\n\n` +
      `Podés mandarlos todos juntos o de a uno.`
    );
  }
  return (
    (resumen ? `Voy armando el viaje:\n${resumen}\n\n` : "") +
    `Me falta:\n${lista}\n\n` +
    `Respondé con lo que falte (ej: *tipo de carga: soja*, *fecha: mañana*, *28 tn*).`
  );
}

function resumenDatosParciales(datos) {
  const parts = [];
  if (datos.cliente) parts.push(`Cliente: ${datos.cliente}`);
  if (datos.origen || datos.destino) {
    parts.push(`Ruta: ${datos.origen ?? "?"} → ${datos.destino ?? "?"}`);
  }
  if (datos.toneladas) parts.push(`Peso: ${datos.toneladas} t`);
  if (datos.tipo_carga) parts.push(`Carga: ${datos.tipo_carga}`);
  if (datos.fecha_retiro) parts.push(`Retiro: ${datos.fecha_retiro}`);
  return parts.length ? parts.map((p) => `• ${p}`).join("\n") : "";
}

export function mensajeViajeAsignadoCliente(viaje, asignacion) {
  return (
    `✅ *Viaje confirmado*\n\n` +
    `*${viaje.codigo}* · ${viaje.cliente}\n` +
    `${viaje.origen} → ${viaje.destino}\n` +
    (viaje.carga ? `Carga: ${viaje.carga}\n` : "") +
    (asignacion.tipo_unidad ? `Unidad: ${asignacion.tipo_unidad} (${asignacion.capacidad_t} t)\n` : "") +
    (viaje.fecha ? `Retiro: ${viaje.fecha}\n` : "") +
    `\nChofer: *${viaje.chofer}*\n` +
    `Patente: ${viaje.tractor}${viaje.semi ? ` / ${viaje.semi}` : ""}\n\n` +
    `Ya le avisamos al chofer para que confirme.`
  );
}

export function mensajeViajeAsignadoChofer(viaje, asignacion) {
  return (
    `Hola 👋 Tenés un viaje asignado:\n\n` +
    `*${viaje.codigo}* · ${viaje.cliente}\n` +
    `${viaje.origen} → ${viaje.destino}\n` +
    (viaje.carga ? `Carga: ${viaje.carga}\n` : "") +
    (asignacion.tipo_unidad ? `Equipo: ${asignacion.tipo_unidad}\n` : "") +
    (viaje.fecha ? `Retiro: ${viaje.fecha}\n` : "") +
    `Unidad: ${viaje.tractor}${viaje.semi ? ` / ${viaje.semi}` : ""}\n\n` +
    `Respondé *SÍ* / *CONFIRMO* para aceptar el viaje.\n` +
    `Si no podés, escribí *NO* y reasignamos.`
  );
}

export function esConfirmacionChofer(texto) {
  return /^(si|sí|ok|dale|confirmo|acepto|voy|listo|perfecto|yes)[\s!.]*$/i.test(
    String(texto ?? "").trim(),
  );
}

export function esRechazoChofer(texto) {
  return /^(no|nop|no puedo|rechazo|cancelo|imposible)[\s!.]*$/i.test(String(texto ?? "").trim());
}

/** Heurística rápida sin IA. */
export function parseSolicitudHeuristica(texto, { remitente } = {}) {
  const raw = String(texto ?? "").trim();
  const tonMatch = raw.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:t|tn|ton|toneladas?)\b/i);
  const toneladas = tonMatch ? Number(tonMatch[1].replace(",", ".")) : null;

  let origen = null;
  let destino = null;
  const ruta =
    raw.match(/\bdesde\s+([^,.\n]+?)\s+(?:a|hacia|→|->)\s+([^,.\n]+)/i) ||
    raw.match(/\bde\s+([^,.\n]{2,40}?)\s+(?:a|hacia|→|->)\s+([^,.\n]+)/i) ||
    raw.match(/\b([^,.\n]{3,40})\s*(?:→|->)\s*([^,.\n]{3,40})/);
  if (ruta) {
    origen = ruta[1].trim();
    destino = ruta[2].trim();
  }

  let tipo_carga = null;
  const cargaMatch = raw.match(
    /\b(granos?|cereal|soja|ma[ií]z|trigo|fr[ií]o|refrigerad\w*|carne|l[aá]cteos?|congelad\w*|l[ií]quido|combustible|aceite|qu[ií]mico|general|palets?|mercader[ií]a|arena|piedra|escombro|contenedor|container)\b/i,
  );
  if (cargaMatch) tipo_carga = cargaMatch[1].toLowerCase();

  let fecha_retiro = null;
  if (/\bhoy\b/i.test(raw)) fecha_retiro = "hoy";
  else if (/\bmañana\b|\bmanana\b/i.test(raw)) fecha_retiro = "mañana";
  else {
    const f = raw.match(/\b(\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?)\b/);
    if (f) fecha_retiro = f[1];
  }

  const clienteMatch = raw.match(
    /(?:cliente|empresa|para)\s*[:—-]?\s*([A-ZÁÉÍÓÚÑ][\wáéíóúñ\s.&-]{2,40})/i,
  );

  return {
    cliente: clienteMatch?.[1]?.trim() || remitente || null,
    origen,
    destino,
    toneladas,
    tipo_carga,
    carga: tipo_carga
      ? `${tipo_carga}${toneladas ? ` ${toneladas} t` : ""}`
      : toneladas
        ? `${toneladas} t`
        : null,
    fecha_retiro,
    notas: null,
    fuente: "heuristica",
  };
}

/**
 * Extrae / fusiona datos de un mensaje (IA preferida + heurística).
 */
export async function interpretarMensajeViaje(texto, { pendingDatos = {}, remitente, log } = {}) {
  const heur = parseSolicitudHeuristica(texto, { remitente });
  const ia = await parseMensajeViajeConIA(texto, { pendingDatos, remitente, log });
  const base = ia ?? heur;

  const merged = {
    ...pendingDatos,
  };
  for (const k of ["cliente", "origen", "destino", "tipo_carga", "fecha_retiro", "notas", "carga"]) {
    if (base[k] != null && base[k] !== "") merged[k] = base[k];
  }
  if (base.toneladas != null && Number.isFinite(Number(base.toneladas))) {
    merged.toneladas = Number(base.toneladas);
  }
  if (!merged.carga && (merged.tipo_carga || merged.toneladas)) {
    merged.carga = [
      merged.tipo_carga,
      merged.toneladas != null ? `${merged.toneladas} t` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (!merged.cliente) merged.cliente = remitente || pendingDatos.cliente || "Cliente WhatsApp";

  return {
    datos: merged,
    faltan: camposFaltantes(merged),
    fuente: ia ? ia.fuente || "ia" : "heuristica",
    parece_solicitud: pareceSolicitudViaje(texto) || Boolean(pendingDatos.origen || pendingDatos.destino),
  };
}

async function parseMensajeViajeConIA(texto, { pendingDatos, remitente, log } = {}) {
  if (!iaHabilitada()) return null;

  const prompt = `Sos el agente de Gestión de Viajes de una logística argentina.
Extraé datos de una solicitud de transporte por WhatsApp. Devolvé SOLO JSON.

Datos ya conocidos:
${JSON.stringify(pendingDatos ?? {}, null, 2)}

Remitente: ${remitente ?? "desconocido"}

Mensaje:
"""
${texto}
"""

JSON:
{
  "cliente": string|null,
  "origen": string|null,
  "destino": string|null,
  "toneladas": number|null,
  "tipo_carga": string|null,
  "fecha_retiro": string|null,
  "carga": string|null,
  "notas": string|null,
  "intent": "dato"|"pregunta"|"cancelar"|"otro"
}

Reglas:
- tipo_carga: granos/cereal/soja, frio/carne, general/palets, liquido, arena/piedra, contenedor…
- fecha_retiro: dejá "hoy"/"mañana" o fecha dd/mm; no inventes.
- Solo completá campos que el mensaje aporte; el resto null.
- Si pregunta ("qué camión tienen?") intent=pregunta.`;

  try {
    const parsed = await callLlmJson(prompt, { log });
    if (!parsed) return null;
    return {
      cliente: parsed.cliente ? String(parsed.cliente).trim() : null,
      origen: parsed.origen ? String(parsed.origen).trim() : null,
      destino: parsed.destino ? String(parsed.destino).trim() : null,
      toneladas: parsed.toneladas != null ? Number(parsed.toneladas) : null,
      tipo_carga: parsed.tipo_carga ? String(parsed.tipo_carga).trim().toLowerCase() : null,
      fecha_retiro: parsed.fecha_retiro ? String(parsed.fecha_retiro).trim() : null,
      carga: parsed.carga ? String(parsed.carga).trim() : null,
      notas: parsed.notas ? String(parsed.notas).trim() : null,
      intent: parsed.intent || "dato",
      fuente: "ia",
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "IA viajes mensaje falló");
    return null;
  }
}

async function callLlmJson(prompt, { log } = {}) {
  // OpenAI primero en SOL (Gemini Vertex suele dar 403)
  const openai = await callOpenAi(prompt, log);
  if (openai) return openai;
  return callGemini(prompt, log);
}

async function callOpenAi(prompt, log) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_VIAJES_MODEL?.trim() || process.env.OPENAI_DESTINOS_MODEL?.trim() || "gpt-4o-mini";
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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Respondé solo JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.VIAJES_IA_TIMEOUT_MS) || 15000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "OpenAI viajes falló");
    return null;
  }
}

async function callGemini(prompt, log) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project) return null;
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const { gcpClientOptions } = await import("./gcp-credentials.mjs");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      ...gcpClientOptions(),
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) return null;
    const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
    const model =
      process.env.GEMINI_VIAJES_MODEL?.trim() ||
      process.env.GEMINI_CORRECCION_MODEL?.trim() ||
      "gemini-2.5-flash";
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
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.VIAJES_IA_TIMEOUT_MS) || 15000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    return extraerJson(text);
  } catch (err) {
    log?.warn?.({ err: err.message }, "Gemini viajes falló");
    return null;
  }
}

export { CAMPOS_REQUERIDOS, LABELS };
