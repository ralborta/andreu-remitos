import {
  interpretarIncidenciaWhatsApp,
  mensajeCierreSinRespuesta,
  mensajeConfirmacionIncidencia,
  mensajePedirCausaIncidencia,
  mensajeRecordatorioParada,
  pareceIncidenciaEnRuta,
} from "../../../lib/incidencias-wa.mjs";
import * as incidenciasStore from "../db/incidencias-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as master from "../db/master-data-store.mjs";
import { getChoferViajesPorTelefono } from "../db/viajes-flota-store.mjs";
import { persistChatMedia } from "./chat-media.mjs";

/**
 * Incidencias usan la flota de Gestión de Viajes (principal).
 * Fallback: choferes de Remitos/Parámetros.
 */
export async function resolverChoferIncidencia(telefono) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;
  const flota = getChoferViajesPorTelefono(phone);
  if (flota) {
    return {
      nombre: flota.nombre || null,
      telefono: flota.telefono || phone,
      fuente: "viajes_flota",
    };
  }
  const remitos = await master.resolverChoferPorTelefono(phone);
  if (remitos) {
    return {
      nombre: remitos.nombre || null,
      telefono: remitos.telefono || phone,
      fuente: "remitos",
    };
  }
  return null;
}

export async function telefonoEsChoferIncidencia(telefono) {
  return Boolean(await resolverChoferIncidencia(telefono));
}

/** @deprecated usar telefonoEsChoferIncidencia */
export async function telefonoEsChoferRegistrado(telefono) {
  return telefonoEsChoferIncidencia(telefono);
}

export function mensajeIncidenciaSoloChoferes() {
  return (
    `Las *incidencias en ruta* son para *choferes de la flota de Viajes*.\n\n` +
    `Si sos cliente y tenés un problema con una entrega, pedime abrir un *reclamo*.`
  );
}

async function enviar(phone, mensaje, meta = {}) {
  const p = sanitizePhone(phone);
  if (!p || !mensaje?.trim()) return;
  await sendWhatsAppMessage({ number: p, message: mensaje });
  await convStore.appendMensaje(
    p,
    { texto: mensaje, tipo: "text", incidencia_id: meta.incidencia_id ?? null },
    { dir: "out", from: "bot", agente: "incidencias", nombre: meta.nombre ?? null },
  );
}

/**
 * Agente pregunta al chofer (simula detección GPS / backoffice).
 */
export async function consultarChoferIncidencia({
  telefono,
  tipo,
  viaje_ref,
  lat,
  lng,
  direccion,
  nota,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) throw Object.assign(new Error("Teléfono inválido"), { statusCode: 400 });

  const chofer = await resolverChoferIncidencia(phone);
  if (!chofer) {
    throw Object.assign(
      new Error(
        "El teléfono no está en la flota de Viajes (Gestión de Viajes → Choferes). Usá p. ej. Raúl 5491133788190.",
      ),
      { statusCode: 400 },
    );
  }

  const latN = lat != null && Number.isFinite(Number(lat)) ? Number(lat) : null;
  const lngN = lng != null && Number.isFinite(Number(lng)) ? Number(lng) : null;
  const dir = direccion ? String(direccion).trim() : null;

  const hist = [];
  if (dir) hist.push(`Ubicación: ${dir}`);
  if (latN != null && lngN != null) hist.push(`Coords: ${latN}, ${lngN}`);
  if (nota) hist.push(`Nota operativa: ${nota}`);
  hist.push(`Chofer flota: ${chofer.fuente}`);

  const row = await incidenciasStore.crearIncidencia({
    telefono: phone,
    chofer_nombre: nombre || chofer.nombre || null,
    tipo: tipo || "parada_no_prevista",
    estado: "esperando_causa",
    origen: "agente",
    viaje_ref: viaje_ref || null,
    lat: latN,
    lng: lngN,
    resumen: dir || nota || "Parada detectada — consulta al chofer",
    historial: hist,
  });

  const msg = mensajePedirCausaIncidencia({
    tipoHint: tipo || "parada_no_prevista",
    viajeRef: viaje_ref,
    proactivo: true,
    direccion: dir,
    lat: latN,
    lng: lngN,
  });
  await enviar(phone, msg, { nombre: row.chofer_nombre, incidencia_id: row.id });

  await incidenciasStore.actualizarIncidencia(row.id, {
    mensaje_push: {
      dir: "out",
      texto: msg,
      at: new Date().toISOString(),
    },
    historial_push: `${new Date().toISOString()} · Consulta WA al chofer (parada)`,
  });

  log?.info?.({ id: row.id, phone, lat: latN, lng: lngN }, "Incidencia: consulta proactiva al chofer");
  return { incidencia: row, mensaje: msg };
}

