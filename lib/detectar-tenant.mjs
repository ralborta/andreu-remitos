import { detectarCorina } from "./extract-corina.mjs";

/** Puntúa señales TSB vs Beraldi en texto OCR. Mayor = más probable. */
export function puntuarTenant(texto) {
  const u = String(texto ?? "").toUpperCase();
  const scores = { tsb: 0, beraldi: 0, corina: 0, señales: { tsb: [], beraldi: [] } };

  if (detectarCorina(texto)) {
    scores.corina = 20;
    return scores;
  }

  const add = (tenant, pts, label) => {
    scores[tenant] += pts;
    scores.señales[tenant].push(label);
  };

  // —— Beraldi (más específico primero) ——
  if (/\bBERALDI\b/.test(u) || /\bERALDI\b/.test(u)) add("beraldi", 10, "marca BERALDI");
  if (/TRANSPORTES\s+JOSE/.test(u)) add("beraldi", 8, "Transportes José");
  if (/00009[-\s]?\d{4,}/.test(u)) add("beraldi", 8, "prefijo remito 00009");
  if (/REMITO\s*N[°º]?\s*\d{5}/.test(u) && !/GUIA\s+DE\s+TRANSPORTE/.test(u)) add("beraldi", 3, "formato REMITO N°");
  if (/\bDENOMINAC/.test(u) || /\bLOCACION\b/.test(u)) add("beraldi", 5, "campos DENOMINAC/LOCACION");
  if (/\bTRACTOR\b/.test(u) && /\bSEMI\b/.test(u)) add("beraldi", 4, "TRACTOR + SEMI");
  if (/\bCHOFER\b/.test(u) && !/\bCONDUCTOR\s*:/.test(u)) add("beraldi", 3, "etiqueta CHOFER");
  if (/\bO\.?\s*T\.?\b/.test(u)) add("beraldi", 2, "campo O.T.");
  if (/\bCLIENTE\s*:/.test(u) && /\bUNIDAD\b/.test(u)) add("beraldi", 2, "CLIENTE + UNIDAD");
  if (/\bCANTIDAD\b/.test(u) && /\bTNS?\b/.test(u)) add("beraldi", 2, "peso en toneladas");

  // —— TSB ——
  if (/\bTSB\b/.test(u)) add("tsb", 10, "marca TSB");
  if (/COMPA[NÑ]IA\s+DE\s+TRANSPORTES\s+SAN/.test(u)) add("tsb", 9, "Compañía Transportes San…");
  if (/\bPROCEDENCIA\b/.test(u)) add("tsb", 7, "campo PROCEDENCIA");
  if (/\bCHASIS\b/.test(u) && /\bACOPLADO\b/.test(u)) add("tsb", 6, "CHASIS + ACOPLADO");
  if (/\bCONDUCTOR\s*:/.test(u)) add("tsb", 4, "etiqueta CONDUCTOR:");
  if (/\bMALLA\b/.test(u)) add("tsb", 5, "campo MALLA");
  if (/\bINTERNO\b/.test(u) && /\bGUIA\b/.test(u)) add("tsb", 3, "N° interno guía");
  if (/GUIA\s+DE\s+TRANSPORTE/.test(u) && /\bTSB\b/.test(u)) add("tsb", 5, "Guía TSB");
  // "Guía de transporte" sola es ambigua — solo un punto débil si no hay BERALDI
  if (/GUIA\s+DE\s+TRANSPORTE/.test(u) && scores.beraldi < 4) add("tsb", 1, "Guía de transporte (débil)");
  if (/COMPA[NÑ]IA\s+DE\s+TRANSPORTES/.test(u) && !/\bBERALDI\b/.test(u) && scores.beraldi < 4) {
    add("tsb", 2, "Compañía de transportes (débil)");
  }

  return scores;
}

/** @returns {{ tenant: string, confianza: number, margen: number, scores: object }} */
export function detectarTenantConConfianza(texto) {
  const scores = puntuarTenant(texto);
  if (scores.corina >= 10) {
    return { tenant: "corina", confianza: 1, margen: scores.corina, scores };
  }

  const tsb = scores.tsb;
  const beraldi = scores.beraldi;
  const total = tsb + beraldi;

  if (total === 0) {
    return { tenant: "desconocido", confianza: 0, margen: 0, scores };
  }

  const tenant = tsb > beraldi ? "tsb" : beraldi > tsb ? "beraldi" : "desconocido";
  const margen = Math.abs(tsb - beraldi);
  const confianza = total > 0 ? margen / total : 0;

  return { tenant, confianza, margen, scores };
}

/** Compat: detectarTenant clásico (mejorado). */
export function detectarTenant(texto) {
  const { tenant } = detectarTenantConConfianza(texto);
  return tenant;
}

/** Calidad de extracción según campos clave del tenant. */
export function scoreLectura(lectura, tenant) {
  if (!lectura) return 0;
  const keys =
    tenant === "tsb"
      ? ["nro_guia", "destino", "conductor", "chasis", "acoplado", "procedencia", "peso_kg"]
      : ["nro_remito", "fecha_remito", "chofer", "tractor", "semi", "destino_nombre", "peso_kg"];

  let score = 0;
  for (const k of keys) {
    const v = lectura[k];
    if (v != null && v !== "") score += 2;
  }
  const extra = lectura.resumen?.campos_extraidos?.ok ?? 0;
  return score + extra;
}

function iaHabilitada() {
  if (process.env.TENANT_IA_ENABLED === "false") return false;
  if (process.env.CORRECCION_IA_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

let authClient;

async function getAuth() {
  if (!authClient) {
    const { GoogleAuth } = await import("google-auth-library");
    const { gcpClientOptions } = await import("./gcp-credentials.mjs");
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      ...gcpClientOptions(),
    });
  }
  return authClient;
}

