/**
 * Lectura IA de facturas de proveedor (cuentas por pagar).
 * No es rendición de chofer ni factura a cobrar.
 */

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

function toNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeCuit(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 11) return d || null;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function normalizeDatos(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    tipo_comprobante: r.tipo_comprobante ? String(r.tipo_comprobante).trim() : null,
    punto_venta: r.punto_venta ? String(r.punto_venta).trim() : null,
    numero: r.numero ? String(r.numero).trim() : null,
    fecha: r.fecha ? String(r.fecha).trim() : null,
    fecha_vto: r.fecha_vto ? String(r.fecha_vto).trim() : null,
    cuit_emisor: normalizeCuit(r.cuit_emisor),
    razon_social: r.razon_social ? String(r.razon_social).trim() : null,
    cuit_receptor: normalizeCuit(r.cuit_receptor),
    monto: toNumber(r.monto),
    moneda: r.moneda ? String(r.moneda).trim().toUpperCase() : "ARS",
    cae: r.cae ? String(r.cae).trim() : null,
    confianza: typeof r.confianza === "number" ? r.confianza : null,
  };
}

const SYSTEM = `Sos el agente de Facturas de SOL (finanzas).
Leés comprobantes fiscales argentinos (factura A/B/C, nota de crédito/débito) de PROVEEDORES: son cuentas por pagar.
NO son tickets de chofer (peaje, nafta) ni facturas de venta de la empresa.
Devolvé solo JSON. Fechas ISO YYYY-MM-DD. Monto total a pagar (número, sin miles). CUIT con guiones si tiene 11 dígitos.`;

function userPrompt(ocrTexto) {
  return `Extraé los datos de esta factura de proveedor.

${ocrTexto ? `TEXTO_OCR:\n"""\n${String(ocrTexto).slice(0, 12000)}\n"""` : "No hay OCR previo: usá el archivo adjunto."}

JSON:
{
  "tipo_comprobante": "A"|"B"|"C"|"NC"|"ND"|null,
  "punto_venta": string|null,
  "numero": string|null,
  "fecha": string|null,
  "fecha_vto": string|null,
  "cuit_emisor": string|null,
  "razon_social": string|null,
  "cuit_receptor": string|null,
  "monto": number|null,
  "moneda": "ARS"|"USD"|null,
  "cae": string|null,
  "confianza": number
}`;
}

async function openaiJson({ content, log }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_FACTURA_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.FINANZAS_IA_TIMEOUT_MS) || 45000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    log?.warn?.({ status: res.status, errText: errText.slice(0, 400) }, "Factura IA OpenAI falló");
    throw new Error(`OpenAI ${res.status}`);
  }
  const data = await res.json();
  return extraerJson(data.choices?.[0]?.message?.content ?? "");
}

function isPdf(filename = "", mime = "") {
  return mime.includes("pdf") || /\.pdf$/i.test(filename);
}

function isImage(filename = "", mime = "") {
  if (mime.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(filename);
}

/**
 * @param {Buffer} buffer
 * @param {{ filename?: string, mime?: string, ocrTexto?: string, log?: object }} opts
 */
export async function interpretarFacturaProveedor(buffer, opts = {}) {
  const filename = opts.filename || "factura.pdf";
  const mime = opts.mime || (isPdf(filename) ? "application/pdf" : "image/jpeg");
  const b64 = buffer.toString("base64");
  const prompt = userPrompt(opts.ocrTexto);

  let raw = null;
  try {
    if (isImage(filename, mime)) {
      raw = await openaiJson({
        log: opts.log,
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      });
    } else if (isPdf(filename, mime)) {
      try {
        raw = await openaiJson({
          log: opts.log,
          content: [
            { type: "text", text: prompt },
            {
              type: "file",
              file: { filename, file_data: `data:application/pdf;base64,${b64}` },
            },
          ],
        });
      } catch {
        raw = null;
      }
      if (!raw && opts.ocrTexto) {
        raw = await openaiJson({ log: opts.log, content: prompt });
      }
    } else if (opts.ocrTexto) {
      raw = await openaiJson({ log: opts.log, content: prompt });
    }
  } catch (err) {
    opts.log?.warn?.({ err: err.message }, "Factura IA falló");
    raw = opts.ocrTexto ? await openaiJson({ log: opts.log, content: prompt }).catch(() => null) : null;
  }

  return normalizeDatos(raw);
}

export function facturaMime(filename = "", mime = "") {
  if (mime) return mime;
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  if (/\.png$/i.test(filename)) return "image/png";
  if (/\.webp$/i.test(filename)) return "image/webp";
  return "image/jpeg";
}
