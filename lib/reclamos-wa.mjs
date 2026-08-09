/**
 * Agente WhatsApp de Reclamos (clientes) — diálogo 100% IA, humanizado.
 * Sin heurísticas de comprensión: el LLM entiende, clasifica y conversa.
 * El store solo persiste; no se “adivinan” viajes ni se inventan resoluciones.
 */
import {
  codigoVisible,
  extractCodigoReclamo,
  labelCriticidad,
  labelEstadoReclamo,
  labelMotivo,
  motivoRequiereFoto,
  pareceConsultaEstadoReclamo,
  RECLAMO_CRITICIDADES,
  RECLAMO_MOTIVOS,
  RECLAMO_MOTIVOS_REQUIEREN_FOTO,
} from "./reclamos.mjs";
import * as reclamosStore from "../backend/src/db/reclamos-store.mjs";
import { persistChatMedia } from "../backend/src/services/chat-media.mjs";
import { sanitizePhone } from "./builderbot-webhook.mjs";

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
    tiene_foto: Boolean(row.imagen_url),
    requiere_foto: motivoRequiereFoto(row.motivo),
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
function tieneMinimoParaAbrir(datos, { tieneFoto = false } = {}) {
  const hayRef = Boolean(datos.viaje_ref || datos.remito_ref || datos.pedido_ref);
  const hayQuePaso = Boolean(datos.detalle && String(datos.detalle).trim().length >= 12);
  const hayMotivo = Boolean(datos.motivo);
  if (!(hayQuePaso && (hayRef || hayMotivo))) return false;
  if (motivoRequiereFoto(datos.motivo) && !tieneFoto) return false;
  return true;
}

function mensajePedirFotoProducto(motivo) {
  if (motivo === "producto_equivocado") {
    return (
      "Para avanzar necesito una *foto del producto que te llegó* (que se vea bien qué es), " +
      "así lo contrastamos con lo pedido. ¿Me la mandás por acá?"
    );
  }
  return (
    "Para avanzar necesito una *foto del producto y del daño* (que se vea claro), " +
    "así el equipo lo revisa bien. ¿Me la mandás por acá?"
  );
}

const FRASE_AGENTE_CONTACTA =
  "Un agente te va a contactar por este medio para seguirlo.";

function mensajeCasoAbierto(row, { escalado = false } = {}) {
  const codigo = codigoVisible(row);
  const motivo = row?.motivo ? labelMotivo(row.motivo) : "tu consulta";
  const cabeza = escalado
    ? `Listo, prioricé tu caso *${codigo}* (${motivo}).`
    : `Listo, abrí tu caso *${codigo}* (${motivo}).`;
  return (
    `${cabeza}\n` +
    `${FRASE_AGENTE_CONTACTA}\n` +
    `Si querés consultar el estado, escribí el número (*${codigo}*) o pedime *estado de mi reclamo*.`
  );
}

function asegurarCodigoYAgenteEnMensaje(mensaje, row, { escalado = false } = {}) {
  const codigo = codigoVisible(row);
  let msg = String(mensaje || "").trim();
  if (!msg) return mensajeCasoAbierto(row, { escalado });

  // Reemplazar IDs internos RID-… por el código público
  if (row?.id && msg.includes(row.id)) {
    msg = msg.split(row.id).join(codigo);
  }
  if (codigo && codigo !== "—" && !msg.toUpperCase().includes(String(codigo).toUpperCase())) {
    msg = `${msg}\n\nNúmero de caso: *${codigo}*`;
  }
  if (!/agente\s+te\s+va\s+a\s+contactar|te\s+va\s+a\s+contactar\s+un\s+agente/i.test(msg)) {
    msg = `${msg}\n${FRASE_AGENTE_CONTACTA}`;
  }
  return msg;
}

/**
 * Consulta de estado por código o por teléfono (casos abiertos).
 */