function extraerJson(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
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

/**
 * Clasifica tenant con Gemini a partir del texto OCR (sin reprocesar imagen).
 * @param {string} textoOcr
 * @param {{ log?: { warn?: Function, info?: Function } }} [opts]
 */
export async function detectarTenantConIA(textoOcr, opts = {}) {
  if (!iaHabilitada() || !textoOcr?.trim()) return null;

  const excerpt = String(textoOcr).slice(0, 3500);
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GEMINI_LOCATION?.trim() || "us-central1";
  const model = process.env.GEMINI_TENANT_MODEL?.trim() || process.env.GEMINI_CORRECCION_MODEL?.trim() || "gemini-2.5-flash";

  const prompt = `Sos un clasificador de remitos de transporte argentino. Analizá el texto OCR de una foto y determiná el cliente emisor.

Clientes posibles:
- "tsb": Guías TSB (Compañía de Transportes). Suele decir TSB, "Guía de transporte", campos CHASIS, ACOPLADO, PROCEDENCIA, CONDUCTOR, MALLA.
- "beraldi": Remitos Transportes José Beraldi. Suele decir BERALDI, remito con prefijo 00009, campos TRACTOR, SEMI, CHOFER, DENOMINAC, LOCACION, CLIENTE.
- "corina": Remitos Quilmes / cervecería Corina.
- null: no se puede determinar.

Texto OCR:
"""
${excerpt}
"""

Respondé SOLO JSON:
{"tenant":"tsb"|"beraldi"|"corina"|null,"confianza":0.0-1.0,"motivo":"breve"}`;

  try {
    const auth = await getAuth();
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) return null;

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
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              tenant: { type: "string", nullable: true },
              confianza: { type: "number" },
              motivo: { type: "string" },
            },
            required: ["tenant", "confianza"],
          },
        },
      }),
      signal: AbortSignal.timeout(Number(process.env.TENANT_IA_TIMEOUT_MS) || 10000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${errBody.slice(0, 150)}`);
    }

    const data = await res.json();
    const partText = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    const parsed = extraerJson(partText);
    const t = String(parsed?.tenant ?? "").toLowerCase();
    if (!["tsb", "beraldi", "corina"].includes(t)) return null;

    opts.log?.info?.({ tenant: t, confianza: parsed.confianza, motivo: parsed.motivo }, "Tenant detectado con IA");

    return {
      tenant: t,
      confianza: Number(parsed.confianza) || 0.7,
      motivo: parsed.motivo ?? null,
      fuente: "ia",
    };
  } catch (err) {
    opts.log?.warn?.({ err: err.message }, "IA tenant no disponible");
    return null;
  }
}

/**
 * Elige tenant final: documento > IA > sugerencia (teléfono).
 * @param {{ detectado: object, lecturaBeraldi?: object, lecturaTsb?: object, ia?: object, sugerido?: string|null }} ctx
 */
export function elegirTenantFinal(ctx) {
  const { detectado, lecturaBeraldi, lecturaTsb, ia, sugerido } = ctx;
  const scoreB = lecturaBeraldi ? scoreLectura(lecturaBeraldi, "beraldi") + detectado.scores.beraldi : detectado.scores.beraldi;
  const scoreT = lecturaTsb ? scoreLectura(lecturaTsb, "tsb") + detectado.scores.tsb : detectado.scores.tsb;

  /** @type {{ tenant: string, razon: string, confianza: number }} */
  let out = { tenant: "beraldi", razon: "default", confianza: 0 };

  // Heurística OCR con margen claro
  if (detectado.margen >= 4 && detectado.tenant !== "desconocido") {
    out = { tenant: detectado.tenant, razon: "ocr_heuristica", confianza: detectado.confianza };
  }

  // IA desempata cuando heurística duda o scores de extracción empatan
  if (ia?.tenant && (detectado.margen < 4 || Math.abs(scoreB - scoreT) <= 3)) {
    if (ia.confianza >= 0.65) {
      out = { tenant: ia.tenant, razon: "ia", confianza: ia.confianza };
    }
  }

  // Comparar calidad de extracción dual cuando hay ambos processors
  if (lecturaBeraldi && lecturaTsb && out.confianza < 0.75) {
    const diff = scoreB - scoreT;
    if (Math.abs(diff) >= 3) {
      out = {
        tenant: diff > 0 ? "beraldi" : "tsb",
        razon: "extraccion_dual",
        confianza: Math.min(0.95, 0.5 + Math.abs(diff) * 0.05),
      };
    }
  }

  // Si sigue desconocido, usar sugerido del chofer
  if (out.razon === "default" && sugerido) {
    out = { tenant: sugerido, razon: "chofer_sugerido", confianza: 0.4 };
  } else if (detectado.tenant !== "desconocido" && out.razon === "default") {
    out = { tenant: detectado.tenant, razon: "ocr_heuristica_debil", confianza: detectado.confianza };
  }

  // Advertencia si sugerido del chofer difiere del documento con confianza alta
  const advertencia =
    sugerido && sugerido !== out.tenant && out.confianza >= 0.6
      ? {
          esperado: sugerido,
          detectado: out.tenant,
          razon: out.razon,
          mensaje: `El papel es ${out.tenant.toUpperCase()} pero el chofer está registrado en ${sugerido.toUpperCase()} — se usó el documento`,
        }
      : null;

  return { ...out, advertencia, scoreB, scoreT };
}
