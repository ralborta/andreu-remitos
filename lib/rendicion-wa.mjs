/**
 * Agente WhatsApp de Rendición de gastos (SOL).
 * Lee texto/foto → clasifica → deja pendiente de aprobación humana.
 */
import {
  labelCategoria,
  moneyAR,
  moneyCLP,
  RENDICION_CATEGORIAS,
} from "./rendicion.mjs";
import {
  obtenerCotizacionClpArs,
  convertirClpAArs,
  pareceComprobanteChileno,
} from "./tipo-cambio.mjs";

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

/** Pedido de foto antes de registrar el gasto (categoría conocida o genérico). */
export function mensajePedirFotoComprobante(texto) {
  const { categoria } = heuristicaGasto(texto);
  if (categoria && categoria !== "otro") {
    const cat = labelCategoria(categoria);
    return (
      `Dale ✅ Mandame la *foto del ticket/factura* del *${cat}*.\n\n` +
      `Cuando la reciba la dejo pendiente de *aprobación humana*.`
    );
  }
  return (
    `Dale ✅ Mandame la *foto del ticket/factura* (nafta, peaje, llantas, aceite, remolque, auxilio o arreglo menor).\n\n` +
    `También podés escribir el monto y qué es. Queda sujeto a *aprobación humana*.`
  );
}

async function callOpenAiVisionOrText({ texto, imageBase64, mime, ocrTexto, log }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_RENDICION_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

  const cats = RENDICION_CATEGORIAS.join("|");
  const system =
    "Sos el agente de Rendición de gastos de una logística argentina. " +
    "Clasificás comprobantes menores del chofer (peajes, combustible, etc.). Respondé SOLO JSON válido. " +
    "Si hay un número de viaje en el papel, ponelo en viaje_documento — NO lo trates como viaje Delfos confirmado.";

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
- Extraé monto numérico si aparece. En Chile el punto es miles ($ 20.000 = 20000).
- moneda: "CLP" si el comprobante es chileno (RUT, Chile, peaje Cristo Redentor, Los Andes, etc.); "ARS" si es argentino; null si no sabés.
- En peajes/tickets fiscales argentinos extraé: punto_venta (P.V.), nro_t (Nº T / Nro T), iva_pct, rae (impuesto fitosanitario ENTE), cuit_proveedor.
- En Chile: cuit_proveedor puede ser el RUT (dejalo con guión si viene).
- viaje_documento: cualquier nº de viaje que aparezca en el ticket/hoja (puede NO ser el de Delfos).
- Solo generá "mensaje" si hay imagen de comprobante: respuesta corta rioplatense confirmando lo leído y avisando que queda pendiente de aprobación humana.
- Sin imagen de comprobante no digas que quedó pendiente: el sistema pedirá la foto aparte.

Texto del chofer (si hay):
"""
${texto || "(sin texto)"}
"""

${ocrTexto ? `TEXTO_OCR_DOCUMENT_AI:\n"""\n${String(ocrTexto).slice(0, 6000)}\n"""` : ""}

JSON:
{
  "categoria": "${cats}",
  "monto": number|null,
  "moneda": "ARS"|"CLP"|null,
  "proveedor": string|null,
  "fecha_comprobante": string|null,
  "descripcion": string|null,
  "punto_venta": string|null,
  "nro_t": string|null,
  "iva_pct": number|null,
  "rae": boolean,
  "monto_rae": number|null,
  "cuit_proveedor": string|null,
  "viaje_documento": string|null,
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
  ocrTexto = null,
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
    ocrTexto,
    log,
  });

  if (!ia) {
    return aplicarConversionMonedaOrigen(
      { ...heur, texto_ocr: ocrTexto || null },
      { texto, ocrTexto, log },
    );
  }

  let categoria = String(ia.categoria || heur.categoria || "otro")
    .toLowerCase()
    .trim();
  if (!RENDICION_CATEGORIAS.includes(categoria)) categoria = heur.categoria || "otro";

  const monto =
    ia.monto != null && Number.isFinite(Number(ia.monto))
      ? Number(ia.monto)
      : heur.monto;

  let monedaIa = ia.moneda ? String(ia.moneda).toUpperCase().trim() : null;
  if (monedaIa && !["ARS", "CLP"].includes(monedaIa)) monedaIa = null;

  let out = {
    categoria,
    monto,
    moneda: monedaIa || "ARS",
    proveedor: ia.proveedor ? String(ia.proveedor).trim() : null,
    fecha_comprobante: ia.fecha_comprobante || null,
    descripcion: ia.descripcion || heur.descripcion,
    punto_venta: ia.punto_venta ? String(ia.punto_venta).trim() : null,
    nro_t: ia.nro_t ? String(ia.nro_t).trim() : null,
    iva_pct:
      ia.iva_pct != null && Number.isFinite(Number(ia.iva_pct))
        ? Number(ia.iva_pct)
        : null,
    rae: Boolean(ia.rae),
    monto_rae:
      ia.monto_rae != null && Number.isFinite(Number(ia.monto_rae))
        ? Number(ia.monto_rae)
        : null,
    cuit_proveedor: ia.cuit_proveedor ? String(ia.cuit_proveedor).trim() : null,
    viaje_documento: ia.viaje_documento ? String(ia.viaje_documento).trim() : null,
    mensaje: ia.mensaje ? String(ia.mensaje).trim() : null,
    fuente: "ia",
    confianza: Number(ia.confianza) || 0.7,
    texto_ocr: ocrTexto || null,
  };

  return aplicarConversionMonedaOrigen(out, { texto, ocrTexto, log });
}