export async function consultarEstadoReclamoWhatsApp({
  telefono,
  texto,
  log = null,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto || "").trim();
  const codigo = extractCodigoReclamo(t);

  let row = null;
  if (codigo) {
    row = await reclamosStore.getReclamo(codigo);
    if (row && phone && row.telefono && row.telefono !== phone) {
      // Privacidad: no filtrar datos de otro número
      log?.info?.({ codigo, phone }, "Reclamo consulta: código de otro teléfono");
      row = null;
    }
  }
  if (!row && phone) {
    const activos = await reclamosStore.listReclamosActivosPorTelefono(phone);
    if (activos.length === 1) {
      row = activos[0];
    } else if (activos.length > 1) {
      const lista = activos
        .slice(0, 5)
        .map(
          (r) =>
            `• *${codigoVisible(r)}* — ${r.motivo ? labelMotivo(r.motivo) : "Reclamo"} · ${labelEstadoReclamo(r.estado)}`,
        )
        .join("\n");
      const mensaje =
        `Tenés *${activos.length}* casos abiertos:\n${lista}\n\n` +
        `Pasame el número de caso (ej. *${codigoVisible(activos[0])}*) y te digo cómo va.\n` +
        FRASE_AGENTE_CONTACTA;
      return {
        flow: "reclamo_consulta",
        reclamo: null,
        mensaje,
        message: mensaje,
        accion: "consulta_multi",
        estado: "consulta",
      };
    } else {
      // Último caso del teléfono (incluye resueltos)
      const recientes = await reclamosStore.listReclamos({
        telefono: phone,
        limit: 5,
        estado: "todos",
      });
      row = recientes[0] || null;
    }
  }

  if (!row) {
    const mensaje = codigo
      ? `No encontré el caso *${codigo}* asociado a este WhatsApp. Si lo abriste con otro número, escribime desde ahí.\n` +
        `Si querés abrir uno nuevo, contame qué pasó.`
      : `No tengo un reclamo abierto con este número.\n` +
        `Si querés abrir uno, contame qué pasó con la entrega (y el nro de viaje/remito si lo tenés).`;
    return {
      flow: "reclamo_consulta",
      reclamo: null,
      mensaje,
      message: mensaje,
      accion: "consulta_sin_caso",
      estado: "consulta",
    };
  }

  const cod = codigoVisible(row);
  const motivo = row.motivo ? labelMotivo(row.motivo) : "tu reclamo";
  const estado = labelEstadoReclamo(row.estado);
  let mensaje;
  if (row.estado === "resuelto") {
    mensaje =
      `Tu caso *${cod}* (${motivo}) está *resuelto*.` +
      (row.nota_interna ? `\nNota: ${row.nota_interna}` : "") +
      `\nSi necesitás algo más, escribime por acá.`;
  } else if (row.estado === "escalado") {
    mensaje =
      `Tu caso *${cod}* (${motivo}) está *escalado*` +
      (row.escalado_a ? ` con *${row.escalado_a}*` : "") +
      `.\n${FRASE_AGENTE_CONTACTA}`;
  } else if (row.estado === "en_proceso") {
    mensaje =
      `Tu caso *${cod}* (${motivo}) está *en proceso*.\n` + FRASE_AGENTE_CONTACTA;
  } else {
    mensaje =
      `Tu caso *${cod}* (${motivo}) está *${estado.toLowerCase()}*.\n` +
      FRASE_AGENTE_CONTACTA;
  }

  log?.info?.({ id: row.id, codigo: cod, estado: row.estado }, "Reclamo consulta estado");

  return {
    flow: "reclamo_consulta",
    reclamo: row,
    mensaje,
    message: mensaje,
    accion: "consulta_estado",
    estado: row.estado,
    motivoLabel: row.motivo ? labelMotivo(row.motivo) : null,
    criticidadLabel: row.criticidad ? labelCriticidad(row.criticidad) : null,
  };
}

/**
 * Un turno de diálogo con el cliente.
 */
