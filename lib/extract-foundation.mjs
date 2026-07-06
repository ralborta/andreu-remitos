import {
  normalizarFecha,
  normalizarHora,
  validarOrdenHorarios,
} from "./horarios.mjs";
import { normalizarPeso } from "./extract-cold.mjs";
import { normalizarNroRemitoGuia } from "./sanitizar-campos-remito.mjs";
import { enriquecerTSBDesdeTexto } from "./enriquecer-tsb-ocr.mjs";

function limpiarTexto(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

/** @param {{ tipo: string, valor: string }[]} entidades */
export function entidadesAMapa(entidades) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const e of entidades) {
    if (e.tipo && e.valor) map[e.tipo] = limpiarTexto(e.valor.replace(/\n/g, " "));
  }
  return map;
}

function slotHora(fechaRemito, raw) {
  return {
    fecha: fechaRemito,
    hora: normalizarHora(raw),
  };
}

/** @param {Record<string, string>} campos @param {string} [textoOcr] */
export function extraerBeraldiFoundation(campos, textoOcr = "") {
  const fechaRemito = normalizarFecha(campos.fecha);

  const horariosRaw = {
    carga_entrada: slotHora(fechaRemito, campos.hora_carga_entrada),
    carga_salida: slotHora(fechaRemito, campos.hora_carga_salida),
    descarga_llegada: slotHora(fechaRemito, campos.hora_descarga_llegada),
    descarga_inicio: slotHora(fechaRemito, campos.hora_descarga_inicio),
    descarga_fin: slotHora(fechaRemito, campos.hora_descarga_fin),
  };

  const horariosBlock = {
    tenant: "beraldi",
    fecha_remito: fechaRemito,
    horarios: horariosRaw,
    validacion: validarOrdenHorarios(horariosRaw),
  };

  const destino = campos.destino ?? null;
  const datos = {
    tenant: "beraldi",
    nro_remito: normalizarNroRemitoGuia(campos.nro_remito),
    fecha_remito: fechaRemito,
    chofer: campos.chofer?.replace(/\s+/g, " ").trim() ?? null,
    tractor: campos.tractor ?? null,
    semi: campos.semi ?? null,
    unidad: campos.unidad ?? null,
    peso_kg: normalizarPeso(campos.peso),
    origen: campos.origen ?? null,
    destino_locacion: destino,
    destino_nombre: destino,
    horarios: horariosBlock,
    _fuente: "beraldi-foundation-v1",
  };

  const v = horariosBlock.validacion ?? {};
  const keys = ["nro_remito", "fecha_remito", "chofer", "destino_nombre", "peso_kg", "tractor"];
  const ok = keys.filter((k) => datos[k] != null && datos[k] !== "");

  return {
    ...datos,
    resumen: {
      tenant_detectado: "beraldi",
      horas_completas: v.valido === true,
      horas_faltantes: v.faltantes ?? [],
      horas_errores: v.errores ?? [],
      campos_extraidos: { total: keys.length, ok: ok.length, faltan: keys.filter((k) => !ok.includes(k)) },
      texto_ocr_len: textoOcr.length,
    },
  };
}

/** @param {Record<string, string>} campos @param {string} [textoOcr] */
export function extraerTSBFoundation(campos, textoOcr = "") {
  const fechaGuia = normalizarFecha(campos.fecha);

  const horariosRaw = {
    carga_entrada: slotHora(fechaGuia, campos.hora_carga_entrada),
    carga_salida: slotHora(fechaGuia, campos.hora_carga_salida),
    descarga_llegada: slotHora(fechaGuia, campos.hora_descarga_llegada),
    descarga_inicio: slotHora(fechaGuia, campos.hora_descarga_inicio),
    descarga_fin: slotHora(fechaGuia, campos.hora_descarga_fin),
  };

  const horariosBlock = {
    tenant: "tsb",
    fecha_remito: fechaGuia,
    horarios: horariosRaw,
    validacion: validarOrdenHorarios(horariosRaw),
  };

  const datos = enriquecerTSBDesdeTexto(
    {
      tenant: "tsb",
      nro_guia: normalizarNroRemitoGuia(campos.nro_guia),
      fecha_guia: fechaGuia,
      conductor: campos.conductor?.replace(/\s+/g, " ").trim() ?? null,
      chasis: campos.chasis ?? null,
      acoplado: campos.acoplado ?? null,
      peso_kg: normalizarPeso(campos.peso),
      procedencia: campos.procedencia ?? null,
      destino: campos.destino ?? null,
      malla: campos.malla ?? null,
      remito_cliente: campos.remito_cliente ?? null,
      nro_interno: campos.nro_interno ?? null,
      horarios: horariosBlock,
      _fuente: "tsb-foundation-v1",
    },
    textoOcr,
  );

  const v = horariosBlock.validacion ?? {};
  const keys = ["nro_guia", "destino", "conductor", "peso_kg", "procedencia"];
  const ok = keys.filter((k) => datos[k] != null && datos[k] !== "");

  return {
    ...datos,
    resumen: {
      tenant_detectado: "tsb",
      horas_completas: v.valido === true,
      horas_faltantes: v.faltantes ?? [],
      horas_errores: v.errores ?? [],
      campos_extraidos: { total: keys.length, ok: ok.length, faltan: keys.filter((k) => !ok.includes(k)) },
      texto_ocr_len: textoOcr.length,
    },
  };
}
