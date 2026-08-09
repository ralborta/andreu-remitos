import { pareceSolicitudViaje } from "../../../lib/viajes-solicitud.mjs";
import {
  camposFaltantes,
  esConfirmacionChofer,
  esRechazoChofer,
  interpretarMensajeViaje,
  mensajePedirDatos,
  mensajeViajeAsignadoChofer,
  mensajeViajeAsignadoCliente,
} from "../../../lib/viajes-agente.mjs";
import { asignarDesdeFlota, normalizarFechaRetiro } from "./viajes-flota.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import * as solStore from "../db/viajes-solicitudes-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import * as convStore from "../db/conversations-store.mjs";

const ESTADOS_ACTIVOS = new Set(["solicitado", "confirmado", "asignado", "en_curso"]);

async function enviar(phone, mensaje, meta = {}) {
  const p = sanitizePhone(phone);
  if (!p || !mensaje?.trim()) return;
  await sendWhatsAppMessage({ number: p, message: mensaje });
  await convStore.appendMensaje(
    p,
    { texto: mensaje, tipo: "text", viaje_id: meta.viaje_id ?? null },
    {
      dir: "out",
      from: "bot",
      agente: "viajes",
      nombre: meta.nombre ?? null,
    },
  );
}

async function viajesActivosParaAsignacion() {
  const rows = await viajesStore.listViajes({ limit: 200 });
  return rows.filter((r) => ESTADOS_ACTIVOS.has(r.estado));
}

/**
 * Entrada conversacional WhatsApp (recolecta datos → asigna → confirma).
 */
export async function procesarMensajeViajeWhatsApp({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone || !t) return null;

  // ¿Chofer respondiendo confirmación de un viaje asignado?
  const solChofer = await solStore.getSolicitudPendientePorTelefono(phone);
  if (solChofer?.estado === "esperando_confirmacion_chofer") {
    return procesarConfirmacionChofer(solChofer, { texto: t, log });
  }

  let pending = await solStore.getSolicitudPendientePorTelefono(phone);
  const parece = pareceSolicitudViaje(t);

  if (!pending && !parece) return null;

  await convStore.appendMensaje(
    phone,
    { texto: t, tipo: "text" },
    { dir: "in", from: "client", nombre, agente: "viajes" },
  );

  if (!pending) {
    pending = await solStore.crearSolicitud({
      telefono: phone,
      nombre: nombre || null,
    });
  }

  const interpreted = await interpretarMensajeViaje(t, {
    pendingDatos: pending.datos,
    remitente: nombre || pending.nombre || "Cliente WhatsApp",
    log,
  });

  pending = await solStore.actualizarSolicitud(pending.id, {
    datos: interpreted.datos,
    nombre: nombre || pending.nombre,
    historial_push: `${new Date().toISOString()} · Datos (${interpreted.fuente}): ${t.slice(0, 120)}`,
  });

  const faltan = camposFaltantes(pending.datos);
  if (faltan.length) {
    const primera = (pending.historial?.length ?? 0) <= 2;
    const mensaje = mensajePedirDatos(faltan, { datos: pending.datos, primera });
    await enviar(phone, mensaje, { nombre });
    await solStore.actualizarSolicitud(pending.id, {
      historial_push: `${new Date().toISOString()} · Pedí datos: ${faltan.join(", ")}`,
    });
    return {
      flow: "viajes_recolectando",
      solicitud: pending,
      faltan,
      mensaje,
    };
  }

  // Datos completos → match + asignar
  return finalizarAsignacion(pending, { telefonoCliente: phone, log });
}

