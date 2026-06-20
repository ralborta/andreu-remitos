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
    const t = c?.text?.body ?? c?.text ?? c?.body ?? c?.content;
    if (t && !isPlaceholder(String(t))) return String(t).trim();
  }
  return "";
}

export function normalizeBuilderBotPayload(body) {
  const raw = body || {};
  const data = raw.data || {};
  const eventName = String(raw.eventName ?? raw.event ?? "").toLowerCase();

  let event = "message";
  if (eventName.includes("outgoing")) event = "outgoing";
  else if (eventName.includes("status")) event = "status";
  else if (eventName.includes("media")) event = "media";

  const from = extractPhone(data.from, data.phone, raw.from, raw.phone, data.sender);
  const message = extractText(
    data.body,
    data.message,
    data.text,
    raw.message,
    raw.body,
  );

  const attachment = data.attachment ?? raw.attachment ?? raw.media ?? data.media;
  let media = null;
  if (attachment && typeof attachment === "object") {
    const url = attachment.url ?? attachment.link ?? attachment.mediaUrl ?? attachment.path;
    if (url) {
      media = {
        url: String(url),
        mime_type: attachment.mime_type ?? attachment.mimeType ?? attachment.type ?? "image/jpeg",
      };
      if (/image|jpeg|png|webp/i.test(media.mime_type) || eventName.includes("media")) {
        event = "media";
      }
    }
  }

  const tenant = data.tenant ?? raw.tenant ?? data.cliente ?? raw.cliente ?? null;

  return { event, from, message, media, tenant, raw, data };
}

export function resolveTenant(telefono, explicitTenant) {
  if (explicitTenant === "tsb" || explicitTenant === "beraldi") return explicitTenant;

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

export function mensajeWhatsApp(resultado) {
  const d = resultado.lectura ?? resultado.datos ?? {};
  const guia = d.nro_guia ?? d.nro_remito ?? "—";
  const tenant = (resultado.tenant ?? d.tenant ?? "").toUpperCase();

  switch (resultado.estado) {
    case "pendiente_revision":
      return `✅ Remito ${tenant} recibido.\nGuía/remito: ${guia}\nHorarios OK — queda en revisión de mesa de control.`;
    case "confirmado":
      return `✅ Remito ${tenant} registrado.\nGuía/remito: ${guia}\nTodo validado.`;
    case "bloqueado":
      return `⚠️ Recibí el remito ${tenant} (guía ${guia}) pero hay un problema con las horas.\nRevisá el papel o contactá a tráfico.`;
    case "incompleto":
      return `📋 Remito ${tenant} recibido (guía ${guia}).\nFaltan datos o horas — lo revisa mesa de control y te avisan si hace falta reenviar la foto.`;
    default:
      return `📷 Recibí tu remito ${tenant}. Guía: ${guia}. Procesando…`;
  }
}
