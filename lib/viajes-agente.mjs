/**
 * Agente IA de Gestión de Viajes (WhatsApp).
 * El diálogo lo genera el LLM; la flota/consulta son hechos que NO puede inventar.
 */
import { pareceSolicitudViaje } from "./viajes-solicitud.mjs";

const CAMPOS_REQUERIDOS = ["origen", "destino", "toneladas", "tipo_carga", "fecha_retiro"];

const LABELS = {
  origen: "origen",
  destino: "destino",
  toneladas: "toneladas",
  tipo_carga: "tipo de carga",
  fecha_retiro: "fecha de retiro",
  hora_retiro: "horario",
  cliente: "cliente",
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

function mergeDatos(pendingDatos = {}, patch = {}, { remitente } = {}) {
  const merged = { ...pendingDatos };
  for (const k of [
    "cliente",
    "origen",
    "destino",
    "tipo_carga",
    "fecha_retiro",
    "hora_retiro",
    "notas",
    "carga",
  ]) {
    if (patch[k] != null && patch[k] !== "") merged[k] = patch[k];
  }
  if (patch.toneladas != null && Number.isFinite(Number(patch.toneladas))) {
    merged.toneladas = Number(patch.toneladas);
  }
  if (!merged.carga && (merged.tipo_carga || merged.toneladas)) {
    merged.carga = [merged.tipo_carga, merged.toneladas != null ? `${merged.toneladas} t` : null]
      .filter(Boolean)
      .join(" ");
  }
  if (!merged.cliente) merged.cliente = remitente || pendingDatos.cliente || "Cliente WhatsApp";
  return merged;
}

function resumenOpciones(consulta) {
  if (!consulta?.propuesta) return [];
  const opts = [consulta.propuesta, ...(consulta.alternativas ?? [])].slice(0, 4);
  return opts.map((s, i) => ({
    n: i + 1,
    fecha: s.fecha,
    hora: s.hora,
    unidad: s.tipo_unidad,
    capacidad_t: s.capacidad_t,
    motivo: s.motivo || null,
  }));
}

/**
 * Turno del agente: entiende + responde en lenguaje humano.
 * @returns {{
 *   datos: object,
 *   faltan: string[],
 *   intent: string,
 *   seleccion: number|null,
 *   accion: 'pedir_datos'|'consultar'|'reservar'|'rechazar'|'chitchat'|'esperar',
 *   mensaje: string,
 *   fuente: string,
 * }}
 */
export async function turnoAgenteViajes({
  texto,
  fase = "recolectando",
  datos = {},
  consulta = null,
  propuesta = null,
  viaje = null,
  asignacion = null,
  remitente = null,
  log = null,
} = {}) {
  const faltanPrevios = camposFaltantes(datos);
  const ia = await callAgenteJson({
    texto,
    fase,
    datos,
    faltan: faltanPrevios,
    consulta,
    propuesta,
    viaje,
    asignacion,
    remitente,
    log,
  });

  if (ia) {
    const merged = mergeDatos(datos, ia.datos_patch || {}, { remitente });
    const faltan = camposFaltantes(merged);
    let accion = String(ia.accion || "").trim().toLowerCase();
    const intent = String(ia.intent || "dato").trim().toLowerCase();

    // Guardrails de negocio: no inventar acciones
    if (fase === "propuesta" && (intent === "confirmar" || accion === "reservar")) {
      accion = "reservar";
    } else if (fase === "propuesta" && (intent === "rechazar" || accion === "rechazar")) {
      accion = "rechazar";
    } else if (fase === "propuesta" && ia.seleccion != null) {
      accion = "reservar";
    } else if (!faltan.length && (accion === "consultar" || accion === "pedir_datos" || fase === "recolectando")) {
      if (intent === "confirmar" && propuesta?.elegida) accion = "reservar";
      else if (fase !== "propuesta") accion = "consultar";
    } else if (faltan.length) {
      accion = "pedir_datos";
    }

    const mensaje =
      String(ia.mensaje || "").trim() ||
      fallbackMensaje({ fase, datos: merged, faltan, consulta, viaje, asignacion });

    return {
      datos: merged,
      faltan,
      intent,
      seleccion: ia.seleccion != null && Number.isFinite(Number(ia.seleccion)) ? Number(ia.seleccion) : null,
      accion,
      mensaje,
      fuente: ia.motor || "ia",
    };
  }

  // Fallback sin IA: heurística + plantilla (solo emergencia)
  const heur = parseSolicitudHeuristica(texto, { remitente });
  const merged = mergeDatos(datos, heur, { remitente });
  const faltan = camposFaltantes(merged);
  let accion = "pedir_datos";
  let intent = "dato";
  let seleccion = parseSeleccionOpcion(texto);

  if (fase === "propuesta") {
    if (seleccion != null) {
      accion = "reservar";
      intent = "seleccion";
    } else if (esConfirmacionCliente(texto)) {
      accion = "reservar";
      intent = "confirmar";
    } else if (esRechazoCliente(texto)) {
      accion = "rechazar";
      intent = "rechazar";
    } else {
      accion = "esperar";
    }
  } else if (!faltan.length) {
    accion = "consultar";
  }

  return {
    datos: merged,
    faltan,
    intent,
    seleccion,
    accion,
    mensaje: fallbackMensaje({ fase, datos: merged, faltan, consulta, viaje, asignacion }),
    fuente: "heuristica",
  };
}

async function callAgenteJson({
  texto,
  fase,
  datos,
  faltan,
  consulta,
  propuesta,
  viaje,
  asignacion,
  remitente,
  log,
}) {
  if (!iaHabilitada()) return null;

  const hechosConsulta = consulta
    ? {
        pedida: consulta.pedida,
        exacta_ok: consulta.exacta_ok,
        sin_cupo: !consulta.ok,
        error: consulta.error || null,
        opciones: resumenOpciones(consulta),
      }
    : null;

  const prompt = `Sos el agente de operaciones de *Gestión de Viajes* de una logística argentina.
Atendés por WhatsApp. Sos una PERSONA: natural, clara, cálida y profesional. Nunca parecés un bot de menú.

REGLAS DURAS:
- NUNCA inventes disponibilidad, camiones, choferes, horarios, precios ni datos de flota.
- Solo podés hablar de disponibilidad usando HECHOS_CONSULTA (si vienen).
- No pidas datos que ya estén en DATOS_ACTUALES.
- No armes listas robóticas tipo "necesito: 1) 2) 3)". Pedí lo faltante de forma conversacional.
- Español rioplatense, mensajes cortos (WhatsApp). Podés usar *negritas* con moderación.
- Si falta info, pedí lo esencial. Si está completa, avisá que vas a consultar disponibilidad.
- Si hay opciones, explicalas humanas y pedí confirmación para generar la gestión de reserva.
- Si el cliente confirma (sí / me sirve / dale / opción N), accion=reservar.
- Si rechaza, accion=rechazar y pedí otra fecha/hora con naturalidad.

FASE: ${fase}
REMITENTE: ${remitente || "cliente"}
DATOS_ACTUALES: ${JSON.stringify(datos ?? {})}
FALTAN: ${JSON.stringify(faltan ?? [])}
PROPUESTA_ACTIVA: ${JSON.stringify(propuesta ? { elegida: propuesta.elegida, opciones: (propuesta.opciones || []).map((o, i) => ({ n: i + 1, fecha: o.fecha, hora: o.hora })) } : null)}
HECHOS_CONSULTA: ${JSON.stringify(hechosConsulta)}
VIAJE_RESERVADO: ${JSON.stringify(viaje ? { codigo: viaje.codigo, origen: viaje.origen, destino: viaje.destino, fecha: viaje.fecha, chofer: viaje.chofer, tractor: viaje.tractor } : null)}
ASIGNACION: ${JSON.stringify(asignacion ? { hora: asignacion.hora, tipo_unidad: asignacion.tipo_unidad, capacidad_t: asignacion.capacidad_t } : null)}

MENSAJE_DEL_CLIENTE:
"""
${texto}
"""

Devolvé SOLO JSON:
{
  "datos_patch": {
    "cliente": string|null,
    "origen": string|null,
    "destino": string|null,
    "toneladas": number|null,
    "tipo_carga": string|null,
    "fecha_retiro": string|null,
    "hora_retiro": string|null,
    "carga": string|null,
    "notas": string|null
  },
  "intent": "dato"|"pregunta"|"confirmar"|"rechazar"|"seleccion"|"cancelar"|"chitchat",
  "seleccion": number|null,
  "accion": "pedir_datos"|"consultar"|"reservar"|"rechazar"|"chitchat"|"esperar",
  "mensaje": string,
  "confianza": number
}

datos_patch: SOLO campos que el mensaje aporte con claridad. Si dudás, null (no adivines).
seleccion: 1..4 si eligió una opción numerada; si no, null.
mensaje: lo que vas a enviar por WhatsApp (humano, sin JSON, sin mencionar que sos IA).`;

  try {
    const parsed = await callLlmJson(prompt, { log, temperature: 0.45, maxTokens: 700 });
    if (!parsed) return null;
    const patch = parsed.datos_patch && typeof parsed.datos_patch === "object" ? parsed.datos_patch : {};
    return {
      datos_patch: {
        cliente: patch.cliente ? String(patch.cliente).trim() : null,
        origen: patch.origen ? String(patch.origen).trim() : null,
        destino: patch.destino ? String(patch.destino).trim() : null,
        toneladas: patch.toneladas != null ? Number(patch.toneladas) : null,
        tipo_carga: patch.tipo_carga ? String(patch.tipo_carga).trim().toLowerCase() : null,
        fecha_retiro: patch.fecha_retiro ? String(patch.fecha_retiro).trim() : null,
        hora_retiro: patch.hora_retiro ? String(patch.hora_retiro).trim() : null,
        carga: patch.carga ? String(patch.carga).trim() : null,
        notas: patch.notas ? String(patch.notas).trim() : null,
      },
      intent: parsed.intent || "dato",
      seleccion: parsed.seleccion != null ? Number(parsed.seleccion) : null,
      accion: parsed.accion || "pedir_datos",
      mensaje: parsed.mensaje ? String(parsed.mensaje).trim() : "",
      motor: "ia",
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "Agente viajes falló");
    return null;
  }
}

/** Mensaje IA post-consulta (hechos reales). */
export async function redactarPropuestaDisponibilidad({
  datos,
  consulta,
  remitente,
  log,
} = {}) {
  const turno = await turnoAgenteViajes({
    texto: "(sistema: ya consultaste la flota; redactá el resultado al cliente y pedí confirmación para la reserva)",
    fase: "propuesta",
    datos,
    consulta,
    remitente,
    log,
  });
  return turno.mensaje || fallbackMensaje({ fase: "propuesta", datos, consulta });
}

export async function redactarReservaConfirmada({ viaje, asignacion, remitente, log } = {}) {
  const turno = await turnoAgenteViajes({
    texto: "(sistema: la reserva quedó generada; avisá al cliente con calidez y decí que le pedís confirmación al chofer)",
    fase: "reservado",
    datos: {
      origen: viaje?.origen,
      destino: viaje?.destino,
      tipo_carga: viaje?.carga,
    },
    viaje,
    asignacion,
    remitente,
    log,
  });
  return turno.mensaje || fallbackMensaje({ fase: "reservado", viaje, asignacion });
}

export async function redactarMensajeChofer({ viaje, asignacion, log } = {}) {
  const turno = await turnoAgenteViajes({
    texto: "(sistema: avisá al chofer del viaje asignado y pedile SÍ/NO para confirmar)",
    fase: "chofer",
    viaje,
    asignacion,
    remitente: viaje?.chofer,
    log,
  });
  return turno.mensaje || fallbackMensaje({ fase: "chofer", viaje, asignacion });
}

function fallbackMensaje({ fase, datos = {}, faltan = [], consulta = null, viaje = null, asignacion = null } = {}) {
  if (fase === "reservado" && viaje) {
    return (
      `Listo, generé la reserva *${viaje.codigo}*: ${viaje.origen} → ${viaje.destino}` +
      (asignacion?.hora ? ` a las ${asignacion.hora}` : "") +
      `. Ya le aviso al chofer para que confirme.`
    );
  }
  if (fase === "chofer" && viaje) {
    return (
      `Hola, tenés un viaje *${viaje.codigo}*: ${viaje.origen} → ${viaje.destino}. ` +
      `¿Podés confirmarlo? Respondé *SÍ* o *NO*.`
    );
  }
  if (fase === "propuesta" || consulta) {
    return mensajePropuestaReserva(consulta || { propuesta: null, pedida: {} }, datos);
  }
  if (faltan?.length) {
    return mensajePedirDatos(faltan, { datos, primera: true });
  }
  return "Dale, dejame consultar la disponibilidad y te digo.";
}

/** Compat: plantillas solo como respaldo si cae la IA. */
export function mensajePedirDatos(faltan, { datos = {}, primera = false } = {}) {
  const lista = faltan.map((k) => LABELS[k] ?? k).join(", ");
  if (primera) {
    return `Hola, soy de Gestión de Viajes. Para armarte el transporte necesito: ${lista}. ¿Me los pasás?`;
  }
  return `Me falta todavía: ${lista}. ¿Me lo completás?`;
}

export function mensajeConsultandoDisponibilidad(datos = {}) {
  const cuando = [datos.fecha_retiro, datos.hora_retiro].filter(Boolean).join(" ");
  return `Perfecto, dejame consultar la disponibilidad${cuando ? ` para ${cuando}` : ""}…`;
}

function formatearFechaCorta(fechaIso) {
  if (!fechaIso) return "";
  const [y, m, d] = String(fechaIso).split("-");
  if (!d) return fechaIso;
  return `${d}/${m}`;
}

export function mensajePropuestaReserva(consulta, datos = {}) {
  const pedida = consulta?.pedida ?? {};
  const prop = consulta?.propuesta;
  if (!prop) {
    return `Consulté y no tengo cupo${pedida.fecha ? ` para ${formatearFechaCorta(pedida.fecha)}` : ""}${pedida.hora ? ` a las ${pedida.hora}` : ""}. ¿Probamos otra fecha u horario?`;
  }
  if (consulta.exacta_ok) {
    return (
      `Tengo disponible el ${formatearFechaCorta(prop.fecha)} a las ${prop.hora} ` +
      `(${prop.tipo_unidad}, ${prop.capacidad_t}t) para ${datos.origen} → ${datos.destino}. ` +
      `¿Te sirve? Si me confirmás genero la gestión de reserva.`
    );
  }
  const alts = [prop, ...(consulta.alternativas ?? [])].slice(0, 4);
  const lista = alts
    .map((s, i) => `${i + 1}) ${formatearFechaCorta(s.fecha)} ${s.hora}`)
    .join("; ");
  return (
    `Para lo que pediste no tengo el cupo exacto, pero sí: ${lista}. ` +
    `¿Cuál te sirve? Decime el número o “sí” (tomo la 1) y genero la reserva.`
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

export function parseSeleccionOpcion(texto) {
  const t = String(texto ?? "").trim();
  const m = t.match(/^(?:opci[oó]n\s*|la\s*|n[uú]mero\s*|#\s*)?([1-4])\b/i);
  if (!m) return null;
  return Number(m[1]) - 1;
}

export function mensajeViajeAsignadoCliente(viaje, asignacion) {
  return fallbackMensaje({ fase: "reservado", viaje, asignacion });
}

export function mensajeViajeAsignadoChofer(viaje, asignacion) {
  return fallbackMensaje({ fase: "chofer", viaje, asignacion });
}

export function esConfirmacionChofer(texto) {
  return /^(si|sí|ok|dale|confirmo|acepto|voy|listo|perfecto|yes)[\s!.]*$/i.test(
    String(texto ?? "").trim(),
  );
}

export function esRechazoChofer(texto) {
  return /^(no|nop|no puedo|rechazo|cancelo|imposible)[\s!.]*$/i.test(String(texto ?? "").trim());
}

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

  return {
    cliente: remitente || null,
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

/** Compat API ingest */
export async function interpretarMensajeViaje(texto, { pendingDatos = {}, remitente, log } = {}) {
  const turno = await turnoAgenteViajes({
    texto,
    fase: "recolectando",
    datos: pendingDatos,
    remitente,
    log,
  });
  return {
    datos: turno.datos,
    faltan: turno.faltan,
    fuente: turno.fuente,
    intent: turno.intent,
    mensaje: turno.mensaje,
    parece_solicitud:
      pareceSolicitudViaje(texto) || Boolean(pendingDatos.origen || pendingDatos.destino),
  };
}

async function callLlmJson(prompt, { log, temperature = 0.2, maxTokens = 700 } = {}) {
  const openai = await callOpenAi(prompt, { log, temperature, maxTokens });
  if (openai) return openai;
  return callGemini(prompt, { log, temperature, maxTokens });
}

async function callOpenAi(prompt, { log, temperature, maxTokens } = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
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
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sos un agente logístico humano por WhatsApp. Respondé SOLO JSON válido, sin markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.VIAJES_IA_TIMEOUT_MS) || 20000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "OpenAI viajes falló");
    return null;
  }
}

async function callGemini(prompt, { log, temperature, maxTokens } = {}) {
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
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.VIAJES_IA_TIMEOUT_MS) || 20000),
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
