import { pareceSolicitudViaje } from "../../../lib/viajes-solicitud.mjs";
import {
  camposFaltantes,
  esConfirmacionChofer,
  esRechazoChofer,
  mensajeConsultandoDisponibilidad,
  redactarMensajeChofer,
  redactarPropuestaDisponibilidad,
  redactarReservaConfirmada,
  turnoAgenteViajes,
} from "../../../lib/viajes-agente.mjs";
import {
  asignarDesdeFlota,
  consultarDisponibilidad,
  normalizarFechaRetiro,
  normalizarHora,
} from "./viajes-flota.mjs";
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
 * Agente IA WhatsApp: diálogo humano + hechos de flota + confirmación → reserva.
 */
export async function procesarMensajeViajeWhatsApp({
  telefono,
  texto,
  nombre,
  log,
  forzar = false,
} = {}) {
  const phone = sanitizePhone(telefono);
  const t = String(texto ?? "").trim();
  if (!phone || !t) return null;

  const solChofer = await solStore.getSolicitudPendientePorTelefono(phone);
  if (solChofer?.estado === "esperando_confirmacion_chofer") {
    return procesarConfirmacionChofer(solChofer, { texto: t, log });
  }

  let pending = await solStore.getSolicitudPendientePorTelefono(phone);
  const parece = forzar || pareceSolicitudViaje(t);
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

  const fase =
    pending.estado === "esperando_confirmacion_cliente" ? "propuesta" : "recolectando";

  const turno = await turnoAgenteViajes({
    texto: t,
    fase,
    datos: pending.datos,
    propuesta: pending.propuesta,
    remitente: nombre || pending.nombre || "Cliente WhatsApp",
    log,
  });

  pending = await solStore.actualizarSolicitud(pending.id, {
    datos: turno.datos,
    nombre: nombre || pending.nombre,
    historial_push: `${new Date().toISOString()} · Agente(${turno.fuente}/${turno.intent}): ${t.slice(0, 100)}`,
  });

  // Confirmación / selección sobre propuesta activa
  if (fase === "propuesta") {
    const opciones = pending.propuesta?.opciones ?? [];
    if (turno.accion === "reservar") {
      let elegida = pending.propuesta?.elegida || opciones[0];
      if (turno.seleccion != null && opciones[turno.seleccion - 1]) {
        elegida = opciones[turno.seleccion - 1];
      } else if (turno.seleccion != null && opciones[turno.seleccion]) {
        // por si vino 0-based
        elegida = opciones[turno.seleccion];
      }
      if (elegida) {
        return finalizarAsignacion(pending, {
          telefonoCliente: phone,
          slot: elegida,
          nombre,
          log,
        });
      }
    }

    if (turno.accion === "rechazar") {
      await enviar(phone, turno.mensaje, { nombre });
      await solStore.actualizarSolicitud(pending.id, {
        estado: "recolectando",
        propuesta: null,
        historial_push: `${new Date().toISOString()} · Cliente rechazó propuesta`,
      });
      return { flow: "viajes_propuesta_rechazada", mensaje: turno.mensaje };
    }

    // ¿Pidió otra fecha/hora? → reconsultar si ya tenemos datos completos
    const faltan = camposFaltantes(pending.datos);
    if (!faltan.length && (turno.accion === "consultar" || turno.intent === "dato")) {
      return consultarYProponer(pending, {
        telefonoCliente: phone,
        nombre,
        log,
        introIa: turno.mensaje,
      });
    }

    await enviar(phone, turno.mensaje, { nombre });
    return { flow: "viajes_propuesta_seguimiento", mensaje: turno.mensaje };
  }

  // Recolectando
  if (turno.faltan.length || turno.accion === "pedir_datos" || turno.accion === "chitchat") {
    await enviar(phone, turno.mensaje, { nombre });
    await solStore.actualizarSolicitud(pending.id, {
      historial_push: `${new Date().toISOString()} · Pedí datos (IA)`,
    });
    return {
      flow: "viajes_recolectando",
      solicitud: pending,
      faltan: turno.faltan,
      mensaje: turno.mensaje,
    };
  }

  // Datos listos → consultar disponibilidad (hechos) y redactar con IA
  return consultarYProponer(pending, {
    telefonoCliente: phone,
    nombre,
    log,
    introIa: turno.mensaje,
  });
}

