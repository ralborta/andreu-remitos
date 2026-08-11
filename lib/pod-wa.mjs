/**
 * Agente POD WhatsApp — 100% IA (texto + visión). Sin heurísticas de keywords.
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

function modelPod() {
  return (
    process.env.OPENAI_POD_MODEL?.trim() ||
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function iaHabilitada() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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
  return "📷 Gracias, recibí la foto del POD.\nLa estoy *leyendo con Document AI*… un momento.";
}

export function mensajeConfirmacionPod(caso, lectura = null) {
  if (lectura?.mensaje) return String(lectura.mensaje).trim();
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

async function callOpenAiJson({ system, userContent, log, tag, maxTokens = 500 }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelPod(),
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.POD_IA_TIMEOUT_MS) || 28000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, tag || "POD IA falló");
    return null;
  }
}

/**
 * ¿El mensaje quiere iniciar / hablar de POD? (solo IA).
 */
export async function parecePod(texto, { log } = {}) {
  const t = String(texto ?? "").trim();
  if (!t) return false;
  if (!iaHabilitada()) return false;

  const ia = await callOpenAiJson({
    system:
      "Clasificás si un chofer por WhatsApp quiere registrar una constancia de entrega (POD). Respondé SOLO JSON.",
    userContent: `Mensaje del chofer:
"""
${t}
"""

Es POD si habla de: constancia/prueba de entrega, entregué, a quién entregó, firma/sello de recepción, foto de mercadería entregada.
NO es POD: remito de carga, gasto/nafta/peaje, incidencia en ruta, pedir flete, reclamo de cliente.

JSON: { "es_pod": boolean, "confianza": number }`,
    log,
    tag: "POD parecePod IA",
    maxTokens: 120,
  });

  return Boolean(ia?.es_pod) && (Number(ia.confianza) || 0) >= 0.55;
}

/**
 * Interpreta un turno de TEXTO del diálogo POD (100% IA).
 * @returns {Promise<{
 *   accion: 'iniciar'|'dar_receptor'|'cancelar'|'otro',
 *   receptor_nombre: string|null,
 *   mensaje: string|null,
 *   fuente: string
 * }>}
 */
export async function interpretarTextoPod({
  texto,
  estado = null,
  log = null,
} = {}) {
  const t = String(texto ?? "").trim();
  const vacio = {
    accion: "otro",
    receptor_nombre: null,
    mensaje: null,
    fuente: "sin_texto",
  };
  if (!t) return vacio;
  if (!iaHabilitada()) {
    return {
      ...vacio,
      fuente: "sin_ia",
      mensaje:
        "Ahora mismo no puedo procesar el POD. Probá de nuevo en un momento o mandá la foto del formulario.",
    };
  }

  const ia = await callOpenAiJson({
    system:
      "Sos el agente POD (Proof of Delivery) de TransitOne / SOL. " +
      "Atendés choferes por WhatsApp. Rioplatense, claro, humano. " +
      "Nunca digas que sos una IA. Respondé SOLO JSON válido.",
    userContent: `Estado del diálogo: ${estado || "inicio (sin caso abierto)"}

Mensaje del chofer:
"""
${t}
"""

Acciones:
- "iniciar": quiere empezar un POD / constancia / prueba de entrega (aunque diga "hola quiero mandar un POD"). NO es un nombre de persona.
- "dar_receptor": está dando el nombre de quien recibió la mercadería.
- "cancelar": cancela / no quiere seguir.
- "otro": otra cosa (corrección, pregunta, saludo sin POD).

Reglas:
- NUNCA pongas en receptor_nombre frases de intención ("quiero mandar POD", "entregué", "hola").
- receptor_nombre solo si es claramente un nombre de persona (ej. "María López", "Juan Pérez").
- Si estado=esperando_receptor y manda un nombre → accion=dar_receptor.
- Si estado=esperando_foto y manda texto sin ser claramente un nombre → accion=otro (el sistema pedirá la foto).
- mensaje: respuesta corta WhatsApp SOLO si hace falta aclarar; si no, null.

JSON:
{
  "accion": "iniciar"|"dar_receptor"|"cancelar"|"otro",
  "receptor_nombre": string|null,
  "mensaje": string|null,
  "confianza": number
}`,
    log,
    tag: "POD interpretarTexto",
    maxTokens: 350,
  });

  if (!ia) {
    return {
      accion: "otro",
      receptor_nombre: null,
      mensaje: mensajePedirFotoPod(null),
      fuente: "ia_error",
    };
  }

  const accion = ["iniciar", "dar_receptor", "cancelar", "otro"].includes(ia.accion)
    ? ia.accion
    : "otro";
  const receptor =
    ia.receptor_nombre && String(ia.receptor_nombre).trim().length >= 2
      ? String(ia.receptor_nombre).trim().slice(0, 80)
      : null;

  return {
    accion: accion === "dar_receptor" && !receptor ? "otro" : accion,
    receptor_nombre: receptor,
    mensaje: ia.mensaje ? String(ia.mensaje).trim() : null,
    fuente: "ia",
    confianza: Number(ia.confianza) || 0.8,
  };
}

