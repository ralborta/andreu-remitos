/**
 * Agente WhatsApp de Reclamos (clientes) — diálogo 100% IA, humanizado.
 * Sin heurísticas de comprensión: el LLM entiende, clasifica y conversa.
 * El store solo persiste; no se “adivinan” viajes ni se inventan resoluciones.
 */
import {
  labelCriticidad,
  labelMotivo,
  RECLAMO_CRITICIDADES,
  RECLAMO_MOTIVOS,
} from "./reclamos.mjs";
import * as reclamosStore from "../backend/src/db/reclamos-store.mjs";

function iaHabilitada() {
  if (process.env.RECLAMOS_IA_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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

async function callLlmJson(prompt, { log, temperature = 0.55, maxTokens = 700 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_RECLAMOS_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";

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
            "Sos un agente de reclamos logísticos por WhatsApp. Respondé SOLO JSON válido. Mensajes al cliente en español rioplatense, humanos y cálidos.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.RECLAMOS_IA_TIMEOUT_MS) || 28000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return extraerJson(data.choices?.[0]?.message?.content ?? "");
}

function datosActuales(row) {
  return {
    cliente: row.cliente || row.nombre || null,
    viaje_ref: row.viaje_ref || null,
    remito_ref: row.remito_ref || null,
    pedido_ref: row.pedido_ref || null,
    motivo: row.motivo || null,
    criticidad: row.criticidad || null,
    detalle: row.detalle || null,
    resumen: row.resumen || null,
  };
}

function mergePatch(row, patch = {}) {
  const out = { ...datosActuales(row) };
  for (const k of [
    "cliente",
    "viaje_ref",
    "remito_ref",
    "pedido_ref",
    "detalle",
    "resumen",
  ]) {
    if (patch[k] != null && String(patch[k]).trim()) out[k] = String(patch[k]).trim();
  }
  if (patch.motivo != null && String(patch.motivo).trim()) {
    const m = String(patch.motivo).toLowerCase().trim();
    out.motivo = RECLAMO_MOTIVOS.includes(m) ? m : out.motivo;
  }
  if (patch.criticidad != null && String(patch.criticidad).trim()) {
    const c = String(patch.criticidad).toLowerCase().trim();
    out.criticidad = RECLAMO_CRITICIDADES.includes(c) ? c : out.criticidad;
  }
  return out;
}

/** ¿Hay info mínima para abrir el caso? Lo decide la IA; esto es solo guardrail. */
function tieneMinimoParaAbrir(datos) {
  const hayRef = Boolean(datos.viaje_ref || datos.remito_ref || datos.pedido_ref);
  const hayQuePaso = Boolean(datos.detalle && String(datos.detalle).trim().length >= 12);
  const hayMotivo = Boolean(datos.motivo);
  return hayQuePaso && (hayRef || hayMotivo);
}

/**
 * Un turno de diálogo con el cliente.
 */
export async function turnoAgenteReclamos({
  texto,
  reclamo,
  hechosViaje = null,
  log = null,
} = {}) {
  const datos = datosActuales(reclamo);
  const historialCorto = (reclamo.mensajes || [])
    .slice(-8)
    .map((m) => `${m.dir === "in" ? "CLIENTE" : "AGENTE"}: ${m.texto}`)
    .join("\n");

  if (!iaHabilitada()) {
    return {
      datos_patch: {},
      accion: "pedir_datos",
      mensaje:
        "Perdón, ahora mismo no puedo procesar el reclamo con normalidad. ¿Me lo reescribís en un minutito?",
      fuente: "sin_ia",
      confianza: 0,
    };
  }

  const prompt = `Sos el agente de *Reclamos Logísticos* de TransitOne / SOL.
Atendés a CLIENTES (no choferes) por WhatsApp. Sos una PERSONA: empática, clara, profesional y rioplatense.
Nunca parecés un menú ni un formulario. Nunca digas que sos una IA.

OBJETIVO DEL DIÁLOGO:
1) Entender qué pasó (demora, faltante, avería, documentación, trato u otro).
2) Identificar referencia del viaje / remito / pedido si el cliente la tiene (no inventes códigos).
3) Clasificar motivo y criticidad (alta/media/baja).
4) Cuando tengas lo mínimo, ABRIR el caso y dar el código RC-…
5) Si es criticidad alta o el cliente está muy urgido/enojado → escalar a coordinación y avisarlo con calma.

REGLAS DURAS:
- NUNCA inventes estado del viaje, ETA, TMS, tracking, compensaciones, culpas ni "ya salió el camión".
- Si hay HECHOS_VIAJE, podés usarlos; si no, no inventes.
- No pidas de golpe una lista robótica. Máximo 1–2 preguntas naturales por turno.
- Si el cliente ya dio datos, NO los vuelvas a pedir.
- Si aún falta lo esencial, accion=pedir_datos.
- Si ya alcanza para abrir: accion=abrir_caso (o accion=escalar si corresponde).
- Si el cliente solo saluda o desvía: accion=chitchat y reconducí con calidez.
- Si cancela: accion=cancelar.
- Mensaje corto (WhatsApp), *negritas* con moderación, sin JSON en el mensaje.

MOTIVOS VÁLIDOS: ${RECLAMO_MOTIVOS.join(" | ")}
CRITICIDADES: ${RECLAMO_CRITICIDADES.join(" | ")}

CASO_ID: ${reclamo.id}
ESTADO_DIALOGO: ${reclamo.estado}
DATOS_ACTUALES: ${JSON.stringify(datos)}
HECHOS_VIAJE: ${JSON.stringify(hechosViaje)}
HISTORIAL_RECIENTE:
${historialCorto || "(sin historial)"}

MENSAJE_DEL_CLIENTE:
"""
${texto}
"""

Devolvé SOLO JSON:
{
  "datos_patch": {
    "cliente": string|null,
    "viaje_ref": string|null,
    "remito_ref": string|null,
    "pedido_ref": string|null,
    "motivo": "demora_entrega"|"faltante"|"averia"|"documentacion"|"trato"|"otro"|null,
    "criticidad": "alta"|"media"|"baja"|null,
    "detalle": string|null,
    "resumen": string|null
  },
  "accion": "pedir_datos"|"abrir_caso"|"escalar"|"chitchat"|"cancelar",
  "escalado_a": string|null,
  "mensaje": string,
  "confianza": number
}

datos_patch: solo lo que este mensaje aporte con certeza (si dudás → null).
mensaje: lo que vas a enviar al cliente (humano). Si abrís/escalás, incluí el código ${reclamo.id} y qué sigue.`;

  try {
    const parsed = await callLlmJson(prompt, { log });
    if (!parsed) throw new Error("IA sin JSON");

    const patch = parsed.datos_patch && typeof parsed.datos_patch === "object" ? parsed.datos_patch : {};
    let accion = String(parsed.accion || "pedir_datos").toLowerCase().trim();
    const merged = mergePatch(reclamo, patch);

    // Guardrail de negocio: no abrir vacío aunque la IA se apure
    if ((accion === "abrir_caso" || accion === "escalar") && !tieneMinimoParaAbrir(merged)) {
      accion = "pedir_datos";
    }
    if (accion === "escalar" && merged.criticidad !== "alta") {
      // permitir escalar si la IA lo pide explícitamente (urgencia humana)
    }

    let mensaje = String(parsed.mensaje || "").trim();
    if (!mensaje) {
      mensaje =
        accion === "abrir_caso" || accion === "escalar"
          ? `Listo, dejé registrado tu reclamo *${reclamo.id}*. El equipo lo está mirando y te vamos a ir avisando por este medio.`
          : "Contame un poco más qué pasó y, si tenés el *número de viaje o remito*, pasámelo así lo ubico al toque.";
    }

    return {
      datos_patch: patch,
      accion,
      escalado_a: parsed.escalado_a ? String(parsed.escalado_a).trim() : null,
      mensaje,
      merged,
      fuente: "ia",
      confianza: Number(parsed.confianza) || 0.7,
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "Reclamos IA falló");
    return {
      datos_patch: {},
      accion: "pedir_datos",
      mensaje:
        "Perdón, se me trabó un segundo. ¿Me contás de nuevo qué pasó con la entrega? Si tenés el nro de viaje o remito, mejor.",
      fuente: "fallback_blando",
      confianza: 0,
      merged: datos,
    };
  }
}

async function enriquecerHechosViaje(viajeRef, log) {
  if (!viajeRef) return null;
  try {
    const mod = await import("../backend/src/db/viajes-store.mjs").catch(() => null);
    if (!mod?.listViajes) return { ref: viajeRef, encontrado: false };
    const list = await mod.listViajes({ limit: 200 });
    const needle = String(viajeRef).toUpperCase().replace(/\s+/g, "");
    const v = (list || []).find((x) =>
      String(x.codigo || x.id || "")
        .toUpperCase()
        .replace(/\s+/g, "")
        .includes(needle),
    );
    if (!v) return { ref: viajeRef, encontrado: false };
    return {
      ref: viajeRef,
      encontrado: true,
      codigo: v.codigo || v.id,
      origen: v.origen || null,
      destino: v.destino || null,
      estado: v.estado || null,
      cliente: v.cliente || null,
    };
  } catch (err) {
    log?.warn?.({ err: err.message }, "Reclamos: lookup viaje falló");
  }
  return { ref: viajeRef, encontrado: false };
}

/**
 * Orquestación WhatsApp: continúa diálogo o abre caso.
 */
export async function procesarReclamoWhatsApp({
  telefono,
  texto,
  nombre,
  log,
  forzar = false,
} = {}) {
  const t = String(texto || "").trim();
  if (!telefono || (!t && !forzar)) return null;

  let reclamo = await reclamosStore.getReclamoPendientePorTelefono(telefono);
  if (!reclamo) {
    reclamo = await reclamosStore.crearReclamoDialogo({
      telefono,
      nombre,
    });
  }

  const now = new Date().toISOString();
  await reclamosStore.actualizarReclamo(reclamo.id, {
    nombre: nombre || reclamo.nombre,
    mensaje_push: { dir: "in", texto: t, at: now },
  });
  reclamo = (await reclamosStore.getReclamo(reclamo.id)) || reclamo;

  const hechosViaje = await enriquecerHechosViaje(
    reclamo.viaje_ref || null,
    log,
  );

  const turno = await turnoAgenteReclamos({
    texto: t,
    reclamo,
    hechosViaje,
    log,
  });

  const merged = turno.merged || mergePatch(reclamo, turno.datos_patch || {});

  // Persistir datos del patch
  await reclamosStore.actualizarReclamo(reclamo.id, {
    cliente: merged.cliente,
    viaje_ref: merged.viaje_ref,
    remito_ref: merged.remito_ref,
    pedido_ref: merged.pedido_ref,
    motivo: merged.motivo,
    criticidad: merged.criticidad,
    detalle: merged.detalle,
    resumen: merged.resumen,
  });

  let estadoFinal = "recolectando";
  if (turno.accion === "cancelar") {
    await reclamosStore.actualizarReclamo(reclamo.id, {
      estado: "resuelto",
      resumen: merged.resumen || "Cancelado por el cliente",
      historial_push: `${now} · Cancelado por el cliente`,
    });
    estadoFinal = "resuelto";
  } else if (turno.accion === "abrir_caso" || turno.accion === "escalar") {
    const escalar = turno.accion === "escalar" || merged.criticidad === "alta";
    reclamo = await reclamosStore.abrirCasoDesdeDialogo(reclamo.id, {
      motivo: merged.motivo || "otro",
      criticidad: merged.criticidad || (escalar ? "alta" : "media"),
      resumen: merged.resumen || merged.detalle || t.slice(0, 180),
      detalle: merged.detalle || t,
      viaje_ref: merged.viaje_ref,
      remito_ref: merged.remito_ref,
      pedido_ref: merged.pedido_ref,
      escalar,
      escalado_a: turno.escalado_a || (escalar ? "Coordinación operativa" : null),
    });
    estadoFinal = reclamo?.estado || (escalar ? "escalado" : "nuevo");
  }

  const mensaje = turno.mensaje;
  await reclamosStore.actualizarReclamo(reclamo.id, {
    mensaje_push: { dir: "out", texto: mensaje, at: new Date().toISOString() },
  });

  const fresh = await reclamosStore.getReclamo(reclamo.id);

  log?.info?.(
    {
      id: fresh?.id,
      accion: turno.accion,
      motivo: fresh?.motivo,
      criticidad: fresh?.criticidad,
      estado: fresh?.estado,
      fuente: turno.fuente,
    },
    "Reclamo WA turno",
  );

  return {
    flow:
      turno.accion === "abrir_caso" || turno.accion === "escalar"
        ? "reclamo_abierto"
        : turno.accion === "cancelar"
          ? "reclamo_cancelado"
          : "reclamo_dialogo",
    reclamo: fresh,
    mensaje,
    message: mensaje,
    accion: turno.accion,
    estado: estadoFinal,
    motivoLabel: fresh?.motivo ? labelMotivo(fresh.motivo) : null,
    criticidadLabel: fresh?.criticidad ? labelCriticidad(fresh.criticidad) : null,
  };
}

export function mensajeDecisionReclamo(row) {
  if (!row) return null;
  const motivo = row.motivo ? labelMotivo(row.motivo) : "tu reclamo";
  if (row.estado === "resuelto") {
    return (
      `✅ Tu reclamo *${row.id}* (${motivo}) quedó *resuelto*.` +
      (row.nota_interna ? `\nNota: ${row.nota_interna}` : "") +
      `\nSi necesitás algo más, escribime por acá.`
    );
  }
  if (row.estado === "escalado") {
    return (
      `Subí la prioridad de tu reclamo *${row.id}*.` +
      (row.escalado_a ? ` Ya está con *${row.escalado_a}*.` : "") +
      ` Te aviso en cuanto haya novedades.`
    );
  }
  if (row.estado === "en_proceso") {
    return `Seguimos trabajando en tu reclamo *${row.id}* (${motivo}). Te mantengo al tanto.`;
  }
  return null;
}