/**
 * Si el ticket es CLP: guarda monto_origen y convierte monto → ARS con DolarAPI.
 */
export async function aplicarConversionMonedaOrigen(
  interp,
  { texto = "", ocrTexto = "", log } = {},
) {
  const base = { ...(interp || {}) };
  const esClp =
    String(base.moneda || "").toUpperCase() === "CLP" ||
    pareceComprobanteChileno({
      ocrTexto: ocrTexto || base.texto_ocr,
      texto,
      monedaIa: base.moneda,
    });

  if (!esClp || base.monto == null || !Number.isFinite(Number(base.monto))) {
    return {
      ...base,
      moneda: base.moneda || "ARS",
      moneda_origen: null,
      monto_origen: null,
      tc_clp_ars: null,
      tc_fecha: null,
      tc_fuente: null,
    };
  }

  const montoOrigen = Number(base.monto);
  try {
    const cot = await obtenerCotizacionClpArs({ log });
    const montoArs = convertirClpAArs(montoOrigen, cot.valor);
    return {
      ...base,
      moneda: "ARS",
      moneda_origen: "CLP",
      monto_origen: montoOrigen,
      monto: montoArs,
      tc_clp_ars: cot.valor,
      tc_fecha: cot.fecha,
      tc_fuente: cot.fuente,
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "No pude cotizar CLP→ARS; dejo monto CLP sin convertir");
    return {
      ...base,
      moneda: "CLP",
      moneda_origen: "CLP",
      monto_origen: montoOrigen,
      monto: montoOrigen,
      tc_clp_ars: null,
      tc_fecha: null,
      tc_fuente: null,
    };
  }
}

export function mensajeConfirmacionGasto(gasto, interpretacion) {
  const viajeLine = gasto.nro_viaje_delfos
    ? `\nViaje Delfos: *${gasto.nro_viaje_delfos}*`
    : "";
  const clpLine =
    gasto.moneda_origen === "CLP" && gasto.monto_origen != null
      ? `\nOrigen: *${moneyCLP(gasto.monto_origen)}*` +
        (gasto.tc_clp_ars != null
          ? ` → *${moneyAR(gasto.monto)}* (TC ${Number(gasto.tc_clp_ars).toFixed(4)} ARS/CLP)`
          : "")
      : "";
  const ctaLine = interpretacion?.combustible_cta_cte
    ? `\nImporte *${moneyAR(0)}* (cuenta corriente / YPF en ruta).` +
      `\nSi lo pagaste vos, reenviá la foto con: *combustible abonado por el chofer*.`
    : "";
  if (interpretacion?.mensaje && !interpretacion?.combustible_cta_cte && !clpLine) {
    return (
      `${String(interpretacion.mensaje).trim()}${viajeLine}\n\n` +
      `Si tenés *otro ticket*, mandá la foto. Si no, escribí *listo*.`
    );
  }
  const cat = labelCategoria(gasto.categoria);
  const monto =
    interpretacion?.combustible_cta_cte
      ? moneyAR(0)
      : gasto.monto != null
        ? moneyAR(gasto.monto)
        : "monto a confirmar";
  const pagoLine = interpretacion?.pago_chofer
    ? `\nMarcado como *abonado por el chofer*.`
    : "";
  return (
    `Listo ✅ Registré tu gasto *${cat}* (${monto})` +
    (gasto.proveedor ? ` · ${gasto.proveedor}` : "") +
    `${viajeLine}${clpLine}${ctaLine}${pagoLine}.\n\nCódigo *${gasto.codigo}*. Queda *pendiente de aprobación* del backoffice.\n\n` +
    `Si tenés *otro ticket*, mandá la foto. Si no, escribí *listo*.`
  );
}

/** Cierre real de carga de boletas (tras LISTO). */
export function mensajeCierreComprobantesRendicion() {
  return (
    `Listo ✅ Cerramos la carga de tickets de esta hoja.\n\n` +
    `Para más gastos: mandá una *hoja de ruta nueva* o escribí *viaje NNNNN* (Nº Delfos) y después las fotos.`
  );
}

