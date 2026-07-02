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
