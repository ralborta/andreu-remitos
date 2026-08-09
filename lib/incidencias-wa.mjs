/**
 * WhatsApp — incidencias en ruta (choferes).
 */
import {
  INCIDENCIA_TIPOS,
  INCIDENCIA_CRITICIDADES,
  labelTipo,
  labelCriticidad,
  codigoVisible,
  normalizeTipo,
  normalizeCriticidad,
} from "./incidencias.mjs";

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

/** Heurística: ¿el chofer está reportando una incidencia en ruta? */
export function pareceIncidenciaEnRuta(texto) {
  const t = String(texto ?? "").toLowerCase().trim();
  if (!t) return false;
  // Gastos / remitos no son incidencia
  if (
    /\b(rendici[oó]n|nafta|peaje|comprobante|factura|ticket\s*de\s*gasto|remito|gu[ií]a)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return (
    /\b(incidencia|incidente)\b/i.test(t) ||
    /\b(pinchazo|pinch[eé]|llanta|goma\s*pinchada|neum[aá]tico)\b/i.test(t) ||
    /\b(me\s*fren[oó]|polic[ií]a|control\s*(de\s*)?(ruta|alcoholemia)|reten)\b/i.test(t) ||
    /\b(accidente|choque|vuelco|colisi[oó]n)\b/i.test(t) ||
    /\b(se\s*me\s*par[oó]|no\s*arranca|problema\s*mec[aá]nico|aver[ií]a\s*(del\s*)?(camion|camión|unidad))\b/i.test(
      t,
    ) ||
    /\b(desv[ií]o|me\s*desvi[eé]|ruta\s*cortada)\b/i.test(t) ||
    /\b(estoy\s*parado|parada\s*no\s*prevista|demora\s*(en\s*)?ruta|trancado|atasco)\b/i.test(t) ||
    /\b(tuve\s+un|tengo\s+un)\s+(problema|incidente|pinchazo|accidente)\b/i.test(t)
  );
}

export function mensajePedirCausaIncidencia({ tipoHint, viajeRef, proactivo = false } = {}) {
  const tipoTxt = tipoHint ? labelTipo(tipoHint) : null;
  if (proactivo) {
    return (
      `Hola 👋 Detectamos un evento en tu viaje` +
      (viajeRef && viajeRef !== "—" ? ` (*${viajeRef}*)` : "") +
      (tipoTxt ? ` — posible *${tipoTxt}*` : "") +
      `.\n\n` +
      `¿Qué pasó? Contame la causa en un mensaje (ej: tránsito, pinchazo, control, desvío…).\n` +
      `Queda registrado como *incidencia* para operaciones.`
    );
  }
  return (
    `Entendido. Para abrir la *incidencia*, ¿me contás qué pasó?\n\n` +
    `Ejemplos: pinchazo, demora por tránsito, control policial, problema mecánico, desvío…`
  );
}

export function mensajeConfirmacionIncidencia(row) {
  const codigo = codigoVisible(row);
  const tipo = row.tipo ? labelTipo(row.tipo) : "Incidencia";
  const crit = row.criticidad ? labelCriticidad(row.criticidad) : "Media";
  return (
    `Listo ✅ Registré la incidencia *${codigo}*.\n\n` +
    `• Tipo: *${tipo}*\n` +
    `• Criticidad: *${crit}*\n` +
    (row.causa ? `• Causa: ${row.causa}\n` : "") +
    `\nOperaciones ya la ve en el panel. Si cambia algo, avisame.`
  );
}

export function mensajeDecisionIncidencia(row) {
  const codigo = codigoVisible(row);
  if (row.estado === "en_gestion") {
    return `Tu incidencia *${codigo}* está *en gestión*. Te vamos a ir avisando.`;
  }
  if (row.estado === "resuelta") {
    return (
      `Tu incidencia *${codigo}* quedó *resuelta*.\n` +
      (row.nota_interna ? `\nNota: ${row.nota_interna}` : "")
    );
  }
  return null;
}

function clasificarHeuristica(texto) {
  const tipo = normalizeTipo(texto);
  const criticidad = normalizeCriticidad(null, tipo);
  const causa = String(texto || "").trim().slice(0, 280) || null;
  return {
    tipo,
    criticidad,
    causa,
    viaje_ref: null,
    resumen: causa,
    confianza: tipo === "otro" ? 0.45 : 0.75,
    fuente: "heuristica",
  };
}

async function callOpenAiIncidencia(prompt, log) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_INCIDENCIAS_MODEL?.trim() ||
    process.env.OPENAI_WA_ROUTER_MODEL?.trim() ||
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
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Clasificás incidencias de choferes de logística argentina. Respondé SOLO JSON válido.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.INCIDENCIAS_IA_TIMEOUT_MS) || 15000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "Incidencias IA falló");
    return null;
  }
}

/**
 * Interpreta texto del chofer → tipo, criticidad, causa.
 */
export async function interpretarIncidenciaWhatsApp({ texto, log } = {}) {
  const t = String(texto ?? "").trim();
  const fallback = () => clasificarHeuristica(t);

  if (!t) {
    return {
      tipo: "otro",
      criticidad: "media",
      causa: null,
      viaje_ref: null,
      resumen: null,
      confianza: 0.2,
      fuente: "vacio",
    };
  }

  if (!process.env.OPENAI_API_KEY?.trim()) return fallback();

  const prompt = `Clasificá esta incidencia en ruta reportada por un chofer (Argentina).

Mensaje:
"""
${t}
"""

Tipos válidos: ${INCIDENCIA_TIPOS.join(" | ")}
Criticidades: ${INCIDENCIA_CRITICIDADES.join(" | ")}

Reglas:
- accidente / choque → accidente + alta
- pinchazo / llanta → pinchazo
- no arranca / motor / mecánico → mecanico + alta
- policía / control / reten → control
- desvío / ruta cortada → desvio_ruta
- parado / espera / tránsito / demora en ruta → demora o parada_no_prevista
- causa: frase corta en español del chofer (sin inventar de más)
- viaje_ref: solo si menciona un código de viaje (VJ-…); si no, null

JSON:
{
  "tipo": "...",
  "criticidad": "alta"|"media"|"baja",
  "causa": string|null,
  "viaje_ref": string|null,
  "resumen": string|null,
  "confianza": 0.0-1.0
}`;

  const parsed = await callOpenAiIncidencia(prompt, log);
  if (!parsed) return fallback();

  const tipo = normalizeTipo(parsed.tipo);
  return {
    tipo,
    criticidad: normalizeCriticidad(parsed.criticidad, tipo),
    causa: parsed.causa ? String(parsed.causa).trim().slice(0, 280) : t.slice(0, 280),
    viaje_ref: parsed.viaje_ref ? String(parsed.viaje_ref).trim() : null,
    resumen: parsed.resumen ? String(parsed.resumen).trim().slice(0, 200) : null,
    confianza: Number(parsed.confianza) || 0.8,
    fuente: "ia",
  };
}
