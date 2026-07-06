/** Normaliza payload BuilderBot Cloud → evento interno */

import { esPalabraConfirmacion, fechaDmY, fechaRemitoEnDatos, normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";

export function sanitizePhone(phone) {
  if (!phone || typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
}

function isPlaceholder(v) {
  return typeof v === "string" && /^@|\{\{/.test(v.trim());
}

function extractPhone(...candidates) {
  for (const c of candidates) {
    if (c == null || c === "" || isPlaceholder(c)) continue;
    const p = sanitizePhone(String(typeof c === "object" ? c.id ?? c.wa_id ?? c.phone : c));
    if (p) return p;
  }
  return "";
}

function extractText(...candidates) {
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "string" && !isPlaceholder(c)) return c.trim();
    const t = c?.text?.body ?? c?.text ?? c?.body ?? c?.content ?? c?.caption;
    if (t && !isPlaceholder(String(t))) return String(t).trim();
  }
  return "";
}

function extractMediaUrl(attachment) {
  if (!attachment) return null;
  if (typeof attachment === "string" && attachment.startsWith("http")) return attachment;
  if (typeof attachment !== "object") return null;
  const url =
    attachment.url ??
    attachment.link ??
    attachment.mediaUrl ??
    attachment.path ??
    attachment.file ??
    attachment.payload?.url;
  return url && String(url).startsWith("http") ? String(url) : null;
}

function extractMediaMime(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  return attachment.mime_type ?? attachment.mimeType ?? attachment.type ?? null;
}

function isAbsoluteUrl(u) {
  return typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://"));
}

function normalizeAttachmentList(data, raw) {
  const src = data?.attachment ?? data?.attachments ?? raw?.attachment ?? raw?.attachments;
  if (Array.isArray(src)) return src;
  if (src && typeof src === "object") return [src];
  return [];
}

export function normalizeBuilderBotPayload(body) {
  const raw = body || {};
  const data = raw.data ?? raw.payload ?? raw.message ?? raw;
  const eventName = String(raw.eventName ?? raw.event ?? raw.type ?? "").toLowerCase();

  let event = "message";
  if (eventName === "message.outgoing" || eventName.includes("outgoing")) event = "outgoing";
  else if (eventName.includes("status")) event = "status";
  else if (eventName === "message.incoming" || eventName.includes("incoming")) event = "incoming";
  else if (!eventName && (raw.attachments?.length || raw.phone)) event = "incoming";

  const from = extractPhone(
    data.from,
    data.phone,
    data.sender,
    data.contact?.phone,
    data.contact?.wa_id,
    raw.from,
    raw.phone,
    raw.sender,
    raw.contact?.phone,
  );

  const to = extractPhone(
    data.to,
    data.remoteJid,
    data.key?.remoteJid,
    raw.to,
  );

  const contactPhone = event === "outgoing" ? to || from : from;

  let message = extractText(
    data.body,
    data.message,
    data.text,
    data.caption,
    raw.message,
    raw.body,
    raw.text,
  );

  const attachmentList = normalizeAttachmentList(data, raw);
  const urlTempFile =
    (isAbsoluteUrl(data.urlTempFile) && String(data.urlTempFile)) ||
    (isAbsoluteUrl(raw.urlTempFile) && String(raw.urlTempFile)) ||
    null;

  const isVoiceNote = /^_event_voice_note__/i.test(message);
  const isAudioEvent = /^_event_audio__/i.test(message);
  const mediaKind = String(data.mediaKind ?? raw.mediaKind ?? "").toLowerCase();
  const isVoiceFromKind = mediaKind === "voice_note";
  const isAudioFromKind = mediaKind === "audio";
  const isMediaEvent = /^_event_(document|image|video|audio)__/i.test(message);
  const isLocationEvent = /^_event_location__/i.test(message);

  if ((isMediaEvent || isVoiceNote || isAudioEvent || isLocationEvent) && (attachmentList.length > 0 || urlTempFile)) {
    message = "";
  }
  // BB CRM: "Adjuntando archivo" cuando hay adjunto
  if (/adjuntando archivo/i.test(message) && (attachmentList.length > 0 || urlTempFile)) {
    message = "";
  }

  let mediaUrl = urlTempFile;
  let attachmentMime = null;
  let attachmentName = null;

  if (!mediaUrl && attachmentList.length > 0) {
    const att = attachmentList[0];
    mediaUrl = extractMediaUrl(att);
    attachmentMime = extractMediaMime(att);
    attachmentName = att?.filename ?? att?.name ?? null;
  }

  // Compat con add_http antiguo: attachment como objeto suelto con url
  if (!mediaUrl) {
    const legacy = data.attachment ?? raw.attachment;
    if (legacy && !Array.isArray(legacy)) {
      mediaUrl = extractMediaUrl(legacy);
      attachmentMime = extractMediaMime(legacy);
    }
  }

  let media = null;
  if (mediaUrl) {
    const mime =
      attachmentMime ??
      (isVoiceNote || isVoiceFromKind || isAudioEvent || isAudioFromKind || eventName.includes("audio")
        ? "audio/ogg"
        : looksLikeAudioFilename(attachmentName, mediaUrl)
          ? "audio/ogg"
          : "image/jpeg");
    media = {
      url: mediaUrl,
      mime_type: mime,
      name: attachmentName,
    };
    if (
      /^audio\//i.test(mime) ||
      isVoiceNote ||
      isVoiceFromKind ||
      isAudioEvent ||
      isAudioFromKind ||
      looksLikeAudioFilename(attachmentName, mediaUrl)
    ) {
      if (event !== "outgoing") event = "audio";
    } else if (event !== "outgoing" && event !== "status") {
      event = "media";
    }
  }

  const tenant =
    data.tenant ??
    raw.tenant ??
    data.cliente ??
    raw.cliente ??
    data.metadata?.tenant ??
    null;

  const nombre =
    data.name ??
    data.pushName ??
    data.contact?.name ??
    raw.name ??
    raw.pushName ??
    null;

  const location = extractLocation(data, raw);

  return {
    event,
    eventName,
    from: contactPhone,
    message,
    media,
    mediaKind: mediaKind || null,
    location,
    tenant,
    nombre,
    attachments: attachmentList,
    urlTempFile,
    raw,
    data,
  };
}

function looksLikeAudioFilename(name = "", url = "") {
  const s = `${name} ${url}`.toLowerCase();
  return /\.(ogg|opus|mp3|m4a|webm|aac|amr)(?:\?|$)/i.test(s);
}

export function bufferLooksLikeAudio(buffer) {
  if (!buffer?.length) return false;
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") return true;
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") return true;
  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

function esAudioMimeLocal(mime = "") {
  return /^audio\//i.test(mime) || /ogg|opus|webm|mpeg|mp3|wav|flac/i.test(mime);
}

/** Detecta audio aunque el bot haya mandado mime genérico (octet-stream). */
export function esEventoAudio(ev, buffer = null) {
  if (ev?.event === "audio") return true;
  const kind = String(ev?.mediaKind ?? ev?.raw?.data?.mediaKind ?? "").toLowerCase();
  if (kind === "voice_note" || kind === "audio") return true;
  if (ev?.media && esAudioMimeLocal(ev.media.mime_type)) return true;
  if (looksLikeAudioFilename(ev?.media?.name, ev?.media?.url)) return true;
  if (buffer && bufferLooksLikeAudio(buffer)) return true;
  return false;
}

function extractLocation(data, raw) {
  const candidates = [
    data?.locationMessage,
    data?.message?.locationMessage,
    data?.ctx?.message?.locationMessage,
    data?.location,
    data?.message?.location,
    raw?.data?.locationMessage,
    raw?.data?.message?.locationMessage,
    raw?.ctx?.message?.locationMessage,
    raw?.location,
  ];
  for (const loc of candidates) {
    if (!loc || typeof loc !== "object") continue;
    const lat = loc.degreesLatitude ?? loc.latitude ?? loc.lat;
    const lng = loc.degreesLongitude ?? loc.longitude ?? loc.lng;
    if (
      lat != null &&
      lng != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng))
    ) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }
  return null;
}

export function resolveTenant(telefono, explicitTenant) {
  const t = String(explicitTenant ?? "").toLowerCase();
  if (t === "tsb" || t === "beraldi" || t === "corina") return t;

  const mapJson = process.env.TENANT_BY_PHONE_JSON?.trim();
  if (mapJson && telefono) {
    try {
      const map = JSON.parse(mapJson);
      const key = sanitizePhone(telefono);
      if (map[key]) return map[key];
      for (const [prefix, tenant] of Object.entries(map)) {
        if (key.startsWith(sanitizePhone(prefix))) return tenant;
      }
    } catch {
      /* ignore */
    }
  }

  const def = process.env.BUILDERBOT_DEFAULT_TENANT;
  if (def === "tsb" || def === "beraldi" || def === "corina") return def;
  return null;
}

export async function downloadMedia(url) {
  const headers = {};
  const apiKey = process.env.BUILDERBOT_API_KEY?.trim();
  if (apiKey && /builderbot\.cloud/i.test(String(url))) {
    headers["x-api-builderbot"] = apiKey;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  let mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "";

  if (bufferLooksLikeAudio(buf)) {
    if (!/^audio\//i.test(mime)) mime = "audio/ogg";
    const ext = mime.includes("mpeg") ? ".mp3" : mime.includes("webm") ? ".webm" : ".ogg";
    return { buffer: buf, mime, filename: `whatsapp-audio${ext}` };
  }

  if (!mime || mime === "application/octet-stream") {
    mime = "image/jpeg";
  }
  const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  return { buffer: buf, mime, filename: `whatsapp${ext}` };
}

function linea(label, valor) {
  if (valor == null || valor === "" || valor === "—") return null;
  if (esPalabraConfirmacion(valor)) return null;
  return `${label}: ${valor}`;
}

function nroParaMensaje(d) {
  return normalizarNroRemitoGuia(d.nro_guia ?? d.nro_remito) ?? "—";
}

function fechaParaMensaje(d) {
  const iso = fechaRemitoEnDatos(d);
  return iso ? fechaDmY(iso) : null;
}

function avisoFechaFaltante(d) {
  if (fechaRemitoEnDatos(d)) return null;
  return "⚠️ *No leí la fecha del remito.* Si está en el papel, escribila: Fecha DD/MM/AAAA (ej: Fecha 05/07/2026)";
}

/** Aviso inmediato al chofer mientras corre el OCR (segundos). */
export function mensajeProcesandoRemito() {
  return "📷 Gracias, recibimos tu remito.\nEstamos procesándolo… en unos segundos te paso los datos.";
}

function cierreEsperandoOk() {
  return (
    "✅ Recibido — queda en revisión de mesa de control.\n\n" +
    "¿Está todo correcto?\n" +
    "Respondé *OK* (podés escribirlo o mandarlo por *audio*).\n" +
    "Si algo falta, *escribí* la corrección."
  );
}

/** Respuesta al chofer — formato similar al CRM viejo (Arianna / Corina) */
export function mensajeWhatsApp(resultado) {
  const d = resultado.lectura ?? resultado.datos ?? {};
  const tenantRaw = resultado.tenant ?? d.tenant ?? "";
  const tenant = tenantRaw.toUpperCase();
  const guia = nroParaMensaje(d);
  const avisoFecha = avisoFechaFaltante(d);

  if (tenantRaw === "corina") {
    const bloquesCorina = [
      linea("Empresa", "CORINA"),
      linea("Nro Remito", guia),
      linea("Conductor", d.conductor),
      linea("Patente", d.patente),
      linea("Cliente", d.cliente),
      linea("Fecha", fechaParaMensaje(d)),
      linea("Bultos", d.total_bultos != null ? String(d.total_bultos) : null),
      linea("Litros", d.total_litros != null ? String(d.total_litros) : null),
    ].filter(Boolean);

    const pie = [avisoFecha, cierreEsperandoOk()].filter(Boolean).join("\n\n");

    switch (resultado.estado) {
      case "pendiente_revision":
      case "incompleto":
        return `${bloquesCorina.join("\n")}\n\n${pie}`;
      case "confirmado":
        return `${bloquesCorina.join("\n")}\n\n✅ Todo validado.\n¡Buen viaje!`;
      default:
        return `📷 Recibí tu remito Corina. Nro: ${guia}. Procesando…`;
    }
  }

  const chasis = d.chasis ?? d.tractor ?? d.patente_chasis;
  const semi = d.acoplado ?? d.semi ?? d.patente_acoplado;
  const origen = d.procedencia ?? d.origen;
  const destino = d.destino;
  const peso = d.peso_kg ?? d.peso;
  const horas = d.horarios?.horarios ?? {};
  const hs = [
    horas.carga_entrada?.hora,
    horas.carga_salida?.hora,
    horas.descarga_llegada?.hora,
    horas.descarga_inicio?.hora,
    horas.descarga_fin?.hora,
  ].filter(Boolean);
  const horariosLinea = hs.length > 0 ? `Horarios: ${hs.join(" → ")}` : null;
  const bloques = [
    linea("Empresa", tenant),
    linea("Nro Remito", guia),
    linea("Chasis", chasis),
    linea("Semi / remolque", semi),
    linea("Origen", origen),
    linea("Destino", destino),
    linea("Fecha", fechaParaMensaje(d)),
    linea("Peso", peso != null ? String(peso) : null),
    horariosLinea,
  ].filter(Boolean);

  const pieConFecha = [avisoFecha, cierreEsperandoOk()].filter(Boolean).join("\n\n");
  const pieBloqueado = [avisoFecha, "⚠️ Hay un problema con las horas. Revisá el papel o contactá a tráfico.", "Si corregís algo, escribí la corrección (ej: salida carga 19:44)."].filter(Boolean).join("\n\n");

  switch (resultado.estado) {
    case "pendiente_revision":
    case "incompleto":
      return `${bloques.join("\n")}\n\n${pieConFecha}`;
    case "confirmado":
      return `${bloques.join("\n")}\n\n✅ Todo validado.\n¡Buen viaje!`;
    case "bloqueado":
      return `${bloques.join("\n")}\n\n${pieBloqueado}`;
    default:
      return `📷 Recibí tu remito ${tenant}. Guía: ${guia}. Procesando…`;
  }
}

export function mensajeSaludo(_tenant, nombreChofer) {
  const primerNombre = nombreChofer?.trim().split(/\s+/)[0];
  const hola = primerNombre ? `Hola ${primerNombre} 👋` : "Hola 👋";
  return `${hola} Soy el asistente de remitos Andreu.\n\nPodés:\n• Mandar una *foto clara* del remito\n• *Escribir* correcciones si algo no coincide\n• Decir o escribir *OK* cuando esté todo bien`;
}

/** Chofer indica que algo no está bien (con remito ya cargado). */
export function mensajeEsperandoCorreccion(remito) {
  if (remito?.estado === "bloqueado") {
    return (
      "Entendido 👍 Hay un tema con las horas.\n\n" +
      "Escribí la corrección (ej: \"salida carga 19:44\").\n" +
      "Si preferís, contactá a tráfico directamente."
    );
  }
  return "Entendido 👍 Decime qué corregir *por texto* o respondé *OK* cuando esté todo bien.";
}

export function mensajeAudioSoloConfirmacion() {
  return (
    "Recibí tu audio.\n\n" +
    "Para *confirmar* el remito, decí o escribí *OK*.\n" +
    "Para *corregir* algo, *escribilo* por texto (ej: Peso 29762)."
  );
}

export function mensajeAudioFallidoConfirmacion() {
  return "No pude entender el audio.\n\nPara confirmar, decí claro *OK* (1-2 segundos) o escribí *OK*.\nLas correcciones van *solo por texto*.";
}