/**
 * Lee formulario POD: Document AI (OCR) → IA estructura campos.
 * Fallback: visión OpenAI si Doc AI no responde o el texto es insuficiente.
 */
export async function leerPodDesdeImagen({ imageBuffer, mime, texto, log } = {}) {
  if (!imageBuffer?.length) return null;

  const promptEstructura = (ocrTexto, conVision) =>
    `${conVision ? "Analizá la foto" : "A partir del texto OCR de Document AI"} de una constancia de entrega (POD).

Extraé solo lo que aparece (no inventes):
- receptor_nombre: quien recibió (destinatario / firma)
- pedido_ref: nº de pedido, tracking, PE-…, ECO-…, guía
- destino: dirección o ciudad
- chofer_documento: repartidor si figura
- resumen: 1 línea
- mensaje: WhatsApp corto confirmando lo leído y que queda pendiente de mesa (rioplatense). Incluí receptor y ref si hay.

Texto del chofer (si hay):
"""
${texto || "(sin texto)"}
"""

${ocrTexto ? `TEXTO_OCR_DOCUMENT_AI:\n"""\n${ocrTexto.slice(0, 8000)}\n"""` : "(sin OCR)"}

JSON:
{
  "receptor_nombre": string|null,
  "pedido_ref": string|null,
  "destino": string|null,
  "chofer_documento": string|null,
  "resumen": string|null,
  "mensaje": string|null,
  "confianza": number
}`;

  const mapIa = (ia, fuente, ocrTexto = null) => {
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
      mensaje: ia.mensaje ? String(ia.mensaje).trim() : null,
      confianza: Number(ia.confianza) || 0.7,
      fuente,
      ocr_texto: ocrTexto || null,
    };
  };

  // 1) Document AI OCR (mismo stack que remitos)
  let ocrTexto = "";
  try {
    const { ocrDocumento } = await import("./document-ai.mjs");
    const ext =
      /png/i.test(mime || "") ? "png" : /webp/i.test(mime || "") ? "webp" : "jpg";
    const ocr = await ocrDocumento(imageBuffer, `pod.${ext}`);
    ocrTexto = String(ocr?.texto || "").trim();
    log?.info?.(
      { paginas: ocr?.paginas, chars: ocrTexto.length, processor: ocr?.processor_id },
      "POD Document AI OCR",
    );
  } catch (err) {
    log?.warn?.({ err: err.message }, "POD Document AI falló → visión");
  }

  const system =
    "Sos el agente POD (Proof of Delivery) de TransitOne / SOL. " +
    "Estructurás datos de constancias de entrega. Respondé SOLO JSON válido. No inventes.";

  // 2) Si hay OCR usable → IA solo sobre texto (barato y estable)
  if (ocrTexto.length >= 40 && iaHabilitada()) {
    const ia = await callOpenAiJson({
      system,
      userContent: promptEstructura(ocrTexto, false),
      log,
      tag: "POD estructura desde Doc AI",
      maxTokens: 550,
    });
    const mapped = mapIa(ia, "document_ai+ia", ocrTexto);
    if (mapped && (mapped.receptor_nombre || mapped.pedido_ref || mapped.resumen)) {
      return mapped;
    }
  }

  // 3) Fallback visión OpenAI (foto + OCR parcial si hubo)
  if (!iaHabilitada()) {
    return ocrTexto
      ? {
          receptor_nombre: null,
          pedido_ref: null,
          destino: null,
          chofer_documento: null,
          resumen: ocrTexto.slice(0, 200),
          mensaje: null,
          confianza: 0.3,
          fuente: "document_ai_solo",
          ocr_texto: ocrTexto,
        }
      : null;
  }

  const imageBase64 = Buffer.from(imageBuffer).toString("base64");
  const iaVision = await callOpenAiJson({
    system,
    userContent: [
      { type: "text", text: promptEstructura(ocrTexto || null, true) },
      {
        type: "image_url",
        image_url: {
          url: `data:${mime || "image/jpeg"};base64,${imageBase64}`,
        },
      },
    ],
    log,
    tag: "POD visión fallback",
    maxTokens: 550,
  });

  return mapIa(
    iaVision,
    ocrTexto ? "document_ai+vision" : "vision",
    ocrTexto || null,
  );
}