async function consultarYProponer(
  pending,
  { telefonoCliente, nombre, log, introIa } = {},
) {
  const datos = pending.datos;
  const intro = introIa?.trim() || mensajeConsultandoDisponibilidad(datos);
  // Si la IA ya dijo que consulta, usamos ese texto; si no, un aviso corto.
  if (!/consult/i.test(intro) && introIa) {
    await enviar(telefonoCliente, intro, { nombre });
    await enviar(telefonoCliente, mensajeConsultandoDisponibilidad(datos), { nombre });
  } else {
    await enviar(telefonoCliente, intro, { nombre });
  }

  const activos = await viajesActivosParaAsignacion();
  const consulta = consultarDisponibilidad({
    toneladas: datos.toneladas ?? 20,
    tipo_carga: datos.tipo_carga,
    fecha_retiro: datos.fecha_retiro,
    hora_retiro: datos.hora_retiro,
    viajesActivos: activos,
  });

  const mensaje = await redactarPropuestaDisponibilidad({
    datos,
    consulta,
    remitente: nombre || pending.nombre,
    log,
  });
  await enviar(telefonoCliente, mensaje, { nombre });

  if (!consulta.ok || !consulta.propuesta) {
    await solStore.actualizarSolicitud(pending.id, {
      estado: "recolectando",
      propuesta: null,
      historial_push: `${new Date().toISOString()} · Sin disponibilidad`,
    });
    return { flow: "viajes_sin_disponibilidad", solicitud: pending, consulta, mensaje };
  }

  const opciones = [consulta.propuesta, ...(consulta.alternativas ?? [])].slice(0, 4);
  pending = await solStore.actualizarSolicitud(pending.id, {
    estado: "esperando_confirmacion_cliente",
    propuesta: {
      consulta: {
        pedida: consulta.pedida,
        exacta_ok: consulta.exacta_ok,
      },
      elegida: consulta.propuesta,
      opciones,
    },
    historial_push: `${new Date().toISOString()} · Propuesta IA ${consulta.propuesta.fecha} ${consulta.propuesta.hora}`,
  });

  log?.info?.(
    {
      exacta: consulta.exacta_ok,
      fecha: consulta.propuesta.fecha,
      hora: consulta.propuesta.hora,
      opciones: opciones.length,
    },
    "Viajes: disponibilidad ofrecida (agente IA)",
  );

  return { flow: "viajes_propuesta", solicitud: pending, consulta, mensaje };
}

