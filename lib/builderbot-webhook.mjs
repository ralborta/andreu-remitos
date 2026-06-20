/** Normaliza payload BuilderBot Cloud → evento interno */

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

export function normalizeBuilderBotPayload(body) {
  const raw = body || {};
  const data = raw.data ?? raw.payload ?? raw.message ?? raw;
  const eventName = String(raw.eventName ?? raw.event ?? raw.type ?? "").toLowerCase();

  let event = "message";
  if (eventName.includes("outgoing")) event = "outgoing";
  else if (eventName.includes("status")) event = "status";
  else if (eventName.includes("media") || eventName.includes("image")) event = "media";

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

  const message = extractText(
    data.body,
    data.message,
    data.text,
    data.caption,
    raw.message,
    raw.body,
    raw.text,
  );

  const attachment =
    data.attachment ??
    data.attachments?.[0] ??
    raw.attachment ??
    raw.attachments?.[0] ??
    raw.media ??
    data.media ??
    data.image ??
    raw.image;

  let media = null;
  const mediaUrl = extractMediaUrl(attachment);
  if (mediaUrl) {
    media = {
      url: mediaUrl,
      mime_type:
        (typeof attachment === "object"
          ? attachment.mime_type ?? attachment.mimeType ?? attachment.type
          : null) ?? "image/jpeg",
    };
    event = "media";
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

  return { event, from, message, media, tenant, nombre, raw, data };
}

export function resolveTenant(telefono, explicitTenant) {
  const t = String(explicitTenant ?? "").toLowerCase();
  if (t === "tsb" || t === "beraldi") return t;

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
  if (def === "tsb" || def === "beraldi") return def;
  return null;
}

export async function downloadMedia(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
  return { buffer: buf, mime, filename: `whatsapp${ext}` };
}

function linea(label, valor) {
  if (valor == null || valor === "" || valor === "—") return null;
  return `${label}: ${valor}`;
}

/** Respuesta al chofer — formato similar al CRM viejo (Arianna) */
export function mensajeWhatsApp(resultado) {
  const d = resultado.lectura ?? resultado.datos ?? {};
  const tenant = (resultado.tenant ?? d.tenant ?? "").toUpperCase();
  const guia = d.nro_guia ?? d.nro_remito ?? "—";
  const chasis = d.chasis ?? d.patente_chasis;
  const acoplado = d.acoplado ?? d.patente_acoplado;
  const origen = d.procedencia ?? d.origen;
  const destino = d.destino;
  const peso = d.peso_kg ?? d.peso;
  const fecha = d.fecha ?? d.fecha_remito;

  const bloques = [
    linea("Empresa", tenant),
    linea("Nro Remito", guia),
    linea("Chasis", chasis),
    linea("Acoplado", acoplado),
    linea("Origen", origen),
    linea("Destino", destino),
    linea("Fecha", fecha),
    linea("Peso", peso != null ? String(peso) : null),
  ].filter(Boolean);

  switch (resultado.estado) {
    case "pendiente_revision":
      return `${bloques.join("\n")}\n\n✅ Recibido — queda en revisión de mesa de control.\nBuen viaje!`;
    case "confirmado":
      return `${bloques.join("\n")}\n\n✅ Todo validado.\nBuen viaje!`;
    case "bloqueado":
      return `${bloques.join("\n")}\n\n⚠️ Hay un problema con las horas. Revisá el papel o contactá a tráfico.`;
    case "incompleto":
      return `${bloques.join("\n")}\n\n📋 Faltan datos — lo revisa mesa de control. Te avisan si hay que reenviar la foto.`;
    default:
      return `📷 Recibí tu remito ${tenant}. Guía: ${guia}. Procesando…`;
  }
}

export function mensajeSaludo(tenant) {
  const empresa = tenant === "beraldi" ? "Beraldi" : tenant === "tsb" ? "TSB" : "";
  const extra = empresa ? ` (${empresa})` : "";
  return `Hola 👋 Soy Arianna${extra}, asistente de remitos.\n\nPor favor, enviame una *foto clara del remito* de tu viaje (que se vea la guía completa).`;
}
