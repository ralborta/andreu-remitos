import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import { mensajeClienteEstimadoEntrega } from "../../../lib/destinos.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";
import * as destinosStore from "../db/destinos-store.mjs";
import * as incidenciasStore from "../db/incidencias-store.mjs";
import * as viajesStore from "../db/viajes-store.mjs";
import * as etaStore from "../db/eta-store.mjs";

async function enviarCliente(telefono, mensaje, meta = {}) {
  const phone = sanitizePhone(telefono);
  if (!phone) throw new Error("Sin teléfono de cliente");
  await sendWhatsAppMessage({ number: phone, message: mensaje });
  await convStore.appendMensaje(
    phone,
    { texto: mensaje, tipo: "text", destino_id: meta.destino_id ?? null },
    { dir: "out", from: "bot", agente: "eta", nombre: meta.nombre ?? null },
  );
  return phone;
}

function estadoEtaLabel(destino) {
  if (destino.estado === "esperando_eta_chofer") return "Esperando ETA chofer";
  if (destino.estado === "en_ruta" && destino.eta_texto) return "En ruta";
  if (destino.estado === "en_ruta") return "En ruta (sin ETA)";
  if (destino.estado === "confirmado") return "Confirmado";
  return destino.estado || "—";
}

/**
 * Cola viva: Destinos con cliente + incidencias de demora abiertas.
 */
export async function listarColaEta({ limit = 60 } = {}) {
  const [destinos, incidencias, viajes] = await Promise.all([
    destinosStore.listDestinos({ limit: 80 }),
    incidenciasStore.listIncidencias({ limit: 80 }),
    viajesStore.listViajes({ limit: 40 }).catch(() => []),
  ]);

  const viajeByCodigo = new Map(
    (viajes || []).map((v) => [v.codigo || v.id, v]),
  );

  const items = [];

  for (const d of destinos) {
    if (!["esperando_eta_chofer", "en_ruta", "confirmado"].includes(d.estado)) continue;
    if (!d.telefono_cliente) continue;
    const viaje =
      (d.viaje_ref && viajeByCodigo.get(d.viaje_ref)) ||
      null;
    items.push({
      id: `destino:${d.id}`,
      fuente: "destino",
      refId: d.id,
      cliente: d.cliente || viaje?.cliente || "Cliente",
      telefonoCliente: d.telefono_cliente,
      destino: d.formatted_address || "—",
      chofer: d.chofer_nombre || viaje?.chofer || "—",
      telefonoChofer: d.telefono_chofer || viaje?.telefono_chofer || null,
      viaje: d.viaje_ref || viaje?.codigo || "—",
      etaTexto: d.eta_texto || null,
      etaMinutos: d.eta_minutos ?? null,
      etaAt: d.eta_at || null,
      estado: d.estado,
      estadoLabel: estadoEtaLabel(d),
      notificado: Boolean(d.eta_texto && d.eta_at),
      puedeNotificar: Boolean(d.telefono_cliente && d.eta_texto),
      updatedAt: d.updated_at || d.created_at,
    });
  }

  for (const inc of incidencias) {
    if (inc.tipo !== "demora") continue;
    if (!["nueva", "en_gestion", "esperando_causa"].includes(inc.estado)) continue;

    let destino = null;
    if (inc.destino_id) {
      destino =
        destinos.find((d) => d.id === inc.destino_id) ||
        (await destinosStore.getDestino(inc.destino_id).catch(() => null));
    }

    const telCliente = destino?.telefono_cliente || null;

    items.push({
      id: `incidencia:${inc.id}`,
      fuente: "incidencia",
      refId: inc.id,
      cliente: destino?.cliente || "Cliente",
      telefonoCliente: telCliente,
      destino: destino?.formatted_address || "—",
      chofer: inc.chofer_nombre || "—",
      telefonoChofer: inc.telefono || null,
      viaje: inc.viaje_ref || "—",
      etaTexto: destino?.eta_texto || null,
      etaMinutos: destino?.eta_minutos ?? null,
      etaAt: destino?.eta_at || null,
      estado: inc.estado,
      estadoLabel: `Demora · ${inc.estado}`,
      causa: inc.causa || inc.resumen || null,
      codigoIncidencia: inc.codigo || inc.id,
      notificado: false,
      puedeNotificar: Boolean(telCliente),
      updatedAt: inc.updated_at || inc.created_at,
    });
  }

  items.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return items.slice(0, Math.min(Number(limit) || 60, 120));
}

