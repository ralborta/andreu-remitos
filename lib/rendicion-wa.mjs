/**
 * Agente WhatsApp de Rendición de gastos (SOL).
 * Lee texto/foto → clasifica → deja pendiente de aprobación humana.
 */
import {
  labelCategoria,
  moneyAR,
  RENDICION_CATEGORIAS,
} from "./rendicion.mjs";

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

function heuristicaGasto(texto) {
  const t = String(texto ?? "").toLowerCase();
  let categoria = "otro";
  if (/nafta|combustible|gasoil|diesel|ypf|shell|axion|puma/.test(t)) categoria = "combustible";
  else if (/peaje|telepase|autopista/.test(t)) categoria = "peaje";
  else if (/llanta|cubierta|neum[aá]tico/.test(t)) categoria = "llantas";
  else if (/aceite|lubricante/.test(t)) categoria = "aceite";
  else if (/remolque|gr[uú]a/.test(t)) categoria = "remolque";
  else if (/auxilio|mec[aá]nico|auxilio\s*mec/.test(t)) categoria = "auxilio_mecanico";
  else if (/arreglo|reparaci[oó]n|taller|mecanica|mecánica/.test(t)) categoria = "arreglo_menor";

  const montoMatch =
    t.match(/\$\s*([\d.]+(?:,\d{2})?)/) ||
    t.match(/\b([\d.]+(?:,\d{2})?)\s*(?:pesos|ars)?\b/);
  let monto = null;
  if (montoMatch) {
    const raw = montoMatch[1].replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) monto = n;
  }

  return {
    categoria,
    monto,
    proveedor: null,
    fecha_comprobante: null,
    descripcion: String(texto ?? "").trim().slice(0, 200) || null,
    mensaje: null,
    fuente: "heuristica",
  };
}

async function callOpenAiVisionOrText({ texto, imageBase64, mime, log }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const cats = RENDICION_CATEGORIAS.join("|");
  const system =
    "Sos el agente de Rendición de gastos de una logística argentina (SOL). " +
    "Clasificás comprobantes menores del chofer. Respondé SOLO JSON válido.";

  const userText = `Analizá el gasto/comprobante del chofer.

Categorías válidas: ${cats}
- combustible: nafta/gasoil
- peaje
- arreglo_menor: arreglos chicos del vehículo
- llantas, aceite
- remolque, auxilio_mecanico
- otro

Reglas:
- Son gastos MENORES del viaje.
- Extraé monto numérico si aparece.
- mensaje: respuesta corta rioplatense confirmando lo leído y avisando que queda pendiente de aprobación humana.

Texto del chofer (si hay):
"""
${texto || "(sin texto)"}
"""

JSON:
{
  "categoria": "${cats}",
  "monto": number|null,
  "proveedor": string|null,
  "fecha_comprobante": string|null,
  "descripcion": string|null,
  "mensaje": string,
  "confianza": number
}`;

  const content = imageBase64
    ? [
        { type: "text", text: userText },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime || "image/jpeg"};base64,${imageBase64}`,
          },
        },
      ]
    : userText;

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
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.RENDICION_IA_TIMEOUT_MS) || 25000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "Rendición IA falló");
    return null;
  }
}

export async function interpretarGastoWhatsApp({
  texto,
  imageBuffer,
  mime,
  log,
} = {}) {
  const heur = heuristicaGasto(texto);
  let imageBase64 = null;
  if (imageBuffer?.length) {
    imageBase64 = Buffer.from(imageBuffer).toString("base64");
  }

  const ia = await callOpenAiVisionOrText({
    texto,
    imageBase64,
    mime,
    log,
  });

  if (!ia) return heur;

  let categoria = String(ia.categoria || heur.categoria || "otro")
    .toLowerCase()
    .trim();
  if (!RENDICION_CATEGORIAS.includes(categoria)) categoria = heur.categoria || "otro";

  const monto =
    ia.monto != null && Number.isFinite(Number(ia.monto))
      ? Number(ia.monto)
      : heur.monto;

  return {
    categoria,
    monto,
    proveedor: ia.proveedor ? String(ia.proveedor).trim() : null,
    fecha_comprobante: ia.fecha_comprobante || null,
    descripcion: ia.descripcion || heur.descripcion,
    mensaje: ia.mensaje ? String(ia.mensaje).trim() : null,
    fuente: "ia",
    confianza: Number(ia.confianza) || 0.7,
  };
}

export function mensajeConfirmacionGasto(gasto, interpretacion) {
  if (interpretacion?.mensaje) return interpretacion.mensaje;
  const cat = labelCategoria(gasto.categoria);
  const monto = gasto.monto != null ? moneyAR(gasto.monto) : "monto a confirmar";
  return (
    `Listo ✅ Registré tu gasto *${cat}* (${monto})` +
    (gasto.proveedor ? ` · ${gasto.proveedor}` : "") +
    `.\n\nCódigo *${gasto.codigo}*. Queda *pendiente de aprobación* del backoffice.`
  );
}

export function mensajeDecisionGasto(gasto) {
  const cat = labelCategoria(gasto.categoria);
  const monto = gasto.monto != null ? moneyAR(gasto.monto) : "";
  if (gasto.estado === "aprobado") {
    return (
      `✅ Tu gasto *${gasto.codigo}* (${cat}${monto ? ` ${monto}` : ""}) fue *aprobado*.` +
      (gasto.nota_aprobacion ? `\nNota: ${gasto.nota_aprobacion}` : "")
    );
  }
  if (gasto.estado === "rechazado") {
    return (
      `❌ Tu gasto *${gasto.codigo}* (${cat}) fue *rechazado*.` +
      (gasto.nota_aprobacion ? `\nMotivo: ${gasto.nota_aprobacion}` : "") +
      `\nSi querés, mandá otro comprobante o pedí a tráfico.`
    );
  }
  return null;
}

/** ¿Parece gasto / rendición? (solo emergencia sin IA) */
export function pareceRendicionGasto(texto) {
  const t = String(texto ?? "").toLowerCase();
  return /\b(rendici[oó]n|gasto|nafta|combustible|peaje|ticket|factura|comprobante|llanta|aceite|remolque|auxilio|taller|arreglo)\b/i.test(
    t,
  );
}
