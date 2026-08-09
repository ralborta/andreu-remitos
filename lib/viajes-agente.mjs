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
      `Para consultar disponibilidad y armar la reserva necesito:\n${lista}\n\n` +
      `Si podés, sumá también *horario preferido* (ej: 08:00).\n` +
      `Podés mandarlos todos juntos o de a uno.`
    );
  }
  return (
    (resumen ? `Voy armando el viaje:\n${resumen}\n\n` : "") +
    `Me falta:\n${lista}\n\n` +
    `Respondé con lo que falte (ej: *tipo de carga: soja*, *fecha: mañana*, *28 tn*, *hora: 8*).`
  );
}

export function mensajeConsultandoDisponibilidad(datos = {}) {
  const ruta = datos.origen && datos.destino ? `${datos.origen} → ${datos.destino}` : "tu viaje";
  const cuando = [datos.fecha_retiro, datos.hora_retiro].filter(Boolean).join(" ");
  return (
    `Perfecto. Déjame *consultar la disponibilidad*` +
    (cuando ? ` para *${cuando}*` : "") +
    ` (${ruta})…`
  );
}

function formatearFechaCorta(fechaIso) {
  if (!fechaIso) return "";
  const [y, m, d] = String(fechaIso).split("-");
  if (!d) return fechaIso;
  return `${d}/${m}`;
}

export function mensajePropuestaReserva(consulta, datos = {}) {
  const pedida = consulta.pedida ?? {};
  const prop = consulta.propuesta;
  if (!prop) {
    return (
      `Consulté la flota y *no tengo disponibilidad*` +
      (pedida.fecha ? ` para ${formatearFechaCorta(pedida.fecha)}` : "") +
      (pedida.hora ? ` a las ${pedida.hora}` : "") +
      `.\n\n¿Querés probar otra fecha, horario o tipo de carga?`
    );
  }

  const lineaSlot = (s, i) =>
    `${i}) *${formatearFechaCorta(s.fecha)} ${s.hora}* — ${s.tipo_unidad || "unidad"} ${s.capacidad_t}t` +
    (s.motivo ? ` (${s.motivo})` : "");

  if (consulta.exacta_ok) {
    return (
      `Consulté disponibilidad ✅\n\n` +
      `Tengo para *${formatearFechaCorta(prop.fecha)} a las ${prop.hora}*:\n` +
      `• Unidad: ${prop.tipo_unidad} (${prop.capacidad_t} t)\n` +
      `• Carga: ${datos.tipo_carga || "—"}\n` +
      `• Ruta: ${datos.origen} → ${datos.destino}\n\n` +
      `¿Te sirve? Confirmame con *SÍ* para generar la gestión de reserva.\n` +
      `Si preferís otro horario, pedime opciones.`
    );
  }

  const alts = [prop, ...(consulta.alternativas ?? [])].slice(0, 4);
  const lista = alts.map((s, idx) => lineaSlot(s, idx + 1)).join("\n");
  const pedidaTxt =
    (pedida.fecha ? formatearFechaCorta(pedida.fecha) : "esa fecha") +
    (pedida.hora ? ` a las ${pedida.hora}` : "");

  return (
    `Consulté disponibilidad.\n\n` +
    `Para *${pedidaTxt}* no tengo cupo exacto, pero sí estas opciones:\n` +
    `${lista}\n\n` +
    `¿Te sirve alguna? Respondé *1*, *2*… o *SÍ* (tomo la 1) para generar la gestión de reserva.`
  );
}

export function esConfirmacionCliente(texto) {
  const t = String(texto ?? "").trim();
  return /^(si|sí|ok|dale|confirmo|acepto|me sirve|sirve|perfecto|yes|gener[aá]|reserv[aá]|listo)([\s!.,]|$)/i.test(
    t,
  );
}

export function esRechazoCliente(texto) {
  const t = String(texto ?? "").trim();
  return /^(no|nop|no me sirve|otra|cancelo|imposible)([\s!.,]|$)/i.test(t);
}

/** "1", "opción 2", "la 3" → índice 0-based o null */
export function parseSeleccionOpcion(texto) {
  const t = String(texto ?? "").trim();
  const m = t.match(/^(?:opci[oó]n\s*|la\s*|n[uú]mero\s*|#\s*)?([1-4])\b/i);
  if (!m) return null;
  return Number(m[1]) - 1;
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
  if (datos.hora_retiro) parts.push(`Hora: ${datos.hora_retiro}`);
  return parts.length ? parts.map((p) => `• ${p}`).join("\n") : "";
}

export function mensajeViajeAsignadoCliente(viaje, asignacion) {
  return (
    `✅ *Viaje confirmado*\n\n` +
    `*${viaje.codigo}* · ${viaje.cliente}\n` +
    `${viaje.origen} → ${viaje.destino}\n` +
    (viaje.carga ? `Carga: ${viaje.carga}\n` : "") +
    (asignacion.tipo_unidad ? `Unidad: ${asignacion.tipo_unidad} (${asignacion.capacidad_t} t)\n` : "") +
    (viaje.fecha ? `Retiro: ${viaje.fecha}${asignacion.hora ? ` ${asignacion.hora}` : ""}\n` : "") +
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
    (viaje.fecha ? `Retiro: ${viaje.fecha}${asignacion.hora ? ` ${asignacion.hora}` : ""}\n` : "") +
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

  let hora_retiro = null;
  const horaMatch =
    raw.match(/\b(?:a\s*las?\s*)?(\d{1,2})[:.](\d{2})\b/i) ||
    raw.match(/\b(?:a\s*las?\s*)?(\d{1,2})\s*hs?\b/i) ||
    raw.match(/\ba\s*las?\s*(\d{1,2})\b/i);
  if (horaMatch) {
    const h = Number(horaMatch[1]);
    const min = horaMatch[2] != null ? Number(horaMatch[2]) : 0;
    if (h >= 0 && h <= 23) {
      hora_retiro = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
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
    hora_retiro,
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
  for (const k of ["cliente", "origen", "destino", "tipo_carga", "fecha_retiro", "hora_retiro", "notas", "carga"]) {
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
  "hora_retiro": string|null,
  "carga": string|null,
  "notas": string|null,
  "intent": "dato"|"pregunta"|"cancelar"|"confirmar"|"rechazar"|"otro"
}

Reglas:
- tipo_carga: granos/cereal/soja, frio/carne, general/palets, liquido, arena/piedra, contenedor…
- fecha_retiro: dejá "hoy"/"mañana" o fecha dd/mm; no inventes.
- hora_retiro: "HH:MM" si mencionan hora (8, 8:00, a las 11); si no, null.
- Solo completá campos que el mensaje aporte; el resto null.
- Si confirma ("sí", "me sirve", "dale") intent=confirmar; si rechaza intent=rechazar.
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
      hora_retiro: parsed.hora_retiro ? String(parsed.hora_retiro).trim() : null,
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
