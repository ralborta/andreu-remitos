import { ORDEN_CAMPOS, ETIQUETAS } from "./horarios.mjs";

export { ORDEN_CAMPOS };

const ETIQUETAS_HORARIO = new Set(Object.values(ETIQUETAS));

export function horasCompletasDesdeDatos(datos) {
  const slots = datos?.horarios?.horarios ?? {};
  return ORDEN_CAMPOS.every((k) => Boolean(slots[k]?.hora));
}

function esFaltanteHorario(f) {
  return ETIQUETAS_HORARIO.has(f);
}

/** Errores de validación que no son de horarios (destino, etc.). */
function esErrorHorario(e) {
  const s = String(e);
  if (/destino|localidad|origen|procedencia/i.test(s)) return false;
  if (/está registrada solo como origen/i.test(s)) return false;
  return (
    /hora|anterior a|carga|descarga|inválida/i.test(s) ||
    [...ETIQUETAS_HORARIO].some((et) => s.includes(et))
  );
}

/**
 * TSB: ignora faltantes/errores de horarios al procesar.
 * Sigue bloqueando destino u otros datos críticos.
 */
export function motivosBloqueoProcesoTsb(validacion) {
  if (!validacion || validacion.valido === true) return [];
  const motivos = [];
  for (const f of validacion.faltantes ?? []) {
    if (!esFaltanteHorario(f)) motivos.push(`Falta: ${f}`);
  }
  for (const e of validacion.errores ?? []) {
    if (!esErrorHorario(e)) motivos.push(e);
  }
  return motivos;
}

/**
 * ¿Se puede marcar como procesado / incluir en planilla?
 * @param {{ tenant: string, estado: string, datos: object, validacion?: object|null }} row
 */
export function evaluarProcesable(row) {
  const { tenant, estado, datos, validacion } = row;
  const motivos = [];

  if (estado === "confirmado") {
    return { ok: false, motivos: ["Ya procesado"] };
  }
  if (estado === "error_lectura") {
    return { ok: false, motivos: ["Error de lectura — corregir campos"] };
  }

  if (tenant === "tsb") {
    const bloqueos = motivosBloqueoProcesoTsb(validacion);
    return { ok: bloqueos.length === 0, motivos: bloqueos };
  }

  if (tenant !== "corina" && horasCompletasDesdeDatos(datos) && validacion?.valido === true) {
    return { ok: true, motivos: [] };
  }

  if (tenant === "corina") {
    for (const k of ["nro_remito", "fecha_remito", "conductor", "tractor"]) {
      if (datos[k] == null || datos[k] === "") {
        motivos.push(`Falta ${k.replace(/_/g, " ")}`);
      }
    }
    return { ok: motivos.length === 0, motivos };
  }

  if (!horasCompletasDesdeDatos(datos)) {
    motivos.push("Faltan horarios (5 controles carga/descarga)");
  }
  if (validacion?.faltantes?.length) {
    for (const f of validacion.faltantes) motivos.push(`Falta: ${f}`);
  }
  if (validacion?.errores?.length) {
    motivos.push(...validacion.errores);
  }
  if (validacion && validacion.valido !== true && motivos.length === 0) {
    motivos.push("Validación incompleta — revisar horarios y destino");
  }

  return { ok: motivos.length === 0, motivos };
}

export function remitoListoParaPlanilla(row) {
  if (!["confirmado", "pendiente_revision", "bloqueado", "incompleto"].includes(row.estado)) {
    return false;
  }
  const { tenant, datos } = row;
  const validacion = row.validacion ?? datos?.horarios?.validacion ?? null;

  if (tenant === "corina") {
    return ["nro_remito", "fecha_remito", "conductor", "tractor"].every(
      (k) => datos[k] != null && datos[k] !== "",
    );
  }

  if (tenant === "tsb") {
    return motivosBloqueoProcesoTsb(validacion).length === 0;
  }

  if (!horasCompletasDesdeDatos(datos)) return false;
  if (validacion?.errores?.length) return false;
  if (validacion?.faltantes?.length) return false;
  if (validacion && validacion.valido !== true) return false;
  return true;
}
