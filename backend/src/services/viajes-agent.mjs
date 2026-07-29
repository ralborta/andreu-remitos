import { parseSolicitudViaje } from "../../../lib/viajes-solicitud.mjs";
import { asignarDesdeFlota } from "./viajes-flota.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";

const ESTADOS_ACTIVOS = new Set(["solicitado", "confirmado", "asignado", "en_curso"]);

function mensajeConfirmacionCliente(viaje, asignacion) {
  return (
    `Recibí su solicitud ✅\n\n` +
    `*${viaje.cliente}*\n` +
    `${viaje.origen} → ${viaje.destino}\n` +
    (viaje.carga ? `Carga: ${viaje.carga}\n` : "") +
    `\nConsulté disponibilidad en flota${asignacion.fuente?.includes("xlsx") ? " (Excel)" : ""}: ` +
    `unidad apta (${asignacion.tipo_unidad ?? "semi"}, ${asignacion.capacidad_t} t).\n\n` +
    `Viaje *${viaje.codigo}* confirmado.\n` +
    `Chofer: ${viaje.chofer} (${viaje.tractor}${viaje.semi ? ` / ${viaje.semi}` : ""}).\n` +
    `Les comparto seguimiento al iniciar el viaje.`
  );
}

function mensajeAvisoChofer(viaje) {
  return (
    `Hola 👋 Tenés un viaje asignado:\n\n` +
    `*${viaje.codigo}* · ${viaje.cliente}\n` +
    `${viaje.origen} → ${viaje.destino}\n` +
    (viaje.carga ? `Carga: ${viaje.carga}\n` : "") +
    (viaje.fecha ? `Retiro: ${viaje.fecha}\n` : "") +
    `\nConfirmá cuando estés en camino.`
  );
}

async function viajesActivosParaAsignacion() {
  const rows = await viajesStore.listViajes({ limit: 200 });
  return rows.filter((r) => ESTADOS_ACTIVOS.has(r.estado));
}

/**
 * Procesa una solicitud entrante (email, WhatsApp, etc.) en background.
 * @param {{ texto: string, canal?: string, remitente?: string, telefono?: string, tenant?: string, notificar?: boolean, log?: object }} input
 */
export async function procesarSolicitudViaje(input) {
  const { log } = input;
  const parsed = await parseSolicitudViaje(input.texto, {
    remitente: input.remitente,
    canal: input.canal,
    log,
  });

  const activos = await viajesActivosParaAsignacion();
  const asignacion = asignarDesdeFlota({
    toneladas: parsed.toneladas ?? 20,
    viajesActivos: activos,
  });

  if (!asignacion.ok) {
    throw Object.assign(new Error(asignacion.error), { statusCode: 409, parsed });
  }

  let viaje = await viajesStore.crearViaje({
    cliente: parsed.cliente,
    origen: parsed.origen,
    destino: parsed.destino,
    carga: parsed.carga || (parsed.toneladas ? `${parsed.toneladas} t` : null),
    fecha: parsed.fecha_retiro,
    tenant: input.tenant || null,
    notas: parsed.notas || `Canal: ${input.canal || "desconocido"}. ${parsed.texto_original?.slice(0, 200) ?? ""}`,
  });

  viaje = await viajesStore.cambiarEstadoViaje(viaje.id, "confirmado");
  viaje = await viajesStore.actualizarViaje(viaje.id, {
    chofer: asignacion.chofer,
    telefono_chofer: asignacion.telefono_chofer,
    tractor: asignacion.tractor,
    semi: asignacion.semi,
  });
  viaje = await viajesStore.cambiarEstadoViaje(viaje.id, "asignado");

  const notificar = input.notificar !== false;
  const mensajes = [];

  if (notificar && input.telefono) {
    const msgCliente = mensajeConfirmacionCliente(viaje, asignacion);
    try {
      await sendWhatsAppMessage({ number: input.telefono, message: msgCliente });
      await convStore.appendMensaje(
        input.telefono,
        { texto: msgCliente, tipo: "text", viaje_id: viaje.id },
        { dir: "out", from: "bot", agente: "viajes" },
      );
      mensajes.push({ destino: "cliente", telefono: input.telefono, texto: msgCliente });
    } catch (err) {
      log?.warn?.({ err: err.message, telefono: input.telefono }, "No se pudo notificar cliente viaje");
    }
  }

  if (notificar && asignacion.telefono_chofer) {
    const msgChofer = mensajeAvisoChofer(viaje);
    try {
      await sendWhatsAppMessage({ number: asignacion.telefono_chofer, message: msgChofer });
      await convStore.appendMensaje(
        asignacion.telefono_chofer,
        { texto: msgChofer, tipo: "text", viaje_id: viaje.id },
        { dir: "out", from: "bot", agente: "viajes" },
      );
      mensajes.push({ destino: "chofer", telefono: asignacion.telefono_chofer, texto: msgChofer });
    } catch (err) {
      log?.warn?.({ err: err.message }, "No se pudo notificar chofer viaje");
    }
  }

  log?.info?.(
    {
      codigo: viaje.codigo,
      cliente: viaje.cliente,
      chofer: viaje.chofer,
      canal: input.canal,
      fuente_flota: asignacion.fuente,
      parser: parsed.fuente,
    },
    "Viaje asignado automáticamente",
  );

  return {
    ok: true,
    viaje,
    parsed,
    asignacion,
    mensajes,
  };
}
