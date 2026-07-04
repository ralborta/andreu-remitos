import { palabrasANumero } from "./numero-palabras.mjs";
import { normalizarPatente } from "./normalizar-remito.mjs";

function pareceCorreccionRemito(texto) {
  const raw = String(texto ?? "").trim();
  if (raw.length < 4) return false;

  if (/^(hola|buen[oa]s(?:s)?(?:\s+tardes?|\s+d[ií]as?)?|gracias|chau|adi[oó]s|ok|si|s[ií]|dale|listo|perfecto)$/i.test(raw)) {
    return false;
  }

  const t = raw.toLowerCase();
  const keywords =
    /km|kil[oó]met|peso|kilos?|kg\b|destino|origen|procedencia|chofer|conductor|chasis|tractor|semi|acoplado|patente|dominio|gu[ií]a|remito|n[uú]mero|corrige|corregir|actualiz|cambi|estaba mal|est[aá] mal|no es|en realidad|deber[ií]a|incorrect|faltaba|mal le[ií]|mal el|era |eran |son /i;

  return keywords.test(t) || /\d{3,}/.test(raw);
}

function normalizarTexto(texto) {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function limpiarValor(texto) {
  return String(texto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!,;]+$/g, "")
    .trim();
}

function normalizarKm(raw) {
  return String(raw ?? "").replace(/\s/g, "").replace(/\./g, "");
}

function normalizarPesoTexto(raw) {
  const s = String(raw ?? "").replace(/\s/g, "").replace(/\./g, "");
  const m = s.match(/^(\d+),(\d+)$/);
  if (m) return `${m[1]}.${m[2]}`;
  return s.replace(/,/g, "");
}

const PATENTE_INLINE = /\b([A-Z]{2}\s?\d{3}\s?[A-Z]{2})\b/i;

/**
 * Interpreta correcciones del chofer por texto o audio transcrito.
 * Ej: "Km finales 71221", "el chasis es AH860KG", "destino es Pacheco"
 */
export function parseCorreccionChofer(texto) {
  if (!texto?.trim()) return null;
  const raw = texto.trim();
  const t = normalizarTexto(raw);

  const kmFinal =
    t.match(/km\s*(?:final(?:es)?|fin|finales?)\s*[:.]?\s*([\d.\s]+)/) ??
    t.match(/([\d.\s]+)\s*km\s*(?:final(?:es)?|fin|finales?)/);
  if (kmFinal) {
    return { campo: "km_final", valor: normalizarKm(kmFinal[1]), etiqueta: "KM final" };
  }

  const kmInicial =
    t.match(/km\s*(?:inicial(?:es)?|ini|inicio)\s*[:.]?\s*([\d.\s]+)/) ??
    t.match(/([\d.\s]+)\s*km\s*(?:inicial(?:es)?|ini|inicio)/);
  if (kmInicial) {
    return { campo: "km_inicial", valor: normalizarKm(kmInicial[1]), etiqueta: "KM inicial" };
  }

  const chasis =
    t.match(/(?:chasis|tractor|patente\s*chasis|dominio)\s*(?:es|:)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i) ??
    t.match(/(?:actualiz(?:a|ar|o)|cambiar|cambia)\s*(?:el\s+)?(?:chasis|tractor|patente)\s*(?:a|por|en)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i) ??
    raw.match(/\bchasis\s+([A-Za-z0-9+\s]{6,12})\b/i) ??
    raw.match(/\btractor\s+([A-Za-z0-9+\s]{6,12})\b/i);
  if (chasis) {
    return {
      campo: "patente_chasis",
      valor: normalizarPatente(chasis[1]),
      etiqueta: "Tractor / chasis",
    };
  }

  const semi =
    t.match(/(?:semi|acoplado|patente\s*acoplado|remolque)\s*(?:es|:)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i) ??
    t.match(/(?:actualiz(?:a|ar|o)|cambiar|cambia)\s*(?:el\s+)?(?:semi|acoplado|remolque)\s*(?:a|por|en)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i) ??
    raw.match(/\bacoplado\s+([A-Za-z0-9+\s]{6,12})\b/i) ??
    raw.match(/\bsemi\s+([A-Za-z0-9+\s]{6,12})\b/i);
  if (semi) {
    return {
      campo: "patente_acoplado",
      valor: normalizarPatente(semi[1]),
      etiqueta: "Semi / remolque",
    };
  }

  const chofer = raw.match(/(?:el\s+)?(?:chofer|conductor)\s*(?:es|:)\s*(.+)/i);
  if (chofer) {
    const valor = limpiarValor(chofer[1]);
    if (valor.length >= 2) {
      return { campo: "chofer", valor, etiqueta: "Chofer" };
    }
  }

  const destino = raw.match(/(?:el\s+)?destino\s*(?:es|:)\s*(.+)/i);
  if (destino) {
    const valor = limpiarValor(destino[1]);
    if (valor.length >= 2) {
      return { campo: "destino", valor, etiqueta: "Destino" };
    }
  }

  const origen = raw.match(/(?:el\s+)?(?:origen|procedencia)\s*(?:es|:)\s*(.+)/i);
  if (origen) {
    const valor = limpiarValor(origen[1]);
    if (valor.length >= 2) {
      return { campo: "origen", valor, etiqueta: "Origen" };
    }
  }

  const peso = t.match(/(?:peso|kilos?|kg)\s*(?:es|:)?\s*([\d.,\s]+)/i);
  if (peso) {
    const valor = normalizarPesoTexto(peso[1]);
    if (valor) return { campo: "peso_kg", valor, etiqueta: "Peso (kg)" };
  }

  const nro =
    raw.match(/(?:nro|numero|num|guia|guía|remito)\s*(?:es|:)?\s*([\w\-\/]+)/i) ??
    raw.match(/(?:guia|guía|remito)\s+([\w\-\/]+)/i);
  if (nro) {
    const valor = limpiarValor(nro[1]);
    if (valor.length >= 2) {
      return { campo: "nro_remito", valor, etiqueta: "Nro remito / guía" };
    }
  }

  if (/^(ok|dale|listo|correcto|esta bien|está bien|confirmo|confirmado|perfecto|si|sí|todo bien)$/i.test(raw)) {
    return { campo: "_confirmacion", valor: true, etiqueta: "Confirmación" };
  }

  return null;
}