export async function turnoAgenteReclamos({
  texto,
  reclamo,
  hechosViaje = null,
  tieneFotoNueva = false,
  log = null,
} = {}) {
  const datos = datosActuales(reclamo);
  const tieneFoto = Boolean(datos.tiene_foto || tieneFotoNueva);
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
1) Entender qué pasó.
2) Identificar viaje / remito / pedido si el cliente lo tiene (no inventes códigos).
3) Clasificar motivo y criticidad (alta/media/baja).
4) FOTO — REGLA CRÍTICA:
   - Pedí foto SOLO si el motivo es *averia* (producto dañado/roto/golpeado) O *producto_equivocado* (llegó otro producto / incorrecto).
   - En esos casos pedí foto del producto (y del daño si aplica) con accion=pedir_foto, y NO abras el caso hasta tenerla.
   - En CUALQUIER otro motivo (demora, faltante, documentación, trato, otro): NUNCA pidas foto.
5) Cuando tengas lo mínimo (y la foto si aplica), ABRIR el caso.
   El sistema asignará un número tipo RC-YYYYMMDD-0001-PD (PD dañado, RT retraso, PE equivocado, FA faltante, DO docs, TR trato, OT otros).
   En el mensaje al cliente: incluí ese número cuando te lo pasen en CASO_CODIGO_PUBLICO, y SIEMPRE decí que un agente lo va a contactar.
6) Si es criticidad alta o el cliente está muy urgido/enojado → escalar a coordinación.

REGLAS DURAS:
- NUNCA inventes estado del viaje, ETA, TMS, tracking, compensaciones, culpas ni "ya salió el camión".
- Si hay HECHOS_VIAJE, podés usarlos; si no, no inventes.
- No pidas de golpe una lista robótica. Máximo 1–2 preguntas naturales por turno.
- Si el cliente ya dio datos, NO los vuelvas a pedir.
- Si el cliente mandó foto (TIENE_FOTO=true), reconocelo con naturalidad; no vuelvas a pedir foto.
- Motivos que requieren foto: ${RECLAMO_MOTIVOS_REQUIEREN_FOTO.join(" | ")}
- Si aún falta lo esencial, accion=pedir_datos.
- Si falta la foto y el motivo la requiere, accion=pedir_foto.
- Si ya alcanza para abrir: accion=abrir_caso (o accion=escalar).
- Si el cliente solo saluda o desvía: accion=chitchat.
- Si cancela: accion=cancelar.
- Mensaje corto (WhatsApp), *negritas* con moderación, sin JSON en el mensaje.

MOTIVOS VÁLIDOS: ${RECLAMO_MOTIVOS.join(" | ")}
CRITICIDADES: ${RECLAMO_CRITICIDADES.join(" | ")}

CASO_ID_INTERNO: ${reclamo.id}
CASO_CODIGO_PUBLICO: ${reclamo.codigo || "(se asigna al abrir)"}
ESTADO_DIALOGO: ${reclamo.estado}
TIENE_FOTO: ${tieneFoto}
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
    "motivo": "demora_entrega"|"faltante"|"averia"|"producto_equivocado"|"documentacion"|"trato"|"otro"|null,
    "criticidad": "alta"|"media"|"baja"|null,
    "detalle": string|null,
    "resumen": string|null
  },
  "accion": "pedir_datos"|"pedir_foto"|"abrir_caso"|"escalar"|"chitchat"|"cancelar",
  "escalado_a": string|null,
  "mensaje": string,
  "confianza": number
}

