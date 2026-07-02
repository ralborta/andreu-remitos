import { ORDEN_CAMPOS } from "./horarios.mjs";

export { ORDEN_CAMPOS };

export function horasCompletasDesdeDatos(datos) {
  const slots = datos?.horarios?.horarios ?? {};
  return ORDEN_CAMPOS.every((k) => Boolean(slots[k]?.hora));
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
  if (!["confirmado", "pendiente_revision"].includes(row.estado)) return false;
  const { tenant, datos } = row;
  const validacion = row.validacion ?? datos?.horarios?.validacion ?? null;

  if (tenant === "corina") {
    return ["nro_remito", "fecha_remito", "conductor", "tractor"].every(
      (k) => datos[k] != null && datos[k] !== "",
    );
  }

  if (!horasCompletasDesdeDatos(datos)) return false;
  if (validacion?.errores?.length) return false;
  if (validacion?.faltantes?.length) return false;
  if (validacion && validacion.valido !== true) return false;
  return true;
}