async function finalizarAsignacion(pending, { telefonoCliente, log } = {}) {
  const datos = pending.datos;
  const fechaIso = normalizarFechaRetiro(datos.fecha_retiro);
  const activos = await viajesActivosParaAsignacion();
  const asignacion = asignarDesdeFlota({
    toneladas: datos.toneladas ?? 20,
    tipo_carga: datos.tipo_carga,
    fecha_retiro: fechaIso,
    viajesActivos: activos,
  });

  if (!asignacion.ok) {
    const msg =
      `Tengo todos los datos pero *no encontré transporte disponible*.\n\n` +
      `${asignacion.error}\n\n` +
      `¿Querés probar otra fecha o tipo de carga?`;
    await enviar(telefonoCliente, msg);
    await solStore.actualizarSolicitud(pending.id, {
      historial_push: `${new Date().toISOString()} · Sin flota: ${asignacion.error}`,
    });
    return { flow: "viajes_sin_flota", solicitud: pending, error: asignacion.error, mensaje: msg };
  }

  let viaje = await viajesStore.crearViaje({
    cliente: datos.cliente || pending.nombre || "Cliente WhatsApp",
    origen: datos.origen,
    destino: datos.destino,
    carga: datos.carga || `${datos.tipo_carga} ${datos.toneladas} t`,
    fecha: fechaIso,
    telefono_cliente: telefonoCliente || null,
    notas: [
      datos.notas,
      `tipo_carga=${datos.tipo_carga}`,
      `solicitud=${pending.id}`,
      `canal=whatsapp`,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  viaje = await viajesStore.cambiarEstadoViaje(viaje.id, "confirmado");
  viaje = await viajesStore.actualizarViaje(viaje.id, {
    chofer: asignacion.chofer,
    telefono_chofer: asignacion.telefono_chofer,
    tractor: asignacion.tractor,
    semi: asignacion.semi,
  });
  viaje = await viajesStore.cambiarEstadoViaje(viaje.id, "asignado");

  const msgCliente = mensajeViajeAsignadoCliente(viaje, asignacion);
  await enviar(telefonoCliente, msgCliente, { viaje_id: viaje.id });

  let msgChofer = null;
  if (asignacion.telefono_chofer) {
    msgChofer = mensajeViajeAsignadoChofer(viaje, asignacion);
    await enviar(asignacion.telefono_chofer, msgChofer, { viaje_id: viaje.id });
  }

  await solStore.actualizarSolicitud(pending.id, {
    estado: asignacion.telefono_chofer ? "esperando_confirmacion_chofer" : "asignada",
    viaje_id: viaje.id,
    // Para que el chofer responda, movemos el pending “lógico” al teléfono del chofer:
    historial_push: `${new Date().toISOString()} · Asignado ${viaje.codigo} → ${asignacion.chofer}`,
  });

  // Duplicar solicitud en estado espera bajo teléfono del chofer
  if (asignacion.telefono_chofer) {
    const solChofer = await solStore.crearSolicitud({
      telefono: asignacion.telefono_chofer,
      nombre: asignacion.chofer,
      datos: pending.datos,
    });
    await solStore.actualizarSolicitud(solChofer.id, {
      estado: "esperando_confirmacion_chofer",
      viaje_id: viaje.id,
      historial_push: `${new Date().toISOString()} · Esperando confirmación chofer`,
    });
    // Cerrar la del cliente
    await solStore.actualizarSolicitud(pending.id, {
      estado: "asignada",
    });
  }

  log?.info?.(
    {
      codigo: viaje.codigo,
      chofer: viaje.chofer,
      tipo: asignacion.tipo_unidad,
      fecha: fechaIso,
    },
    "Viaje asignado (agente conversacional)",
  );

  return {
    flow: "viajes_asignado",
    viaje,
    asignacion,
    mensaje: msgCliente,
    mensaje_chofer: msgChofer,
  };
}

async function procesarConfirmacionChofer(solChofer, { texto, log } = {}) {
  const phone = solChofer.telefono;
  await convStore.appendMensaje(
    phone,
    { texto, tipo: "text", viaje_id: solChofer.viaje_id },
    { dir: "in", from: "chofer", agente: "viajes" },
  );

  const viaje = solChofer.viaje_id ? await viajesStore.getViaje(solChofer.viaje_id) : null;

  if (esConfirmacionChofer(texto)) {
    if (viaje) {
      await viajesStore.cambiarEstadoViaje(viaje.id, "en_curso").catch(() => null);
    }
    const msg =
      `Gracias ✅ Viaje *${viaje?.codigo ?? ""}* confirmado.\n` +
      `Buen viaje. Si hay demora, avisá por acá.`;
    await enviar(phone, msg, { viaje_id: viaje?.id });

    if (viaje?.telefono_cliente) {
      const msgCli =
        `🚚 El chofer *${viaje.chofer}* confirmó el viaje *${viaje.codigo}*.\n` +
        `Ya está en curso: ${viaje.origen} → ${viaje.destino}.`;
      await enviar(viaje.telefono_cliente, msgCli, { viaje_id: viaje.id });
    }

    await solStore.actualizarSolicitud(solChofer.id, {
      estado: "confirmada_chofer",
      historial_push: `${new Date().toISOString()} · Chofer confirmó`,
    });

    log?.info?.({ codigo: viaje?.codigo }, "Chofer confirmó viaje");
    return { flow: "viajes_chofer_confirmado", viaje, mensaje: msg };
  }

  if (esRechazoChofer(texto)) {
    const msg =
      `Entendido. Marco que no podés tomar el viaje` +
      (viaje ? ` *${viaje.codigo}*` : "") +
      `.\nTráfico lo reasignará.`;
    await enviar(phone, msg, { viaje_id: viaje?.id });
    if (viaje) {
      await viajesStore.actualizarViaje(viaje.id, {
        chofer: null,
        telefono_chofer: null,
        notas: `${viaje.notas || ""} · Chofer rechazó`,
      });
    }
    await solStore.actualizarSolicitud(solChofer.id, {
      estado: "rechazada_chofer",
      historial_push: `${new Date().toISOString()} · Chofer rechazó`,
    });
    return { flow: "viajes_chofer_rechazo", viaje, mensaje: msg };
  }

  const msg =
    `Para el viaje` +
    (viaje ? ` *${viaje.codigo}*` : "") +
    ` respondé *SÍ* para confirmar o *NO* si no podés.`;
  await enviar(phone, msg, { viaje_id: viaje?.id });
  return { flow: "viajes_pedir_confirmacion_chofer", viaje, mensaje: msg };
}

/**
 * Compat: ingest one-shot (email / API) — exige datos completos o falla.
 */
export async function procesarSolicitudViaje(input) {
  const { log } = input;
  const phone = sanitizePhone(input.telefono);
  const interpreted = await interpretarMensajeViaje(input.texto, {
    remitente: input.remitente,
    log,
  });
  const faltan = interpreted.faltan;
  if (faltan.length) {
    throw Object.assign(
      new Error(`Faltan datos: ${faltan.join(", ")}`),
      { statusCode: 422, faltan, datos: interpreted.datos },
    );
  }

  // Crear solicitud sintética y asignar
  const pending = await solStore.crearSolicitud({
    telefono: phone || "0000000000",
    nombre: input.remitente,
    datos: interpreted.datos,
  });
  const out = await finalizarAsignacion(pending, {
    telefonoCliente: phone,
    log,
  });
  return {
    ok: true,
    viaje: out.viaje,
    parsed: interpreted.datos,
    asignacion: out.asignacion,
    mensajes: [
      out.mensaje && { destino: "cliente", texto: out.mensaje },
      out.mensaje_chofer && { destino: "chofer", texto: out.mensaje_chofer },
    ].filter(Boolean),
  };
}
