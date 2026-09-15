/**
 * Hoja de ruta (Andreu) — extracción parcial para anclar peajes al viaje.
 * No reemplaza la confirmación humana del Nº Delfos.
 */
import { getRendicionRules } from "./rendicion-rules.mjs";

export function pareceHojaRuta(texto) {
  const t = String(texto ?? "").toLowerCase();
  return /\b(hoja\s*de\s*ruta|hoja\s*ruta|hdr|fin\s*de\s*viaje|rindi[oó]\s*viaje|cierro\s*viaje)\b/i.test(
    t,
  );
}

export function hojaRutaHabilitada() {
  // Feature Andreu; SOL puede activarla con PRODUCT_PROFILE=andreu o flag futuro.
  return getRendicionRules().productId === "andreu";
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

export function mensajePedirFotoHojaRuta() {
  return (
    `Dale ✅ Mandame la *foto de la hoja de ruta* (legible, completa si podés).\n\n` +
    `Voy a leer el *Nº de viaje*, chofer, patente y anticipo para ayudar a la mesa.\n` +
    `Los *tickets de peaje* seguí mandándolos aparte.`
  );
}

export function mensajeConfirmacionHojaRuta(row) {
  const viaje = row.nro_viaje_delfos || "a confirmar en mesa";
  const ant =
    row.anticipo_monto != null
      ? ` · anticipo ~$${Number(row.anticipo_monto).toLocaleString("es-AR")}`
      : "";
  return (
    `Listo ✅ Recibí tu *hoja de ruta*.\n` +
    `Viaje leído: *${viaje}*${ant}.\n\n` +
    `Código *${row.codigo}*. La mesa lo revisa; no reemplaza la confirmación del Nº Delfos.\n` +
    `Si tenés peajes, mandá las *fotos de los tickets*.`
  );
}

/**
 * Interpreta foto/OCR de hoja de ruta (campos parciales).
 */
export async function interpretarHojaRuta({
  texto,
  imageBuffer,
  mime,
  ocrTexto = null,
  log,
} = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const heur = {
    nro_viaje_delfos: null,
    chofer_nombre: null,
    patente: null,
    patente_semi: null,
    fecha_salida: null,
    fecha_llegada: null,
    anticipo_monto: null,
    peajes: [],
    fuente: "heuristica",
  };

  // Heurística rápida sobre OCR/texto
  const blob = `${texto || ""}\n${ocrTexto || ""}`;
  const viajeM =
    blob.match(/n[ºo°]?\s*viaje\s*[:\-]?\s*(\d{4,8})/i) ||
    blob.match(/\bviaje\s*[:\-]?\s*(\d{5,8})\b/i);
  if (viajeM) heur.nro_viaje_delfos = viajeM[1];
  const antM =
    blob.match(/anticipo[^\d]{0,20}(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?)/i) ||
    blob.match(/\$\s*(\d{1,3}(?:[.\s]\d{3})+)/);
  if (antM) {
    const n = Number(String(antM[1]).replace(/\./g, "").replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) heur.anticipo_monto = n;
  }

  if (!apiKey) return { ...heur, texto_ocr: ocrTexto || null };

  const model =
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const system =
    "Sos un extractor de hojas de ruta de transporte argentina (Andreu). " +
    "Respondé SOLO JSON válido. Priorizá Nº de viaje, chofer, patentes, fechas y anticipo. " +
    "No inventes números: si no se lee, null.";

  const userText = `Extraé datos parciales de esta hoja de ruta.

Campos:
- nro_viaje_delfos: número de viaje (el de cabecera, ej 605095). NO uses nros de remito ni tickets.
- chofer_nombre
- patente (tractor), patente_semi
- fecha_salida, fecha_llegada (YYYY-MM-DD si podés)
- anticipo_monto (número)
- peajes: hasta 15 items { "detalle": string, "importe": number|null }
- confianza: 0..1

Texto libre del chofer:
"""
${texto || "(sin texto)"}
"""

${ocrTexto ? `TEXTO_OCR:\n"""\n${String(ocrTexto).slice(0, 8000)}\n"""` : ""}

JSON:
{
  "nro_viaje_delfos": string|null,
  "chofer_nombre": string|null,
  "patente": string|null,
  "patente_semi": string|null,
  "fecha_salida": string|null,
  "fecha_llegada": string|null,
  "anticipo_monto": number|null,
  "peajes": [{"detalle": string, "importe": number|null}],
  "confianza": number
}`;

  let imageBase64 = null;
  if (imageBuffer?.length) {
    imageBase64 = Buffer.from(imageBuffer).toString("base64");
  }
  const content = imageBase64
    ? [
        { type: "text", text: userText },
        {
          type: "image_url",
          image_url: { url: `data:${mime || "image/jpeg"};base64,${imageBase64}` },
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
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.RENDICION_IA_TIMEOUT_MS) || 30000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const ia = extraerJson(data.choices?.[0]?.message?.content ?? "");
    if (!ia) return { ...heur, texto_ocr: ocrTexto || null };

    const peajes = Array.isArray(ia.peajes)
      ? ia.peajes
          .slice(0, 15)
          .map((p) => ({
            detalle: p?.detalle ? String(p.detalle).trim() : null,
            importe:
              p?.importe != null && Number.isFinite(Number(p.importe))
                ? Number(p.importe)
                : null,
          }))
          .filter((p) => p.detalle || p.importe != null)
      : [];

    return {
      nro_viaje_delfos:
        (ia.nro_viaje_delfos && String(ia.nro_viaje_delfos).trim()) ||
        heur.nro_viaje_delfos,
      chofer_nombre: ia.chofer_nombre ? String(ia.chofer_nombre).trim() : null,
      patente: ia.patente ? String(ia.patente).trim() : null,
      patente_semi: ia.patente_semi ? String(ia.patente_semi).trim() : null,
      fecha_salida: ia.fecha_salida || null,
      fecha_llegada: ia.fecha_llegada || null,
      anticipo_monto:
        ia.anticipo_monto != null && Number.isFinite(Number(ia.anticipo_monto))
          ? Number(ia.anticipo_monto)
          : heur.anticipo_monto,
      peajes,
      confianza: Number(ia.confianza) || 0.6,
      fuente: "ia",
      texto_ocr: ocrTexto || null,
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "Hoja de ruta IA falló");
    return { ...heur, texto_ocr: ocrTexto || null };
  }
}