/** Pedir Nº viaje / hoja cuando no hay sesión activa. */
export function mensajePedirViajeOHoja() {
  return (
    `Recibí la foto, pero *no hay una hoja/viaje activo*.\n\n` +
    `Mandá la *hoja de ruta* o escribí *viaje NNNNN* (Nº Delfos) y *volvé a mandar* la foto del ticket.`
  );
}

export function mensajeRechazoNoComprobante() {
  return (
    `Esa foto no parece un *ticket/factura* de gasto (peaje, nafta, etc.).\n\n` +
    `Mandá claramente el comprobante, o escribí *listo* si ya terminaste.`
  );
}

export function mensajeDuplicadoGasto(gastoExistente) {
  const cod = gastoExistente?.codigo || "RG-????";
  return (
    `Este ticket *ya está cargado* (*${cod}*).\n\n` +
    `No lo duplico.\n\n` +
    `Si es *excepción autorizada*, escribí:\n` +
    `*forzar duplicado* + el motivo (ej: *forzar duplicado autorizado mesa*).`
  );
}

export function mensajeConfirmarAsociacionViaje({ nroViaje, hojaCodigo } = {}) {
  const ref = hojaCodigo
    ? `Hoja de Ruta *${hojaCodigo}* (viaje *${nroViaje}*)`
    : `viaje Delfos *${nroViaje}*`;
  return (
    `¿Desea asociar este gasto / los próximos tickets a la ${ref}?\n\n` +
    `Respondé *sí* para confirmar o *no* para cancelar.`
  );
}

export function mensajeViajeAsignado(nroViaje, { hojaCodigo } = {}) {
  const hojaLine = hojaCodigo ? ` (Hoja *${hojaCodigo}*)` : "";
  return (
    `Ok ✅ Viaje Delfos *${nroViaje}*${hojaLine} activo para rendición.\n\n` +
    `Mandá las fotos de los tickets. Cuando termines, escribí *listo*.`
  );
}

export function mensajeViajeAsociacionCancelada() {
  return (
    `Cancelado. No asocié ningún viaje.\n\n` +
    `Si querés, escribí de nuevo *viaje NNNNN* o mandá una *hoja de ruta*.`
  );
}

/**
 * Comando: "viaje 79042" / "nro viaje 79042" / "hoja 79042"
 * @returns {string|null} Nº viaje Delfos
 */
