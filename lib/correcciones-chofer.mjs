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

function normalizarPatente(raw) {
  return String(raw ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
}

const PATENTE_RE = /([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i;

function normalizarKm(raw) {
  return String(raw ?? "").replace(/\s/g, "").replace(/\./g, "");
}

function normalizarPesoTexto(raw) {
  const s = String(raw ?? "").replace(/\s/g, "").replace(/\./g, "");
  const m = s.match(/^(\d+),(\d+)$/);
  if (m) return `${m[1]}.${m[2]}`;
  return s.replace(/,/g, "");
}

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
    t.match(/(?:actualiz(?:a|ar|o)|cambiar|cambia)\s*(?:el\s+)?(?:chasis|tractor|patente)\s*(?:a|por|en)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i);
  if (chasis) {
    return {
      campo: "patente_chasis",
      valor: normalizarPatente(chasis[1]),
      etiqueta: "Tractor / chasis",
    };
  }

  const semi =
    t.match(/(?:semi|acoplado|patente\s*acoplado)\s*(?:es|:)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i) ??
    t.match(/(?:actualiz(?:a|ar|o)|cambiar|cambia)\s*(?:el\s+)?(?:semi|acoplado)\s*(?:a|por|en)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i);
  if (semi) {
    return {
      campo: "patente_acoplado",
      valor: normalizarPatente(semi[1]),
      etiqueta: "Semi / acoplado",
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

/** Campos a persistir según tenant (incluye alias que usa la UI). */
export function patchCorreccionRemito(tenant, correccion) {
  const { campo, valor } = correccion;
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