datos_patch: solo lo que este mensaje aporte con certeza (si dudás → null).
mensaje: lo que vas a enviar al cliente (humano). Si abrís/escalás, mencioná que un agente lo contactará; el sistema completará el número de caso.`;

  try {
    const parsed = await callLlmJson(prompt, { log });
    if (!parsed) throw new Error("IA sin JSON");

    const patch = parsed.datos_patch && typeof parsed.datos_patch === "object" ? parsed.datos_patch : {};
    let accion = String(parsed.accion || "pedir_datos").toLowerCase().trim();
    const merged = mergePatch(reclamo, patch);
    merged.tiene_foto = tieneFoto;
    merged.requiere_foto = motivoRequiereFoto(merged.motivo);

    // Guardrails de negocio
    if ((accion === "abrir_caso" || accion === "escalar") && !tieneMinimoParaAbrir(merged, { tieneFoto })) {
      accion = motivoRequiereFoto(merged.motivo) && !tieneFoto ? "pedir_foto" : "pedir_datos";
    }
    if (accion === "pedir_foto" && !motivoRequiereFoto(merged.motivo)) {
      // Nunca pedir foto en demora/faltante/etc.
      accion = tieneMinimoParaAbrir(merged, { tieneFoto }) ? "abrir_caso" : "pedir_datos";
    }
    if (motivoRequiereFoto(merged.motivo) && !tieneFoto && accion !== "cancelar" && accion !== "chitchat") {
      if (tieneMinimoParaAbrir({ ...merged, motivo: merged.motivo }, { tieneFoto: true }) || merged.detalle) {
        // Ya entendimos el caso de daño/equivocado → pedir foto antes de abrir
        if (accion === "abrir_caso" || accion === "escalar" || accion === "pedir_datos") {
          accion = "pedir_foto";
        }
      }
    }

    let mensaje = String(parsed.mensaje || "").trim();
    if (!mensaje) {
      if (accion === "pedir_foto") mensaje = mensajePedirFotoProducto(merged.motivo);
      else if (accion === "abrir_caso" || accion === "escalar") {
        mensaje = mensajeCasoAbierto(
          { ...reclamo, motivo: merged.motivo, codigo: reclamo.codigo },
          { escalado: accion === "escalar" },
        );
      } else {
        mensaje =
          "Contame un poco más qué pasó y, si tenés el *número de viaje o remito*, pasámelo así lo ubico al toque.";
      }
    }
    if (accion === "pedir_foto" && !/foto/i.test(mensaje)) {
      mensaje = `${mensaje}\n\n${mensajePedirFotoProducto(merged.motivo)}`;
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
    const merged = { ...datos, tiene_foto: tieneFoto };
    if (motivoRequiereFoto(merged.motivo) && !tieneFoto) {
      return {
        datos_patch: {},
        accion: "pedir_foto",
        mensaje: mensajePedirFotoProducto(merged.motivo),
        fuente: "fallback_blando",
        confianza: 0,
        merged,
      };
    }
    return {
      datos_patch: {},
      accion: "pedir_datos",
      mensaje:
        "Perdón, se me trabó un segundo. ¿Me contás de nuevo qué pasó con la entrega? Si tenés el nro de viaje o remito, mejor.",
      fuente: "fallback_blando",
      confianza: 0,
      merged,
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
 * Orquestación WhatsApp: continúa diálogo, consulta estado o abre caso.
 */
export async function procesarReclamoWhatsApp({
  telefono,
  texto,
  nombre,
  log,
  forzar = false,
  imageBuffer = null,
  mime = null,
  imagenUrl = null,
} = {}) {
  const t = String(texto || "").trim();
  const tieneMedia = Boolean(imageBuffer?.length || imagenUrl);
  if (!telefono || (!t && !tieneMedia && !forzar)) return null;

  let reclamo = await reclamosStore.getReclamoPendientePorTelefono(telefono);

  // Sin diálogo abierto: consulta de estado (código o "cómo va mi reclamo")
  if (
    !reclamo &&
    !tieneMedia &&
    t &&
    (extractCodigoReclamo(t) || pareceConsultaEstadoReclamo(t))
  ) {
    return consultarEstadoReclamoWhatsApp({ telefono, texto: t, log });
  }

  if (!reclamo) {
    reclamo = await reclamosStore.crearReclamoDialogo({
      telefono,
      nombre,
    });
  }

  let imagenPersistida = imagenUrl || reclamo.imagen_url || null;
  if (imageBuffer?.length) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    if (saved?.publicUrl) imagenPersistida = saved.publicUrl;
  }

  const now = new Date().toISOString();
  const textoIn =
    t ||
    (tieneMedia
      ? "[Foto del producto / daño]"
      : "");
  await reclamosStore.actualizarReclamo(reclamo.id, {
    nombre: nombre || reclamo.nombre,
    imagen_url: imagenPersistida || undefined,
    mensaje_push: {
      dir: "in",
      texto: textoIn,
      at: now,
      imagen_url: imagenPersistida || null,
    },
    historial_push: imagenPersistida && !reclamo.imagen_url
      ? `${now} · Foto recibida`
      : undefined,
  });
  reclamo = (await reclamosStore.getReclamo(reclamo.id)) || reclamo;

  const hechosViaje = await enriquecerHechosViaje(
    reclamo.viaje_ref || null,
    log,
  );

  const turno = await turnoAgenteReclamos({
    texto: textoIn,
    reclamo,
    hechosViaje,
    tieneFotoNueva: Boolean(imagenPersistida),
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
    imagen_url: imagenPersistida || reclamo.imagen_url || undefined,
  });

  let estadoFinal = "recolectando";
  let abrioCaso = false;
  let escaladoFinal = false;
  if (turno.accion === "cancelar") {
    await reclamosStore.actualizarReclamo(reclamo.id, {
      estado: "resuelto",
      resumen: merged.resumen || "Cancelado por el cliente",
      historial_push: `${now} · Cancelado por el cliente`,
    });
    estadoFinal = "resuelto";
  } else if (turno.accion === "abrir_caso" || turno.accion === "escalar") {
    const escalar = turno.accion === "escalar" || merged.criticidad === "alta";
    const fotoOk = Boolean(imagenPersistida || reclamo.imagen_url);
    if (
      !tieneMinimoParaAbrir(
        { ...merged },
        { tieneFoto: fotoOk },
      )
    ) {
      // No abrir: pedir foto o datos
      turno.accion = motivoRequiereFoto(merged.motivo) && !fotoOk ? "pedir_foto" : "pedir_datos";
      if (turno.accion === "pedir_foto") {
        turno.mensaje = mensajePedirFotoProducto(merged.motivo);
      }
    } else {
      reclamo = await reclamosStore.abrirCasoDesdeDialogo(reclamo.id, {
        motivo: merged.motivo || "otro",
        criticidad: merged.criticidad || (escalar ? "alta" : "media"),
        resumen: merged.resumen || merged.detalle || t.slice(0, 180),
        detalle: merged.detalle || t,
        viaje_ref: merged.viaje_ref,
        remito_ref: merged.remito_ref,
        pedido_ref: merged.pedido_ref,
        imagen_url: imagenPersistida || reclamo.imagen_url || null,
        escalar,
        escalado_a: turno.escalado_a || (escalar ? "Coordinación operativa" : null),
      });
      estadoFinal = reclamo?.estado || (escalar ? "escalado" : "nuevo");
      abrioCaso = true;
      escaladoFinal = Boolean(escalar);
      turno.accion = escalar ? "escalar" : "abrir_caso";
    }
  }

  let mensaje = turno.mensaje;
  if (abrioCaso && reclamo) {
    mensaje = asegurarCodigoYAgenteEnMensaje(mensaje, reclamo, {
      escalado: escaladoFinal,
    });
  }

  await reclamosStore.actualizarReclamo(reclamo.id, {
    mensaje_push: { dir: "out", texto: mensaje, at: new Date().toISOString() },
  });

  const fresh = await reclamosStore.getReclamo(reclamo.id);

  log?.info?.(
    {
      id: fresh?.id,
      codigo: fresh?.codigo,
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
        : turno.accion === "pedir_foto"
          ? "reclamo_pedir_foto"
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
  const codigo = codigoVisible(row);
  const motivo = row.motivo ? labelMotivo(row.motivo) : "tu reclamo";
  if (row.estado === "resuelto") {
    return (
      `✅ Tu caso *${codigo}* (${motivo}) quedó *resuelto*.` +
      (row.nota_interna ? `\nNota: ${row.nota_interna}` : "") +
      `\nSi necesitás algo más, escribime por acá.`
    );
  }
  if (row.estado === "escalado") {
    return (
      `Subí la prioridad de tu caso *${codigo}*.` +
      (row.escalado_a ? ` Ya está con *${row.escalado_a}*.` : "") +
      `\n${FRASE_AGENTE_CONTACTA}`
    );
  }
  if (row.estado === "en_proceso") {
    return (
      `Seguimos trabajando en tu caso *${codigo}* (${motivo}).\n` +
      FRASE_AGENTE_CONTACTA
    );
  }
  return null;
}