/**
 * Registra demora reportada en Destinos también como incidencia (trazabilidad).
 */
export async function registrarDemoraDesdeDestinos({
  telefono,
  nombre,
  causa,
  viaje_ref,
  destino_id,
  eta_texto,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) return null;

  const texto = causa || (eta_texto ? `Demora / nuevo ETA: ${eta_texto}` : "Demora en ruta");
  const interp = await interpretarIncidenciaWhatsApp({ texto, log });

  const row = await incidenciasStore.crearIncidencia({
    telefono: phone,
    chofer_nombre: nombre || null,
    tipo: "demora",
    criticidad: interp.criticidad || "media",
    causa: interp.causa || texto,
    resumen: interp.resumen || texto,
    viaje_ref: viaje_ref || interp.viaje_ref || null,
    destino_id: destino_id || null,
    estado: "nueva",
    origen: "destinos_demora",
  });

  log?.info?.(
    { id: row.id, codigo: row.codigo, destino_id },
    "Incidencia creada desde demora Destinos",
  );
  return row;
}

/**
 * Procesa mensaje/foto del chofer → abre o completa incidencia.
 */
export async function procesarIncidenciaWhatsApp({
  telefono,
  texto,
  nombre,
  imageBuffer,
  mime,
  imagenUrl,
  log,
  forzar = false,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone) return null;

  const pending = await incidenciasStore.getIncidenciaPendientePorTelefono(phone);
  if (!forzar && !pending && !pareceIncidenciaEnRuta(t) && !imageBuffer) return null;

  const chofer = await resolverChoferIncidencia(phone);
  if (!chofer) {
    if (!forzar && !pending) return null;
    const msg = mensajeIncidenciaSoloChoferes();
    await enviar(phone, msg, { nombre });
    return {
      flow: "incidencia_solo_choferes",
      mensaje: msg,
      message: msg,
      bloqueado: true,
    };
  }

  let imagenPersistida = imagenUrl || null;
  if (imageBuffer?.length) {
    const saved = persistChatMedia(imageBuffer, mime || "image/jpeg");
    if (saved?.publicUrl) imagenPersistida = saved.publicUrl;
  }

  if (t || imagenPersistida || imageBuffer) {
    await convStore.appendMensaje(
      phone,
      {
        texto: t || "[Foto incidencia]",
        tipo: imageBuffer || imagenPersistida ? "image" : "text",
        imagen_url: imagenPersistida,
      },
      { dir: "in", from: "client", nombre, agente: "incidencias" },
    );
  }

  // Continuación de diálogo (agente preguntó la causa)
  if (pending) {
    if (!t && !imagenPersistida) {
      const msg = mensajePedirCausaIncidencia({
        tipoHint: pending.tipo,
        viajeRef: pending.viaje_ref,
        proactivo: pending.origen === "agente",
      });
      await enviar(phone, msg, { nombre, incidencia_id: pending.id });
      return { flow: "incidencia_pedir_causa", mensaje: msg, message: msg, incidencia: pending };
    }

    const interp = await interpretarIncidenciaWhatsApp({
      texto: t || "Foto de evidencia",
      log,
    });

    const abierta = await incidenciasStore.abrirCasoDesdeDialogo(pending.id, {
      tipo: interp.tipo || pending.tipo || "otro",
      criticidad: interp.criticidad,
      causa: interp.causa || t,
      resumen: interp.resumen,
      viaje_ref: interp.viaje_ref || pending.viaje_ref,
    });

    if (imagenPersistida) {
      await incidenciasStore.actualizarIncidencia(abierta.id, {
        imagen_url: imagenPersistida,
      });
    }

    await incidenciasStore.actualizarIncidencia(abierta.id, {
      mensaje_push: {
        dir: "in",
        texto: t || "[foto]",
        at: new Date().toISOString(),
        imagen_url: imagenPersistida,
      },
    });

    const fresh = await incidenciasStore.getIncidencia(abierta.id);
    const mensaje = mensajeConfirmacionIncidencia(fresh);
    await enviar(phone, mensaje, { nombre, incidencia_id: fresh.id });
    await incidenciasStore.actualizarIncidencia(fresh.id, {
      mensaje_push: {
        dir: "out",
        texto: mensaje,
        at: new Date().toISOString(),
      },
    });

    log?.info?.(
      { id: fresh.id, codigo: fresh.codigo, tipo: fresh.tipo, fuente: interp.fuente },
      "Incidencia: caso abierto tras consulta",
    );

    return {
      flow: "incidencia_abierta",
      incidencia: fresh,
      mensaje,
      message: mensaje,
    };
  }

  // Chofer inicia
  if (!t && !imagenPersistida) {
    const msg = mensajePedirCausaIncidencia({ proactivo: false });
    const row = await incidenciasStore.crearIncidencia({
      telefono: phone,
      chofer_nombre: nombre || chofer.nombre || null,
      estado: "esperando_causa",
      origen: "chofer",
    });
    await enviar(phone, msg, { nombre, incidencia_id: row.id });
    return { flow: "incidencia_pedir_causa", mensaje: msg, message: msg, incidencia: row };
  }

  // Si dice solo "incidencia" sin detalle → pedir causa
  if (/^\s*incidenci[ao]s?\s*$/i.test(t) && !imagenPersistida) {
    const row = await incidenciasStore.crearIncidencia({
      telefono: phone,
      chofer_nombre: nombre || chofer.nombre || null,
      estado: "esperando_causa",
      origen: "chofer",
    });
    const msg = mensajePedirCausaIncidencia({ proactivo: false });
    await enviar(phone, msg, { nombre, incidencia_id: row.id });
    await incidenciasStore.actualizarIncidencia(row.id, {
      mensaje_push: { dir: "in", texto: t, at: new Date().toISOString() },
    });
    return { flow: "incidencia_pedir_causa", mensaje: msg, message: msg, incidencia: row };
  }

  const interp = await interpretarIncidenciaWhatsApp({
    texto: t || "Foto de evidencia",
    log,
  });

  const row = await incidenciasStore.crearIncidencia({
    telefono: phone,
    chofer_nombre: nombre || chofer.nombre || null,
    tipo: interp.tipo,
    criticidad: interp.criticidad,
    causa: interp.causa || t,
    resumen: interp.resumen,
    viaje_ref: interp.viaje_ref,
    imagen_url: imagenPersistida,
    estado: "nueva",
    origen: "chofer",
    mensajes: [
      {
        dir: "in",
        texto: t || "[foto]",
        at: new Date().toISOString(),
        imagen_url: imagenPersistida,
      },
    ],
  });

  const mensaje = mensajeConfirmacionIncidencia(row);
  await enviar(phone, mensaje, { nombre, incidencia_id: row.id });
  await incidenciasStore.actualizarIncidencia(row.id, {
    mensaje_push: {
      dir: "out",
      texto: mensaje,
      at: new Date().toISOString(),
    },
  });

  log?.info?.(
    { id: row.id, codigo: row.codigo, tipo: row.tipo, fuente: interp.fuente },
    "Incidencia: registrada por chofer",
  );

  return {
    flow: "incidencia_abierta",
    incidencia: row,
    mensaje,
    message: mensaje,
  };
}

function msEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Seguimiento demo:
 * - a los ~5 min sin causa → repregunta por WA
 * - a los ~10 min sin causa → cierra incidencia
 */
export async function tickSeguimientoIncidencias({ log } = {}) {
  const recordatorioMs = msEnv("INCIDENCIAS_RECORDATORIO_MS", 5 * 60 * 1000);
  const cierreMs = msEnv("INCIDENCIAS_CIERRE_MS", 10 * 60 * 1000);
  const pending = await incidenciasStore.listIncidenciasEsperandoCausa();
  const now = Date.now();
  let recordatorios = 0;
  let cierres = 0;

  for (const row of pending) {
    const base = new Date(row.consulta_at || row.created_at || now).getTime();
    if (!Number.isFinite(base)) continue;
    const age = now - base;

    // Cierre a los ~10 min sin causa
    if (age >= cierreMs) {
      const nota = "Cerrada automáticamente por falta de respuesta del chofer";
      const closed = await incidenciasStore.actualizarIncidencia(row.id, {
        estado: "resuelta",
        cerrado_sin_respuesta: true,
        nota_interna: nota,
        historial_push: `${new Date().toISOString()} · Cierre auto sin respuesta`,
      });
      // Asignar código mínimo si no había
      if (closed && !closed.codigo) {
        await incidenciasStore.actualizarIncidencia(row.id, {
          tipo: closed.tipo || "parada_no_prevista",
          asignar_codigo: true,
          estado: "resuelta",
        });
      }
      const fresh = await incidenciasStore.getIncidencia(row.id);
      const msg = mensajeCierreSinRespuesta(fresh || closed);
      try {
        await enviar(row.telefono, msg, {
          nombre: row.chofer_nombre,
          incidencia_id: row.id,
        });
      } catch (err) {
        log?.warn?.({ err: err.message, id: row.id }, "Incidencia: fallo WA cierre auto");
      }
      await incidenciasStore.actualizarIncidencia(row.id, {
        mensaje_push: {
          dir: "out",
          texto: msg,
          at: new Date().toISOString(),
        },
      });
      cierres += 1;
      log?.info?.({ id: row.id, ageMin: Math.round(age / 60000) }, "Incidencia: cierre auto");
      continue;
    }

    // Recordatorio a los 5 min
    if (age >= recordatorioMs && !row.recordatorio_enviado_at) {
      const msg = mensajeRecordatorioParada({
        direccion: row.resumen || null,
      });
      try {
        await enviar(row.telefono, msg, {
          nombre: row.chofer_nombre,
          incidencia_id: row.id,
        });
      } catch (err) {
        log?.warn?.({ err: err.message, id: row.id }, "Incidencia: fallo WA recordatorio");
        continue;
      }
      await incidenciasStore.actualizarIncidencia(row.id, {
        recordatorio_enviado_at: new Date().toISOString(),
        mensaje_push: {
          dir: "out",
          texto: msg,
          at: new Date().toISOString(),
        },
        historial_push: `${new Date().toISOString()} · Recordatorio WA (sin respuesta)`,
      });
      recordatorios += 1;
      log?.info?.(
        { id: row.id, ageMin: Math.round(age / 60000) },
        "Incidencia: recordatorio enviado",
      );
    }
  }

  return { recordatorios, cierres, pending: pending.length };
}

let _seguimientoTimer = null;

export function startSeguimientoIncidencias(log) {
  if (_seguimientoTimer) return;
  const every = msEnv("INCIDENCIAS_POLL_MS", 30_000);
  const run = () => {
    tickSeguimientoIncidencias({ log }).catch((err) => {
      log?.warn?.({ err: err.message }, "Incidencia: tick seguimiento falló");
    });
  };
  // primer tick a los 15s (dar tiempo al boot)
  setTimeout(run, 15_000);
  _seguimientoTimer = setInterval(run, every);
  log?.info?.(
    {
      recordatorioMin: msEnv("INCIDENCIAS_RECORDATORIO_MS", 5 * 60 * 1000) / 60000,
      cierreMin: msEnv("INCIDENCIAS_CIERRE_MS", 10 * 60 * 1000) / 60000,
      pollSec: every / 1000,
    },
    "Incidencias: seguimiento auto activo (repregunta + cierre)",
  );
}