/**
 * Parser heurístico para frases naturales que el regex estricto no cubre.
 */
export function parseCorreccionHeuristica(texto) {
  if (!texto?.trim()) return null;
  const raw = texto.trim();
  const t = normalizarTexto(raw);

  if (/(?:peso|kilos?|kg)\b/.test(t) || /(?:estaba|esta)\s+mal/.test(t) || /\beran?\b/.test(t)) {
    const digits = raw.match(/([\d][\d.\s,]{2,})/);
    if (digits) {
      const valor = normalizarPesoTexto(digits[1]);
      if (valor) return { campo: "peso_kg", valor, etiqueta: "Peso (kg)", fuente: "heuristica" };
    }
    const n = palabrasANumero(raw);
    if (n != null && n >= 100) {
      return { campo: "peso_kg", valor: String(n), etiqueta: "Peso (kg)", fuente: "heuristica" };
    }
  }

  const kmCtx = /km|kilomet/.test(t);
  if (kmCtx) {
    const n = palabrasANumero(raw) ?? raw.match(/([\d][\d.\s]{3,})/)?.[1]?.replace(/\D/g, "");
    if (n) {
      const valor = String(n).replace(/\D/g, "");
      const esFinal = /final|finales|fin\b/.test(t);
      return {
        campo: esFinal ? "km_final" : "km_inicial",
        valor,
        etiqueta: esFinal ? "KM final" : "KM inicial",
        fuente: "heuristica",
      };
    }
  }

  const destinoNo =
    raw.match(/(?:no\s+)?(?:el\s+)?destino\s+(?:correcto\s+)?(?:es|:)\s*(.+?)(?:\s+no\s+(?:es|el|era)\s|\s*$)/i) ??
    raw.match(/no\s+(?:es|era)\s+[^,]+?\s+(?:es|era)\s+(.+?)(?:\s+no\s|$)/i);
  if (destinoNo) {
    let valor = limpiarValor(destinoNo[1]);
    valor = valor.replace(/\s+no\s+.+$/i, "").trim();
    if (valor.length >= 2) {
      return { campo: "destino", valor, etiqueta: "Destino", fuente: "heuristica" };
    }
  }

  if (/(?:patente|tractor|chasis|semi|acoplado|dominio)/i.test(raw)) {
    const m = raw.match(PATENTE_INLINE);
    if (m) {
      const valor = normalizarPatente(m[1]);
      const esSemi = /semi|acoplado/i.test(raw) && !/tractor|chasis|dominio/i.test(raw);
      return {
        campo: esSemi ? "patente_acoplado" : "patente_chasis",
        valor,
        etiqueta: esSemi ? "Semi / acoplado" : "Tractor / chasis",
        fuente: "heuristica",
      };
    }
  }

  const corrige = raw.match(
    /(?:corrige|corregir|actualiza|actualizar|cambia|cambiar)\s+(?:el\s+)?(peso|destino|origen|chofer|conductor|km|patente|tractor|semi)\s*(?:a|por|en|:)?\s*(.+)/i,
  );
  if (corrige) {
    const tipo = normalizarTexto(corrige[1]);
    const resto = limpiarValor(corrige[2]);
    if (tipo.includes("peso")) {
      const n = palabrasANumero(resto) ?? normalizarPesoTexto(resto.match(/[\d.,]+/)?.[0] ?? "");
      if (n) return { campo: "peso_kg", valor: String(n), etiqueta: "Peso (kg)", fuente: "heuristica" };
    }
    if (tipo.includes("destino") && resto.length >= 2) {
      return { campo: "destino", valor: resto, etiqueta: "Destino", fuente: "heuristica" };
    }
    if ((tipo.includes("origen") || tipo.includes("proced")) && resto.length >= 2) {
      return { campo: "origen", valor: resto, etiqueta: "Origen", fuente: "heuristica" };
    }
    if ((tipo.includes("chofer") || tipo.includes("conductor")) && resto.length >= 2) {
      return { campo: "chofer", valor: resto, etiqueta: "Chofer", fuente: "heuristica" };
    }
  }

  return null;
}

