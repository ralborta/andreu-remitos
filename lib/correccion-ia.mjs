import { GoogleAuth } from "google-auth-library";
import { gcpClientOptions } from "./gcp-credentials.mjs";
import { normalizarFecha } from "./horarios.mjs";
import { esPalabraConfirmacion } from "./sanitizar-campos-remito.mjs";

const CAMPOS_VALIDOS = new Set([
  "km_final",
  "km_inicial",
  "patente_chasis",
  "patente_acoplado",
  "chofer",
  "destino",
  "origen",
  "peso_kg",
  "nro_remito",
  "fecha",
  "_confirmacion",
]);

const ETIQUETAS = {
  km_final: "KM final",
  km_inicial: "KM inicial",
  patente_chasis: "Tractor / chasis",
  patente_acoplado: "Semi / acoplado",
  chofer: "Chofer",
  destino: "Destino",
  origen: "Origen",
  peso_kg: "Peso (kg)",
  nro_remito: "Nro remito / guía",
  fecha: "Fecha",
  _confirmacion: "Confirmación",
};

let authClient;

function getAuth() {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      ...gcpClientOptions(),
    });
  }
  return authClient;
}

function iaHabilitada() {
  if (process.env.CORRECCION_IA_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

/** Heurística: ¿el mensaje parece una corrección de remito y no un saludo? */
export function pareceCorreccionRemito(texto) {
  const raw = String(texto ?? "").trim();
  if (raw.length < 4) return false;

  if (/^(hola|buen[oa]s(?:s)?(?:\s+tardes?|\s+d[ií]as?)?|gracias|chau|adi[oó]s|ok|si|s[ií]|dale|listo|perfecto)$/i.test(raw)) {
    return false;
  }

  const t = raw.toLowerCase();
  const keywords =
    /km|kil[oó]met|peso|kilos?|kg\b|destino|origen|procedencia|chofer|conductor|chasis|tractor|semi|acoplado|patente|dominio|gu[ií]a|remito|n[uú]mero|fecha|corrige|corregir|actualiz|cambi|estaba mal|est[aá] mal|no es|en realidad|deber[ií]a|incorrect|faltaba|mal le[ií]|mal el|era |eran |son /i;

  return keywords.test(t) || /\d{3,}/.test(raw);
}

function resumenDatosRemito(datos, tenant) {
  if (!datos || typeof datos !== "object") return null;
  const d = datos;
  return {
    tenant: tenant ?? d.tenant ?? null,
    nro: d.nro_remito ?? d.nro_guia ?? null,
    chofer: d.chofer ?? d.conductor ?? null,
    tractor: d.tractor ?? d.chasis ?? d.patente_chasis ?? null,
    semi: d.semi ?? d.acoplado ?? d.patente_acoplado ?? null,
    origen: d.origen ?? d.procedencia ?? null,
    destino: d.destino ?? d.destino_nombre ?? d.destino_locacion ?? null,
    peso_kg: d.peso_kg ?? d.peso ?? null,
    km_final: d.km_final ?? null,
    km_inicial: d.km_inicial ?? null,
    fecha: d.fecha_guia ?? d.fecha_remito ?? d.fecha ?? null,
  };
}

function buildPrompt(texto, { tenant, datos }) {
  const ctx = resumenDatosRemito(datos, tenant);
  return `Sos un asistente logístico argentino. Un chofer envió un mensaje por WhatsApp para corregir datos de su remito recién fotografiado.

Mensaje del chofer:
"""
${texto}
"""

Datos actuales del remito (referencia):
${JSON.stringify(ctx, null, 2)}

Extraé UNA corrección concreta si el mensaje indica cambiar un campo. Si solo confirma que está bien (ok, dale, correcto), usá campo "_confirmacion" con valor true.
Si NO es una corrección ni confirmación (saludo, pregunta, charla), respondé correccion null.

Campos permitidos (campo):
- km_final, km_inicial
- patente_chasis (tractor/chasis/patente delantera)
- patente_acoplado (semi/acoplado)
- chofer (nombre del conductor)
- destino
- origen (o procedencia en TSB)
- peso_kg (número en kg, sin puntos de miles)
- nro_remito (número de guía/remito)
- fecha (fecha del remito/guía, formato ISO yyyy-mm-dd)
- _confirmacion (solo confirmación sin cambio de dato)

Reglas:
- Patentes argentinas en mayúsculas sin espacios (ej: AH860KG).
- Peso: convertí palabras a número (ej: "treinta y un mil" → "31000").
- KM: solo dígitos.
- Destino/origen/chofer: conservá mayúsculas razonables del mensaje.
- Fecha: dd/mm/yyyy o dd/mm/yy → yyyy-mm-dd (ej: 04/07/2026 → 2026-07-04).
- Cliente/tenant: ${tenant ?? "desconocido"}.

Respondé SOLO el JSON, sin texto antes ni después:
{"correccion": null}
o
{"correccion": {"campo": "peso_kg", "valor": "31120", "etiqueta": "Peso (kg)"}}`;
}

function extraerJson(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* ignore */
      }
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function normalizarValorIA(campo, valor) {
  if (campo === "_confirmacion") return true;
  if (valor == null || valor === "") return null;

  if (campo === "patente_chasis" || campo === "patente_acoplado") {
    if (esPalabraConfirmacion(valor)) return null;
    const p = String(valor).replace(/\s/g, "").toUpperCase();
    return p.length >= 5 && !esPalabraConfirmacion(p) ? p : null;
  }
  if (campo === "km_final" || campo === "km_inicial") {
    return String(valor).replace(/\D/g, "");
  }
  if (campo === "peso_kg") {
    const s = String(valor).replace(/\s/g, "").replace(/\./g, "");
    const m = s.match(/^(\d+),(\d+)$/);
    return m ? `${m[1]}.${m[2]}` : s.replace(/,/g, "");
  }
  if (campo === "fecha") {
    return normalizarFecha(valor) ?? String(valor).replace(/\s+/g, " ").trim();
  }
  return String(valor).replace(/\s+/g, " ").trim();
}

function validarCorreccionIA(obj) {
  if (!obj || typeof obj !== "object") return null;
  const campo = String(obj.campo ?? "").trim();
  if (!CAMPOS_VALIDOS.has(campo)) return null;

  if (campo === "_confirmacion") {
    return { campo, valor: true, etiqueta: ETIQUETAS[campo], fuente: "ia" };
  }

  const valor = normalizarValorIA(campo, obj.valor);
  if (valor == null || valor === "") return null;

  return {
    campo,
    valor,
    etiqueta: String(obj.etiqueta ?? ETIQUETAS[campo] ?? campo),
    fuente: "ia",
  };
}

/**
 * Interpreta corrección en lenguaje natural con Gemini (Vertex AI).
 * @param {string} texto
 * @param {{ tenant?: string, datos?: object, log?: { warn?: Function, info?: Function } }} [opts]
 */
export async function parseCorreccionConIA(texto, opts = {}) {
  if (!iaHabilitada() || !texto?.trim()) return null;

  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model = process.env.GEMINI_CORRECCION_MODEL?.trim() || "gemini-2.5-flash";

  try {
    const auth = getAuth();
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Sin token GCP");

    const url =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
      `/locations/${location}/publishers/google/models/${model}:generateContent`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(texto, opts) }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              correccion: {
                type: "object",
                nullable: true,
                properties: {
                  campo: { type: "string" },
                  valor: { type: "string" },
                  etiqueta: { type: "string" },
                },
                required: ["campo", "valor"],
              },
            },
            required: ["correccion"],
          },
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.CORRECCION_IA_TIMEOUT_MS) || 12000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const partText = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    const parsed = extraerJson(partText);
    const correccion = validarCorreccionIA(parsed?.correccion);

    if (correccion) {
      opts.log?.info?.({ campo: correccion.campo, fuente: "ia" }, "Corrección interpretada con IA");
    }

    return correccion;
  } catch (err) {
    opts.log?.warn?.({ err: err.message }, "IA corrección no disponible");
    return null;
  }
}
