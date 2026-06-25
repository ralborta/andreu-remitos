/**
 * Interpreta correcciones del chofer por texto o audio transcrito.
 * Ej: "Km finales 71221", "el chasis es AH860KG"
 */
export function parseCorreccionChofer(texto) {
  if (!texto?.trim()) return null;
  const raw = texto.trim();
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const kmFinal = t.match(/km\s*(?:final(?:es)?|fin|finales?)\s*[:.]?\s*([\d.\s]+)/);
  if (kmFinal) {
    const valor = kmFinal[1].replace(/\s/g, "").replace(/\./g, "");
    return { campo: "km_final", valor, etiqueta: "KM final" };
  }

  const kmInicial = t.match(/km\s*(?:inicial(?:es)?|ini|inicio)\s*[:.]?\s*([\d.\s]+)/);
  if (kmInicial) {
    const valor = kmInicial[1].replace(/\s/g, "").replace(/\./g, "");
    return { campo: "km_inicial", valor, etiqueta: "KM inicial" };
  }

  const chasis = t.match(/(?:chasis|tractor|patente)\s*(?:es|:)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i);
  if (chasis) {
    return { campo: "patente_chasis", valor: chasis[1].replace(/\s/g, "").toUpperCase(), etiqueta: "Tractor" };
  }

  const semi = t.match(/(?:semi|acoplado)\s*(?:es|:)?\s*([a-z]{2}\s?\d{3}\s?[a-z]{2}|\w{6,8})/i);
  if (semi) {
    return { campo: "patente_acoplado", valor: semi[1].replace(/\s/g, "").toUpperCase(), etiqueta: "Semi" };
  }

  if (/^(ok|correcto|esta bien|está bien|confirmo|si|sí)$/i.test(raw)) {
    return { campo: "_confirmacion", valor: true, etiqueta: "Confirmación" };
  }

  return null;
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