async function finalizarAsignacion(pending, { telefonoCliente, slot, nombre, log } = {}) {
  const datos = pending.datos;
  const fechaIso = slot?.fecha || normalizarFechaRetiro(datos.fecha_retiro);
  const hora = slot?.hora || normalizarHora(datos.hora_retiro);
  const activos = await viajesActivosParaAsignacion();

  let asignacion = slot
    ? {
        ok: true,
        fecha: slot.fecha,
        hora: slot.hora,
        chofer: slot.chofer,
        telefono_chofer: slot.telefono_chofer,
        tractor: slot.tractor,
        semi: slot.semi,
        tipo_unidad: slot.tipo_unidad,
        capacidad_t: slot.capacidad_t,
        tipos_carga: slot.tipos_carga ?? [],
        fuente: "propuesta-confirmada",
      }
    : asignarDesdeFlota({
        toneladas: datos.toneladas ?? 20,
        tipo_carga: datos.tipo_carga,
        fecha_retiro: fechaIso,
        hora_retiro: hora,
        viajesActivos: activos,
        forzar_propuesta: pending.propuesta?.elegida,
      });

  if (!asignacion.ok) {
    const turno = await turnoAgenteViajes({
      texto: "(sistema: el cupo se ocupó; avisá y volvé a consultar)",
      fase: "recolectando",
      datos,
      remitente: nombre || pending.nombre,
      log,
    });
    await enviar(telefonoCliente, turno.mensaje || "Justo se ocupó ese cupo, consulto de nuevo…", {
      nombre,
    });
    return consultarYProponer(pending, { telefonoCliente, nombre, log });
  }

  let viaje = await viajesStore.crearViaje({
    cliente: datos.cliente || pending.nombre || "Cliente WhatsApp",
    origen: datos.origen,
    destino: datos.destino,
    carga: datos.carga || `${datos.tipo_carga} ${datos.toneladas} t`,
    fecha: asignacion.fecha || fechaIso,
    hora: asignacion.hora || hora || null,
    tipo_carga: datos.tipo_carga || null,
    tipo_unidad: asignacion.tipo_unidad || null,
    telefono_cliente: telefonoCliente || null,
    notas: [
      datos.notas,
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
    hora: asignacion.hora || viaje.hora || null,
    tipo_unidad: asignacion.tipo_unidad || viaje.tipo_unidad || null,
  });
  viaje = await viajesStore.cambiarEstadoViaje(viaje.id, "asignado");

  const msgCliente = await redactarReservaConfirmada({
    viaje,
    asignacion,
    remitente: nombre || pending.nombre,
    log,
  });
  await enviar(telefonoCliente, msgCliente, { viaje_id: viaje.id, nombre });

  let msgChofer = null;
  if (asignacion.telefono_chofer) {
    msgChofer = await redactarMensajeChofer({ viaje, asignacion, log });
    await enviar(asignacion.telefono_chofer, msgChofer, { viaje_id: viaje.id });
  }

  await solStore.actualizarSolicitud(pending.id, {
    estado: "asignada",
    viaje_id: viaje.id,
    propuesta: null,
    historial_push: `${new Date().toISOString()} · Reserva ${viaje.codigo} → ${asignacion.chofer}`,
  });

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
  }

  log?.info?.(
    {
      codigo: viaje.codigo,
      chofer: viaje.chofer,
      tipo: asignacion.tipo_unidad,
      fecha: asignacion.fecha,
      hora: asignacion.hora,
    },
    "Viaje reservado (agente IA)",
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

  const turno = await turnoAgenteViajes({
    texto,
    fase: "chofer",
    viaje,
    remitente: solChofer.nombre || viaje?.chofer,
    log,
  });

  const confirma =
    turno.intent === "confirmar" ||
    turno.accion === "reservar" ||
    esConfirmacionChofer(texto);
  const rechaza =
    turno.intent === "rechazar" ||
    turno.accion === "rechazar" ||
    esRechazoChofer(texto);

  if (confirma) {
    if (viaje) {
      await viajesStore.cambiarEstadoViaje(viaje.id, "en_curso").catch(() => null);
    }
    const msg =
      turno.mensaje ||
      `Gracias, viaje *${viaje?.codigo ?? ""}* confirmado. Buen viaje.`;
    await enviar(phone, msg, { viaje_id: viaje?.id });

    if (viaje?.telefono_cliente) {
      const msgCli = await turnoAgenteViajes({
        texto: "(sistema: el chofer confirmó; avisá al cliente con naturalidad)",
        fase: "reservado",
        viaje,
        remitente: viaje.cliente,
        log,
      });
      await enviar(viaje.telefono_cliente, msgCli.mensaje, { viaje_id: viaje.id });
    }

    await solStore.actualizarSolicitud(solChofer.id, {
      estado: "confirmada_chofer",
      historial_push: `${new Date().toISOString()} · Chofer confirmó`,
    });
    return { flow: "viajes_chofer_confirmado", viaje, mensaje: msg };
  }

  if (rechaza) {
    const msg =
      turno.mensaje ||
      `Entendido. Marcamos que no podés tomar el viaje${viaje ? ` *${viaje.codigo}*` : ""}.`;
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

  await enviar(phone, turno.mensaje, { viaje_id: viaje?.id });
  return { flow: "viajes_pedir_confirmacion_chofer", viaje, mensaje: turno.mensaje };
}

export async function procesarSolicitudViaje(input) {
  const { log } = input;
  const phone = sanitizePhone(input.telefono);
  const turno = await turnoAgenteViajes({
    texto: input.texto,
    fase: "recolectando",
    remitente: input.remitente,
    log,
  });
  if (turno.faltan.length) {
    throw Object.assign(new Error(`Faltan datos: ${turno.faltan.join(", ")}`), {
      statusCode: 422,
      faltan: turno.faltan,
      datos: turno.datos,
    });
  }

  const pending = await solStore.crearSolicitud({
    telefono: phone || "0000000000",
    nombre: input.remitente,
    datos: turno.datos,
  });
  const out = await finalizarAsignacion(pending, {
    telefonoCliente: phone,
    log,
  });
  return {
    ok: true,
    viaje: out.viaje,
    parsed: turno.datos,
    asignacion: out.asignacion,
    mensajes: [
      out.mensaje && { destino: "cliente", texto: out.mensaje },
      out.mensaje_chofer && { destino: "chofer", texto: out.mensaje_chofer },
    ].filter(Boolean),
  };
}
