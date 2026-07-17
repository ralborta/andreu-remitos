import { findLocalidad, limpiarTextoBusqueda, patentePlanilla } from "./planilla-common.mjs";

/** Formato patente argentina (Mercosur u old-style). */
export function patenteFormatoValido(raw) {
  const s = patentePlanilla(raw).replace(/[^A-Z0-9]/g, "");
  if (s.length < 5 || s.length > 8) return false;
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(s)) return true;
  if (/^[A-Z]{3}\d{3}$/.test(s)) return true;
  if (/^[A-Z]{2}\d{3}$/.test(s)) return true;
  return false;
}

function leerPatente(datos, keys) {
  for (const k of keys) {
    const v = datos[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function unidadExactaEnMaestros(unidades, patente, tipo) {
  const p = patentePlanilla(patente);
  if (!p) return null;
  return (
    unidades?.find(
      (u) => u.tipo === tipo && u.activo !== false && patentePlanilla(u.patente) === p,
    ) ?? null
  );
}

const CAMPOS_UNIDAD_TENANT = {
  tsb: [
    { label: "Tractor / chasis", keys: ["chasis", "patente_chasis"], tipo: "tractor" },
    { label: "Semi / remolque", keys: ["acoplado", "semi", "patente_acoplado"], tipo: "acoplado" },
  ],
  beraldi: [
    { label: "Tractor", keys: ["tractor", "chasis", "patente_chasis"], tipo: "tractor" },
    { label: "Semi", keys: ["semi", "acoplado", "patente_acoplado"], tipo: "acoplado" },
  ],
  corina: [{ label: "Tractor", keys: ["tractor", "patente_chasis"], tipo: "tractor" }],
};

/** Valida patentes contra maestros (después de canonicalizar). */
export function validarUnidadesConMaestros(datos, tenant, unidades) {
  const campos = CAMPOS_UNIDAD_TENANT[tenant] ?? CAMPOS_UNIDAD_TENANT.tsb;
  const errores = [];
  const faltantes = [];
  /** @type {Record<string, { id: string, patente: string, unidad_interna?: string }>} */
  const unidades_maestro = {};

  for (const { label, keys, tipo } of campos) {
    const valor = leerPatente(datos, keys);
    if (!valor) {
      faltantes.push(label);
      continue;
    }
    if (!patenteFormatoValido(valor)) {
      errores.push(`${label}: "${valor}" no es una patente válida — corregir antes de procesar`);
      continue;
    }
    if (!unidades?.length) continue;
    const u = unidadExactaEnMaestros(unidades, valor, tipo);
    if (!u) {
      errores.push(`${label}: "${valor}" no está en la base de unidades — corregir antes de procesar`);
      continue;
    }
    unidades_maestro[tipo] = {
      id: u.id,
      patente: u.patente,
      unidad_interna: u.unidad_interna,
    };
  }

  return {
    ok: errores.length === 0,
    errores,
    faltantes,
    unidades_maestro: Object.keys(unidades_maestro).length ? unidades_maestro : null,
  };
}

/** Texto de destino según tenant y campos OCR. */
export function destinoDesdeDatos(datos, tenant) {
  if (tenant === "beraldi") {
    // Priorizar `destino` (campo del editor) sobre aliases OCR que pueden quedar desactualizados.
    return datos.destino ?? datos.destino_nombre ?? datos.destino_locacion ?? "";
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

  const loc =
    findLocalidad(localidades, texto) ??
    findLocalidad(localidades, limpiarTextoBusqueda(texto));
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

function canonCampoDefault(texto, localidades) {
  if (texto == null || texto === "") return texto;
  const loc = findLocalidad(localidades, String(texto));
  return loc?.nombre ?? texto;
}

/**
 * Reescribe origen/destino al nombre canónico de maestros cuando hay match fuzzy.
 * Ej: "Pampa pad 13" → "PAMPA - PAD13"
 * @param {(texto: string) => string} [canonFn]
 */
export function canonicalizarLocalidadesEnDatos(datos, tenant, localidades, canonFn) {
  if (!datos || !localidades?.length) return datos;
  const d = { ...datos };

  const canon = canonFn ?? ((t) => canonCampoDefault(t, localidades));

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

/** Combina validación de horarios con reglas de maestros (destino + unidades). */
export function mergeValidacionRemito(validacionHorarios, destinoVal, unidadesVal = { ok: true, errores: [], faltantes: [] }) {
  const base = validacionHorarios ?? { valido: true, faltantes: [], errores: [] };
  const faltantes = [
    ...new Set([
      ...(base.faltantes ?? []),
      ...(destinoVal.faltantes ?? []),
      ...(unidadesVal.faltantes ?? []),
    ]),
  ];
  const errores = [
    ...new Set([
      ...(base.errores ?? []),
      ...(destinoVal.errores ?? []),
      ...(unidadesVal.errores ?? []),
    ]),
  ];
  const valido =
    (base.valido ?? true) && destinoVal.ok && unidadesVal.ok && faltantes.length === 0;

  return {
    ...base,
    valido,
    faltantes,
    errores,
    destino_maestro: destinoVal.localidad
      ? { id: destinoVal.localidad.id, nombre: destinoVal.localidad.nombre, codigo: destinoVal.localidad.codigo }
      : null,
    unidades_maestro: unidadesVal.unidades_maestro ?? null,
  };
}