export function parseAsignacionViaje(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const m = t.match(
    /^(?:nro\.?\s*)?(?:viaje|hoja(?:\s*de\s*ruta)?)\s*[#.:]?\s*(\d{4,8})\s*$/i,
  );
  return m?.[1] || null;
}

export function pareceAfirmacionCorta(texto) {
  return /^(s[ií]|si+|ok|dale|confirmo|confirmar|yes|afirmativo)[.!]?\s*$/i.test(
    String(texto ?? "").trim(),
  );
}

export function pareceNegacionCorta(texto) {
  return /^(no|nop|nope|cancelar|cancel[aá]|cancelo)[.!]?\s*$/i.test(
    String(texto ?? "").trim(),
  );
}

/**
 * "forzar duplicado autorizado mesa" → { motivo }
 * @returns {{ motivo: string }|null}
 */
export function parseForzarDuplicado(texto) {
  const t = String(texto ?? "").trim();
  const m = t.match(/^forzar\s+duplicado\b[:\-\s]*(.*)$/i);
  if (!m) return null;
  return { motivo: String(m[1] || "").trim() };
}

export function motivoForzarDuplicadoValido(motivo) {
  const m = String(motivo || "").trim();
  if (m.length < 5) return false;
  return /autoriz|mesa|excepci|forzad|aprobad|ok\s*tr[aá]fico/i.test(m) || m.length >= 12;
}

/** El chofer indica que pagó él la nafta (excepción a cuenta corriente). */
export function choferPagoCombustible(texto) {
  const t = String(texto ?? "");
  if (
    /combustible\s+abonado\s+por\s+(el\s+)?chofer|abonado\s+por\s+(el\s+)?chofer|nafta\s+abonada\s+por\s+(el\s+)?chofer/i.test(
      t,
    )
  ) {
    return true;
  }
  return /pagu[eé]|abon[eé]|pag[oó]\s*(yo|el\s*chofer)|cuenta\s*propia|autorizad|nafta\s*paga|combustible\s*pag/i.test(
    t,
  );
}

/**
 * Combustible → importe 0 (cta cte) salvo que el chofer diga que pagó él.
 */
export function aplicarReglaCombustibleCtaCte(interp, textoChofer = "") {
  const base = { ...(interp || {}), combustible_cta_cte: false, pago_chofer: false };
  if (base.categoria !== "combustible") return base;
  const hint = `${textoChofer || ""} ${base.descripcion || ""}`;
  if (choferPagoCombustible(hint)) {
    return { ...base, pago_chofer: true, combustible_cta_cte: false };
  }
  const desc = [base.descripcion, "Cuenta corriente empresa (importe 0)"]
    .filter(Boolean)
    .join(" · ");
  return {
    ...base,
    monto: 0,
    combustible_cta_cte: true,
    descripcion: desc.slice(0, 240),
  };
}

/**
 * ¿Hay señales mínimas de ticket fiscal / peaje / estación?
 * Evita grabar chats, remitos o fotos basura como gasto.
 */
export function esComprobanteGastoAceptable({ ocrTexto, interp } = {}) {
  const ocr = String(ocrTexto ?? "");
  if (pareceDocumentoGasto(ocr)) return true;

  const cat = String(interp?.categoria || "").toLowerCase();
  const tieneFiscal =
    Boolean(interp?.nro_t) ||
    Boolean(interp?.cuit_proveedor) ||
    Boolean(interp?.punto_venta);
  if (tieneFiscal) return true;

  if (cat === "peaje" && (interp?.monto != null || /peaje|autopista|telepase/i.test(ocr))) {
    return true;
  }
  if (
    cat === "combustible" &&
    (interp?.proveedor || /ypf|shell|axion|puma|estacion|estación|gasoil|nafta/i.test(ocr))
  ) {
    return true;
  }
  if (
    interp?.monto != null &&
    Number(interp.monto) > 0 &&
    /ticket|factura|cuit|iva|total|peaje|ypf|importe/i.test(ocr)
  ) {
    return true;
  }
  return false;
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

/** Un solo aviso cuando mesa aprueba varios tickets del mismo chofer. */
export function mensajeDecisionLoteAprobado(gastos = []) {
  const list = Array.isArray(gastos) ? gastos.filter((g) => g?.codigo) : [];
  if (list.length === 0) return null;
  if (list.length === 1) return mensajeDecisionGasto(list[0]);
  const mostrados = list.slice(0, 12).map((g) => `*${g.codigo}*`);
  const resto = list.length - mostrados.length;
  return (
    `✅ Aprobé *${list.length}* gastos: ${mostrados.join(", ")}` +
    (resto > 0 ? ` y ${resto} más` : "") +
    `.`
  );
}

/**
 * ¿El chofer pidió rendición por texto?
 * No usar palabras vagas ("comprobante", "ticket", "factura") — meten remitos en gastos.
 */
export function pareceRendicionGasto(texto) {
  const t = String(texto ?? "").toLowerCase();
  return /\b(rendici[oó]n|gasto|nafta|combustible|peaje|ticket\s*de\s*peaje|llanta|aceite|remolque|auxilio|taller|arreglo)\b/i.test(
    t,
  );
}

/**
 * Detecta boleta de peaje/combustible/etc. por OCR del ticket.
 * Usado para no meter rendiciones en la pantalla de remitos.
 */
export function pareceDocumentoGasto(ocrTexto) {
  const t = String(ocrTexto ?? "").toLowerCase();
  if (!t.trim()) return false;

  // Si el papel es claramente un remito de cliente, no es gasto
  if (/\bremito\b/.test(t) && !/ticket\s*de\s*peaje|ypf|shell|estacion\s*de\s*servicio/.test(t)) {
    return false;
  }
  if (/llegada\s+a\s+la\s+carga|inicio\s+de\s+la\s+carga|salida\s+de\s+la\s+planta/.test(t)) {
    return false;
  }

  if (/ticket\s*de\s*peaje|comprobante\s*de\s*peaje|corredores\s*viales/.test(t)) {
    return true;
  }
  // Peajes / tickets chilenos (Cristo Redentor, MOP, etc.)
  if (/plaza\s*peaje|mop\s*-?\s*d\.?\s*vialidad|cristo\s*redentor|parqueadero/i.test(t)) {
    return true;
  }
  if (/\br\.?\s*u\.?\s*t\.?\b/i.test(t) && /\$\s*\d/.test(t)) {
    return true;
  }
  if (
    /\b(ypf|shell|axion|puma\s*energy|estacion\s*de\s*servicio|estación\s*de\s*servicio)\b/.test(t)
  ) {
    return true;
  }
  if (/\b(combustible|gasoil|nafta|g\.?n\.?c\.?)\b/.test(t) && /\b(ticket|factura|cuit|iva|total)\b/.test(t)) {
    return true;
  }
  if (/\b(peaje|autopista)\b/.test(t) && /\b(importe|total|cuit|ticket)\b/.test(t)) {
    return true;
  }
  return false;
}
