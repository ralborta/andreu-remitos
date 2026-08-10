/**
 * Mensajes, heurísticas y visión WhatsApp — agente POD.
 */

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

export function parecePod(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return false;
  // Evitar confundir con remito / rendición
  if (/\b(remito|gu[ií]a|nafta|peaje|rendici[oó]n|gasto|ticket|factura)\b/i.test(t)) {
    return false;
  }
  return /\b(pod|constancia|entregu[eé]|entregue|entregado|entrega\s+ok|recib[ií]\s*conforme|firma\s+de\s+entrega|prueba\s+de\s+entrega|dej[eé]\s+la\s+carga|descargu[eé])\b/i.test(
    t,
  );
}

/** Frases de intención / saludo — NO son nombre de receptor. */
export function esIntencionOSaludoPod(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  if (!t) return true;
  if (parecePod(t)) return true;
  if (
    /^(hola|buen[oa]s|hey|dale|ok|listo|quiero|necesito|mandar|enviar|hacer)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(quiero|necesito|mandar|enviar|hacer|sacar)\b.*\b(pod|constancia|foto|prueba)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

export function mensajePodSoloChoferes() {
  return (
    `La *constancia de entrega (POD)* es solo para *choferes registrados*.\n\n` +
    `Si necesitás un *viaje/flete* o un *reclamo*, contame y te ayudo.`
  );
}

export function mensajePedirNombreReceptor() {
  return (
    `Recibí la foto pero no pude leer *a quién* le entregaste.\n\n` +
    `Escribime el *nombre de quien recibió* (ej: María López).`
  );
}

export function mensajePedirFotoPod(receptor) {
  const quien = receptor ? ` a *${receptor}*` : "";
  return (
    `Perfecto, vamos con la *constancia de entrega (POD)*${quien}.\n\n` +
    `Mandame una *foto clara* del *formulario de entrega* y/o del *producto entregado* ` +
    `(firma, sello, mercadería en puerta).\n` +
    `La leo yo y cargo los datos.`
  );
}

export function mensajeProcesandoPod() {
  return "📷 Gracias, recibí la foto del POD.\nEstoy *leyendo* el formulario… un momento.";
}

export function mensajeConfirmacionPod(caso, lectura = null) {
  const receptor = caso.receptor_nombre || lectura?.receptor_nombre || "—";
  const pedido = caso.viaje_ref || lectura?.pedido_ref || null;
  const destino = caso.destino || lectura?.destino || null;
  const lineas = [
    `✅ *POD ${caso.codigo || caso.id}* registrado.`,
    ``,
    `Receptor: *${receptor}*`,
  ];
  if (pedido) lineas.push(`Pedido / ref: *${pedido}*`);
  if (destino) lineas.push(`Destino: ${destino}`);
  lineas.push(``);
  lineas.push(`Queda *pendiente* de confirmación en mesa de control.`);
  return lineas.join("\n");
}

export function mensajeDecisionPod(caso) {
  if (caso.estado === "ok") {
    return (
      `✅ Tu *POD ${caso.codigo || caso.id}* fue *confirmado*.\n` +
      (caso.nota_backoffice ? `Nota: ${caso.nota_backoffice}` : "")
    );
  }
  return (
    `❌ Tu *POD ${caso.codigo || caso.id}* fue *rechazado*.\n` +
    (caso.nota_backoffice
      ? `Motivo: ${caso.nota_backoffice}\n`
      : "") +
    `Si querés, enviá de nuevo la foto del formulario.`
  );
}

/** Extrae un nombre razonable del texto del chofer (no intenciones). */
export function extraerNombreReceptor(texto) {
  let t = String(texto ?? "").trim();
  if (!t) return null;
  if (esIntencionOSaludoPod(t)) return null;

  t = t
    .replace(
      /^(entregu[eé]|entregue|entregado|a|al|la|el|se\s+lo\s+di|recib[ií][oó]?|receptor|nombre)\s*[:\-]?\s*/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (t.length < 2 || t.length > 80) return null;
  if (/^\d+$/.test(t)) return null;
  if (parecePod(t)) return null;
  if (esIntencionOSaludoPod(t)) return null;
  // Nombre: letras / espacios / acentos (1–5 palabras)
  if (!/^[\p{L}\s.'-]+$/u.test(t)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return null;
  return t;
}

/**
 * Visión: lee formulario POD / constancia de entrega.
 * @returns {Promise<{
 *   receptor_nombre: string|null,
 *   pedido_ref: string|null,
 *   destino: string|null,
 *   chofer_documento: string|null,
 *   resumen: string|null,
 *   confianza: number,
 *   fuente: string
 * }|null>}
 */
export async function leerPodDesdeImagen({ imageBuffer, mime, texto, log } = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !imageBuffer?.length) return null;

  const model =
    process.env.OPENAI_POD_MODEL?.trim() ||
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const imageBase64 = Buffer.from(imageBuffer).toString("base64");
  const system =
    "Sos el agente POD (Proof of Delivery) de una logística argentina (TransitOne / SOL). " +
    "Leés fotos de constancias/formularios de entrega y/o mercadería entregada. " +
    "Respondé SOLO JSON válido.";

  const userText = `Analizá esta foto de constancia de entrega (POD) o evidencia de entrega.

Extraé:
- receptor_nombre: quien recibió (destinatario / firma)
- pedido_ref: nº de pedido, tracking, PE-…, ECO-…, guía
- destino: dirección o ciudad de entrega
- chofer_documento: repartidor/chofer si figura en el papel (no inventes)
- resumen: 1 línea de lo que ves (producto, estado entrega, firma, etc.)

Texto del chofer (si hay):
"""
${texto || "(sin texto)"}
"""

JSON:
{
  "receptor_nombre": string|null,
  "pedido_ref": string|null,
  "destino": string|null,
  "chofer_documento": string|null,
  "resumen": string|null,
  "confianza": number
}`;

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
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mime || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.POD_IA_TIMEOUT_MS) || 28000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const ia = extraerJson(data.choices?.[0]?.message?.content ?? "");
    if (!ia) return null;
    return {
      receptor_nombre: ia.receptor_nombre
        ? String(ia.receptor_nombre).trim()
        : null,
      pedido_ref: ia.pedido_ref ? String(ia.pedido_ref).trim() : null,
      destino: ia.destino ? String(ia.destino).trim() : null,
      chofer_documento: ia.chofer_documento
        ? String(ia.chofer_documento).trim()
        : null,
      resumen: ia.resumen ? String(ia.resumen).trim() : null,
      confianza: Number(ia.confianza) || 0.7,
      fuente: "ia",
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "POD visión falló");
    return null;
  }
}