/**
 * Parser regex → heurística → Gemini (si hay remito vinculado).
 */
export async function resolveCorreccionChofer(texto, opts = {}) {
  const directa = parseCorreccionChofer(texto);
  if (directa) return directa;

  const heuristica = parseCorreccionHeuristica(texto);
  if (heuristica) return heuristica;

  if (!opts.remitoVinculado || !pareceCorreccionRemito(texto)) return null;

  const { parseCorreccionConIA } = await import("./correccion-ia.mjs");
  return parseCorreccionConIA(texto, {
    tenant: opts.tenant,
    datos: opts.datos,
    log: opts.log,
  });
}

/** Campos a persistir según tenant (incluye alias que usa la UI). */
export function patchCorreccionRemito(tenant, correccion) {
  let { campo, valor } = correccion;
  if (campo === "patente_chasis" || campo === "patente_acoplado") {
    valor = normalizarPatente(valor);
  }
  /** @type {Record<string, string|number|boolean>} */
  const patch = {};

  const assign = (keys, v) => {
    for (const k of keys) patch[k] = v;
  };

  switch (campo) {
    case "km_final":
    case "km_inicial":
      patch[campo] = valor;
      break;
    case "patente_chasis":
      if (tenant === "beraldi") assign(["tractor", "patente_chasis"], valor);
      else if (tenant === "tsb") assign(["chasis", "patente_chasis"], valor);
      else if (tenant === "corina") assign(["tractor", "patente_chasis", "patente", "dominio"], valor);
      else patch.patente_chasis = valor;
      break;
    case "patente_acoplado":
      if (tenant === "beraldi") assign(["semi", "patente_acoplado"], valor);
      else if (tenant === "tsb") assign(["acoplado", "patente_acoplado"], valor);
      else if (tenant === "corina") assign(["semi", "patente_acoplado"], valor);
      else patch.patente_acoplado = valor;
      break;
    case "chofer":
      if (tenant === "tsb" || tenant === "corina") assign(["conductor", "chofer"], valor);
      else patch.chofer = valor;
      break;
    case "destino":
      if (tenant === "beraldi") assign(["destino", "destino_nombre", "destino_locacion"], valor);
      else patch.destino = valor;
      break;
    case "origen":
      if (tenant === "tsb") patch.procedencia = valor;
      else patch.origen = valor;
      break;
    case "peso_kg":
      patch.peso_kg = valor;
      break;
    case "nro_remito":
      if (tenant === "tsb") patch.nro_guia = valor;
      else patch.nro_remito = valor;
      break;
    default:
      patch[campo] = valor;
  }

  return patch;
}

export function mensajeCorreccionAplicada(correccion, lectura) {
  const d = lectura ?? {};
  const lineas = [`Gracias. Actualicé *${correccion.etiqueta}*: ${correccion.valor}.`];

  if (d.nro_remito || d.nro_guia) lineas.push(`Nro remito: ${d.nro_remito ?? d.nro_guia}`);
  if (d.km_final != null) lineas.push(`KM final: ${d.km_final}`);
  if (d.km_inicial != null) lineas.push(`KM inicial: ${d.km_inicial}`);

  lineas.push("\n¿Está todo correcto? Respondé *OK* o mandame otro audio con la corrección.");
  return lineas.join("\n");
}