export async function resumenEta() {
  const [cola, notif] = await Promise.all([
    listarColaEta({ limit: 100 }),
    etaStore.resumenNotificaciones(),
  ]);
  const conEta = cola.filter((i) => i.fuente === "destino" && i.etaTexto).length;
  const esperando = cola.filter((i) => i.estado === "esperando_eta_chofer").length;
  const demoras = cola.filter((i) => i.fuente === "incidencia").length;
  return {
    enCola: cola.length,
    conEta,
    esperandoChofer: esperando,
    demorasAbiertas: demoras,
    notificacionesHoy: notif.hoy,
    demorasNotificadasHoy: notif.demorasHoy,
  };
}

/** Reenvía / envía estimado al cliente desde un Destino. */
export async function notificarDesdeDestino(destinoId, { demora = false, etaTexto } = {}) {
  const destino = await destinosStore.getDestino(destinoId);
  if (!destino) throw new Error("Destino no encontrado");
  const tel = destino.telefono_cliente;
  if (!tel) throw new Error("El destino no tiene teléfono de cliente");

  const texto = (etaTexto || destino.eta_texto || "").trim();
  if (!texto) throw new Error("No hay ETA para notificar (pedí estimado al chofer primero)");

  const actualizacion = !demora && Boolean(destino.eta_at);
  const mensaje = mensajeClienteEstimadoEntrega({
    etaTexto: texto,
    demora: Boolean(demora),
    actualizacion,
  });

  const phone = await enviarCliente(tel, mensaje, {
    destino_id: destino.id,
    nombre: destino.cliente,
  });

  const historial = [
    ...(destino.historial || []),
    demora
      ? `ETA agente: demora avisada al cliente (${texto})`
      : `ETA agente: estimado enviado al cliente (${texto})`,
  ];
  await destinosStore.actualizarDestino(destino.id, {
    historial,
    ...(destino.eta_texto ? {} : { eta_texto: texto, eta_at: new Date().toISOString() }),
  });

  const log = await etaStore.registrarNotificacion({
    fuente: "destino",
    ref_id: destino.id,
    telefono_cliente: phone,
    cliente: destino.cliente,
    eta_texto: texto,
    tipo: demora ? "demora" : actualizacion ? "actualizacion" : "eta",
    mensaje,
    viaje_ref: destino.viaje_ref || null,
  });

  return { ok: true, mensaje, telefono: phone, notificacion: log };
}

/** Avisa demora al cliente a partir de una incidencia (colabora con Incidencias). */
export async function avisarDemoraDesdeIncidencia(incidenciaId, { etaTexto } = {}) {
  const inc = await incidenciasStore.getIncidencia(incidenciaId);
  if (!inc) throw new Error("Incidencia no encontrada");

  let destino = null;
  if (inc.destino_id) {
    destino = await destinosStore.getDestino(inc.destino_id).catch(() => null);
  }

  const tel = destino?.telefono_cliente;
  if (!tel) {
    throw new Error(
      "No hay teléfono de cliente vinculado (la incidencia debe venir de un Destino con cliente)",
    );
  }

  const texto =
    (etaTexto || destino?.eta_texto || "un tiempo adicional").trim();
  const mensaje = mensajeClienteEstimadoEntrega({
    etaTexto: texto,
    demora: true,
  });

  const phone = await enviarCliente(tel, mensaje, {
    destino_id: destino?.id,
    nombre: destino?.cliente,
  });

  if (destino) {
    await destinosStore.actualizarDestino(destino.id, {
      historial: [
        ...(destino.historial || []),
        `ETA agente ← Incidencia ${inc.codigo || inc.id}: demora al cliente (${texto})`,
      ],
    });
  }

  const historialInc = [
    ...(inc.historial || []),
    `ETA: demora notificada al cliente (${texto})`,
  ];
  await incidenciasStore.actualizarIncidencia(inc.id, { historial: historialInc });

  const log = await etaStore.registrarNotificacion({
    fuente: "incidencia",
    ref_id: inc.id,
    telefono_cliente: phone,
    cliente: destino?.cliente,
    eta_texto: texto,
    tipo: "demora",
    mensaje,
    viaje_ref: inc.viaje_ref || null,
  });

  return { ok: true, mensaje, telefono: phone, notificacion: log };
}
