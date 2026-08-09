/**
 * Agente mínimo de Reclamos por WhatsApp (IA + registro).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "reclamos-wa.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function extraerJson(text) {
  const t = String(textoSafe(text)).trim();
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

function textoSafe(v) {
  return String(v ?? "");
}

async function redactarConIA({ texto, nombre, log }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.OPENAI_RECLAMOS_MODEL?.trim() ||
    process.env.OPENAI_VIAJES_MODEL?.trim() ||
    "gpt-4o-mini";
  const prompt = `Sos el agente de Reclamos de una logística argentina por WhatsApp.
El cliente escribió un reclamo. Respondé humano, breve y profesional (rioplatense).
Pedí lo mínimo que falte (nro de viaje/remito, qué pasó, fecha) para abrirlo.
No inventes compensaciones ni culpes.

Cliente: ${nombre || "desconocido"}
Mensaje:
"""
${texto}
"""

JSON: { "mensaje": string, "resumen": string, "tipo": "demora"|"faltante"|"dano"|"extravio"|"otro" }`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Respondé SOLO JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return extraerJson(data.choices?.[0]?.message?.content ?? "");
  } catch (err) {
    log?.warn?.({ err: err.message }, "Reclamos IA falló");
    return null;
  }
}

export async function procesarReclamoWhatsApp({
  telefono,
  texto,
  nombre,
  log,
} = {}) {
  const phone = String(telefono || "").replace(/\D/g, "");
  const t = String(texto || "").trim();
  if (!phone || !t) return null;

  const ia = await redactarConIA({ texto: t, nombre, log });
  const mensaje =
    ia?.mensaje?.trim() ||
    `Entendido, tomo tu reclamo.\n\n` +
      `Para abrirlo necesito: *nro de viaje o remito*, qué pasó y *fecha*.\n` +
      `Pasame eso y lo derivamos a seguimiento.`;

  const now = new Date().toISOString();
  const row = {
    id: `RC-${randomUUID().slice(0, 8).toUpperCase()}`,
    telefono: phone,
    nombre: nombre || null,
    texto: t,
    resumen: ia?.resumen || t.slice(0, 160),
    tipo: ia?.tipo || "otro",
    estado: "abierto",
    created_at: now,
    updated_at: now,
  };
  const rows = readAll();
  rows.unshift(row);
  writeAll(rows.slice(0, 500));

  log?.info?.({ id: row.id, tipo: row.tipo }, "Reclamo WA registrado");

  return {
    flow: "reclamo_abierto",
    reclamo: row,
    mensaje,
    message: mensaje,
  };
}
