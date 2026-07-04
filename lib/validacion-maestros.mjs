import { findLocalidad } from "./planilla-common.mjs";

/** Texto de destino según tenant y campos OCR. */
export function destinoDesdeDatos(datos, tenant) {
  if (tenant === "beraldi") {
    return datos.destino_locacion ?? datos.destino_nombre ?? datos.destino ?? "";
  }
  if (tenant === "corina") {
    return datos.destino ?? datos.cliente ?? datos.destino_nombre ?? "";
  }
  return datos.destino ?? "";
}

export function validarDestinoConMaestros(datos, tenant, localidades) {
  const texto = String(destinoDesdeDatos(datos, tenant) ?? "").trim();
  if (!texto) {
    return { ok: true, localidad: null, errores: [], faltantes: ["destino"] };
  }
  if (!localidades?.length) {
    return { ok: true, localidad: null, errores: [], faltantes: [] };
  }

  const loc = findLocalidad(localidades, texto);
  if (!loc) {
    return {
      ok: false,
      localidad: null,
      errores: [`Destino "${texto}" no está en la base de localidades — corregir antes de procesar`],
      faltantes: [],
    };
  }

  if (tenant === "tsb" && loc.tipo === "origen") {
    return {
      ok: false,
      localidad: loc,
      errores: [`"${loc.nombre}" está registrada solo como origen, no como destino`],
      faltantes: [],
    };
  }

  return { ok: true, localidad: loc, errores: [], faltantes: [] };
}

function canonCampo(texto, localidades) {
  if (texto == null || texto === "") return texto;
  const loc = findLocalidad(localidades, String(texto));
  return loc?.nombre ?? texto;
}

/**
 * Reescribe origen/destino al nombre canónico de maestros cuando hay match fuzzy.
 * Ej: "Pampa pad 13" → "PAMPA - PAD13"
 */
export function canonicalizarLocalidadesEnDatos(datos, tenant, localidades) {
  if (!datos || !localidades?.length) return datos;
  const d = { ...datos };

  const canon = (t) => canonCampo(t, localidades);

  if (tenant === "beraldi") {
    if (d.destino_locacion != null && d.destino_locacion !== "") d.destino_locacion = canon(d.destino_locacion);
    if (d.destino_nombre != null && d.destino_nombre !== "") d.destino_nombre = canon(d.destino_nombre);
    if (d.destino != null && d.destino !== "") d.destino = canon(d.destino);
    if (d.origen != null && d.origen !== "") d.origen = canon(d.origen);
  } else if (tenant === "tsb") {
    if (d.destino != null && d.destino !== "") d.destino = canon(d.destino);
    if (d.procedencia != null && d.procedencia !== "") d.procedencia = canon(d.procedencia);
    if (d.origen != null && d.origen !== "") d.origen = canon(d.origen);
  } else {
    if (d.destino != null && d.destino !== "") d.destino = canon(d.destino);
    if (d.origen != null && d.origen !== "") d.origen = canon(d.origen);
    if (d.cliente != null && d.cliente !== "") d.cliente = canon(d.cliente);
  }

  return d;
}

/** Combina validación de horarios con reglas de maestros (destino). */
export function mergeValidacionRemito(validacionHorarios, destinoVal) {
  const base = validacionHorarios ?? { valido: true, faltantes: [], errores: [] };
  const faltantes = [...new Set([...(base.faltantes ?? []), ...(destinoVal.faltantes ?? [])])];
  const errores = [...new Set([...(base.errores ?? []), ...(destinoVal.errores ?? [])])];
  const valido = (base.valido ?? true) && destinoVal.ok && faltantes.length === 0;

  return {
    ...base,
    valido,
    faltantes,
    errores,
    destino_maestro: destinoVal.localidad
      ? { id: destinoVal.localidad.id, nombre: destinoVal.localidad.nombre, codigo: destinoVal.localidad.codigo }
      : null,
  };
}
