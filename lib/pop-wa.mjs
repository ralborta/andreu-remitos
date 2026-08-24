/**
 * Agente POP WhatsApp — Proof of Pickup (retiro en origen).
 */
import { leerPodDesdeImagen } from "./pod-wa.mjs";
import { normalizeQuantities } from "./transport-evidence.mjs";

export { leerPodDesdeImagen as leerPopDesdeImagenOcr };

export function mensajePopSoloChoferes() {
  return (
    `El *registro de retiro (POP)* es solo para *choferes registrados*.\n\n` +
    `Si necesitás un *viaje* o reportar otra cosa, contame y te ayudo.`
  );
}

export function mensajePedirFotoPop(viajeCodigo) {
  const ref = viajeCodigo ? ` del viaje *${viajeCodigo}*` : "";
  return (
    `Perfecto, vamos con el *registro de retiro (POP)*${ref}.\n\n` +
    `Mandame *fotos claras* de la carga que estás retirando ` +
    `(mercadería, pallets, remito/factura si hay).\n` +
    `Podés enviar más de una foto.`
  );
}

export function mensajePedirCantidadesPop() {
  return (
    `Si podés, decime *qué retiraste*:\n` +
    `• pallets / cajas / bultos\n` +
    `• estado (OK, incompleta, dañada…)\n\n` +
    `Ej: "20 pallets, 1000 cajas, OK"`
  );
}

export function mensajeProcesandoPop() {
  return "📷 Recibí la foto del retiro.\nLa estoy *leyendo*… un momento.";
}

export function mensajeConfirmacionPop(caso, lectura = null) {
  if (lectura?.mensaje) return String(lectura.mensaje).trim();
  const viaje = caso.viaje_ref || "—";
  const lineas = [
    `✅ *POP ${caso.codigo || caso.id}* registrado.`,
    ``,
    `Viaje: *${viaje}*`,
  ];
  const q = caso.reported_quantities;
  if (q) {
    const parts = [];
    if (q.pallets != null) parts.push(`${q.pallets} pallets`);
    if (q.cajas != null) parts.push(`${q.cajas} cajas`);
    if (q.bultos != null) parts.push(`${q.bultos} bultos`);
    if (parts.length) lineas.push(`Carga: ${parts.join(" · ")}`);
  }
  if (caso.observed || caso.estado === "observado") {
    lineas.push(`⚠️ *Observado*: hay diferencias respecto a lo planificado.`);
  }
  lineas.push(``, `Queda *pendiente* de confirmación en mesa.`);
  return lineas.join("\n");
}

export function mensajeDecisionPop(caso) {
  if (caso.estado === "ok") {
    return (
      `✅ Tu *POP ${caso.codigo || caso.id}* fue *confirmado*.\n` +
      `Podés salir hacia destino cuando corresponda.\n` +
      (caso.nota_backoffice ? `Nota: ${caso.nota_backoffice}` : "")
    );
  }
  return (
    `❌ Tu *POP ${caso.codigo || caso.id}* fue *rechazado*.\n` +
    (caso.nota_backoffice ? `Motivo: ${caso.nota_backoffice}\n` : "") +
    `Contactá a operaciones si necesitás reenviar evidencia.`
  );
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

function modelPop() {
  return (
    process.env.OPENAI_POD_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

/** Atajo duro: “POP”, “ya cargué”, etc. no deben depender de la IA. */
export function parecePopHeuristica(texto) {
  const t = String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return false;
  // Entrega explícita → no POP
  if (/\b(entregue|pod)\b/.test(t) && !/\bpop\b/.test(t)) {
    return false;
  }
  return /\b(pop|proof\s+of\s+pickup|registro\s+de\s+retiro|ya\s+cargue|cargue|retire|pickup|envi(ar|o|ame)\s+(un\s+)?pop|quiero\s+(enviar\s+)?(un\s+)?pop|foto\s+(del\s+)?(retiro|comprobante\s+de\s+retiro))\b/.test(
    t,
  );
}

export async function parecePop(texto, { log } = {}) {
  const t = String(texto ?? "").trim();
  if (!t) return false;
  if (parecePopHeuristica(t)) return true;
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelPop(),
        temperature: 0.1,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Clasificás si un chofer quiere registrar retiro de carga en origen (POP / Proof of Pickup). JSON only.",
          },
          {
            role: "user",
            content: `Mensaje: """${t}"""
POP si: dice POP, quiere enviar POP, cargué, retiré, pickup, mercadería en camión, foto de carga/comprobante en origen, registro de retiro.
NO POP si: entrega/POD, gasto/rendición, incidencia en ruta, reclamo de cliente.
JSON: { "es_pop": boolean, "confianza": number }`,
          },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.POD_IA_TIMEOUT_MS) || 28000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const ia = extraerJson(data.choices?.[0]?.message?.content ?? "");
    return Boolean(ia?.es_pop) && (Number(ia.confianza) || 0) >= 0.55;
  } catch (err) {
    log?.warn?.({ err: err.message }, "POP parecePop IA");
    return false;
  }
}

export async function interpretarTextoPop({ texto, estado = null, log = null } = {}) {
  const t = String(texto ?? "").trim();
  if (!t || !process.env.OPENAI_API_KEY?.trim()) {
    return { accion: "otro", quantities: null, condition: null, mensaje: null, fuente: "sin_ia" };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelPop(),
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Agente POP (Proof of Pickup) SOL. Extraé cantidades y estado de carga desde texto del chofer. JSON only.",
          },
          {
            role: "user",
            content: `Estado: ${estado || "inicio"}
Mensaje: """${t}"""

Acciones: iniciar | dar_cantidades | cancelar | otro
Cantidades en pallets/cajas/bultos si menciona.
condition: ok|incompleta|danada|embalaje_deteriorado|diferencia_cantidad|otro|null

JSON: { "accion": string, "quantities": {pallets?,cajas?,bultos?}|null, "condition": string|null, "mensaje": string|null }`,
          },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.POD_IA_TIMEOUT_MS) || 28000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const ia = extraerJson(data.choices?.[0]?.message?.content ?? "");
    return {
      accion: ia?.accion || "otro",
      quantities: normalizeQuantities(ia?.quantities),
      condition: ia?.condition || null,
      mensaje: ia?.mensaje ? String(ia.mensaje).trim() : null,
      fuente: "ia",
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "POP interpretarTexto");
    return { accion: "otro", quantities: null, condition: null, mensaje: null, fuente: "ia_error" };
  }
}

export async function leerPopDesdeImagen(opts) {
  const lectura = await leerPodDesdeImagen(opts);
  if (!lectura) return null;
  return {
    ...lectura,
    responsable_nombre: lectura.chofer_documento || null,
    pedido_ref: lectura.pedido_ref,
    resumen: lectura.resumen || "Evidencia de retiro (POP)",
  };
}
