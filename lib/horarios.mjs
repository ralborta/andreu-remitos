/**
 * Extracción y validación de fechas/horas según reunión Gisela (16/jun).
 *
 * Orden obligatorio (cronológico):
 *   1. carga_entrada
 *   2. carga_salida
 *   3. descarga_llegada
 *   4. descarga_inicio
 *   5. descarga_fin
 *
 * Cada paso debe ser >= al anterior (misma fecha del remito salvo cruce de medianoche).
 */

const ORDEN_CAMPOS = [
  "carga_entrada",
  "carga_salida",
  "descarga_llegada",
  "descarga_inicio",
  "descarga_fin",
];

export { ORDEN_CAMPOS };

export const ETIQUETAS = {
  carga_entrada: "Carga — hora entrada",
  carga_salida: "Carga — hora salida",
  descarga_llegada: "Descarga — hora llegada",
  descarga_inicio: "Descarga — hora inicio",
  descarga_fin: "Descarga — hora fin",
};

/** @param {string} h "HH:MM" o variantes OCR */
export function normalizarHora(raw) {
  if (!raw) return null;
  const s = String(raw)
    .replace(/[hH]\.?/g, "")
    .replace(/hs\.?/gi, "")
    .replace(/,/g, ":")
    .replace(/\s+/g, "")
    .trim();

  let hh = null;
  let mm = null;

  // 0812 → 08:12
  const compact = s.match(/^(\d{1,2})(\d{2})$/);
  if (compact) {
    hh = +compact[1];
    mm = +compact[2];
  } else {
    const m = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (m) {
      hh = +m[1];
      mm = +m[2];
    }
  }

  if (hh == null || mm == null) return null;
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  // OCR basura típica: 01:76, 25:10
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function armarFechaIso(y, mo, d) {
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return iso;
}

function fechaIsoValida(y, mo, d) {
  // Rechazar años absurdos (OCR mal leído, ej. 8126).
  const yNow = new Date().getFullYear();
  const yMax = yNow + 1;
  if (!Number.isFinite(y) || y < 2000 || y > yMax) return null;

  // OCR frecuente: lee "26" como "20" → 2020. Si el año quedó >1 atrás, rearmar
  // con año actual (o anterior si caería a futuro).
  let yUse = y;
  if (y < yNow - 1) {
    const candActual = armarFechaIso(yNow, mo, d);
    const candPrev = armarFechaIso(yNow - 1, mo, d);
    const now = Date.now();
    if (candActual) {
      const t = new Date(`${candActual}T12:00:00`).getTime();
      if (t - now <= 2 * 24 * 3600 * 1000) return candActual;
    }
    if (candPrev) return candPrev;
    return null;
  }

  return armarFechaIso(yUse, mo, d);
}

/** @param {string} raw */
export function normalizarFecha(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();

  // Ya ISO yyyy-mm-dd
  const isoDirect = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDirect) {
    return fechaIsoValida(+isoDirect[1], +isoDirect[2], +isoDirect[3]);
  }

  // Guías TSB manuscritas: "30 6 26", "30.6.26"
  let m = trimmed.match(/^(\d{1,2})\s*[\/.\-\s]\s*(\d{1,2})\s*[\/.\-\s]\s*(\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return fechaIsoValida(+yy, +m[2], +m[1]);
  }

  const s = trimmed.replace(/\s+/g, "").replace(/\./g, "/").replace(/-/g, "/");

  // 30626, 300626 — día + mes (1-2 dígitos) + año
  m = s.match(/^(\d{2})(\d{1,2})(\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return fechaIsoValida(+yy, +m[2], +m[1]);
  }

  // 180626, 18/06/26, 18-06-26
  m = s.match(/^(\d{2})[\/]?(\d{2})[\/]?(\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return fechaIsoValida(+yy, +m[2], +m[1]);
  }

  m = s.match(/^(\d{2})[\/](\d{2})[\/](\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return fechaIsoValida(+yy, +m[2], +m[1]);
  }

  return null;
}

/** @param {string|null} fecha ISO yyyy-mm-dd @param {string|null} hora HH:MM */
export function aMinutos(fecha, hora) {
  if (!hora) return null;
  const [hh, mm] = hora.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  let base = 0;
  if (fecha) {
    const d = new Date(`${fecha}T00:00:00`);
    if (!Number.isNaN(d.getTime())) base = d.getTime() / 60000;
  }
  return base + hh * 60 + mm;
}

/** @param {string} iso yyyy-mm-dd @param {number} dias */
function sumarDias(iso, dias) {
  if (!iso || !dias) return iso;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function inferFechaRemito(horarios) {
  for (const campo of ORDEN_CAMPOS) {
    const f = normalizarFecha(horarios[campo]?.fecha);
    if (f) return f;
  }
  return null;
}

/**
 * Ajusta fechas cuando el viaje cruza medianoche (OCR suele repetir la misma fecha).
 * Cascada: si un slot queda "antes" del anterior, pasa al día siguiente (y los que siguen).
 * @param {Record<string, {fecha?: string|null, hora?: string|null}>} horarios
 * @param {string|null} [fechaRemito]
 */
export function prepararHorariosRemito(horarios, fechaRemito = null) {
  const base = normalizarFecha(fechaRemito) ?? inferFechaRemito(horarios);
  /** @type {Record<string, {fecha: string|null, hora: string|null}>} */
  const slots = {};

  for (const campo of ORDEN_CAMPOS) {
    const slot = horarios[campo] ?? {};
    slots[campo] = {
      fecha: normalizarFecha(slot.fecha) ?? base,
      hora: normalizarHora(slot.hora),
    };
  }

  const advertencias = [];
  let viajeNocturno = false;
  let prevMin = null;

  for (const campo of ORDEN_CAMPOS) {
    const slot = slots[campo];
    if (!slot.hora) continue;
    let min = aMinutos(slot.fecha, slot.hora);
    if (min == null) continue;

    // Si esta hora es anterior a la previa en el mismo día OCR → día siguiente
    if (prevMin != null && min < prevMin) {
      let bumped = false;
      let fecha = slot.fecha ?? base;
      // Avanzar de a un día hasta quedar en orden (máx. 2 días: carga → descarga)
      for (let i = 0; i < 2 && fecha; i++) {
        const next = sumarDias(fecha, 1);
        if (!next) break;
        fecha = next;
        min = aMinutos(fecha, slot.hora);
        if (min != null && min >= prevMin) {
          slot.fecha = fecha;
          bumped = true;
          break;
        }
      }
      if (bumped) {
        viajeNocturno = true;
        // Propagar el día a los slots siguientes del mismo bloque descarga/carga
        const idx = ORDEN_CAMPOS.indexOf(campo);
        for (let j = idx + 1; j < ORDEN_CAMPOS.length; j++) {
          const later = slots[ORDEN_CAMPOS[j]];
          if (later?.hora && (!later.fecha || later.fecha < slot.fecha)) {
            later.fecha = slot.fecha;
          }
        }
      }
    }

    if (slot.hora && aMinutos(slot.fecha, slot.hora) != null) {
      prevMin = aMinutos(slot.fecha, slot.hora);
    }
  }

  if (viajeNocturno) {
    advertencias.push(
      `Viaje nocturno: se ajustó la fecha de uno o más horarios al día siguiente para respetar el orden carga → descarga.`,
    );
  }

  return { horarios: slots, advertencias, viaje_nocturno: viajeNocturno };
}

/**
 * @param {Record<string, {fecha?: string|null, hora?: string|null}>} horarios
 * @param {{ fechaRemito?: string|null }} [opts]
 */
export function validarOrdenHorarios(horarios, opts = {}) {
  const preparado = prepararHorariosRemito(horarios, opts.fechaRemito ?? null);
  const slots = preparado.horarios;
  const advertencias = [...preparado.advertencias];
  const errores = [];
  const faltantes = [];
  let prevMin = null;
  let prevCampo = null;

  for (const campo of ORDEN_CAMPOS) {
    const slot = slots[campo] ?? {};
    const hora = slot.hora;
    const fecha = slot.fecha;

    if (!hora) {
      faltantes.push(ETIQUETAS[campo]);
      continue;
    }

    const min = aMinutos(fecha, hora);
    if (min === null) {
      errores.push(`${ETIQUETAS[campo]}: hora inválida "${slot.hora}"`);
      continue;
    }

    if (prevMin !== null && min < prevMin) {
      errores.push(
        `${ETIQUETAS[campo]} (${fecha ?? "?"} ${hora}) es anterior a ${ETIQUETAS[prevCampo]} — revisar mezcla carga/descarga`,
      );
    }

    prevMin = min;
    prevCampo = campo;
  }

  return {
    valido: errores.length === 0 && faltantes.length === 0,
    errores,
    advertencias,
    viaje_nocturno: preparado.viaje_nocturno,
    horarios: slots,
    faltantes,
    orden: ORDEN_CAMPOS.map((c) => ({
      campo: c,
      etiqueta: ETIQUETAS[c],
      fecha: slots[c]?.fecha ?? null,
      hora: slots[c]?.hora ?? null,
    })),
  };
}

function capturar(texto, re) {
  const m = texto.match(re);
  return m ? m[1].trim() : null;
}

function capturarHora(texto, patterns) {
  for (const re of patterns) {
    const m = texto.match(re);
    if (!m?.[1]) continue;
    const h = normalizarHora(m[1]);
    if (h) return h;
  }
  return null;
}

/**
 * Completa slots faltantes: Document AI suele traer 2–4 horas y el OCR en frío el resto.
 * @param {Record<string, {fecha?: string|null, hora?: string|null}>|null|undefined} actual
 * @param {Record<string, {fecha?: string|null, hora?: string|null}>|null|undefined} frio
 * @param {string|null} [fechaRemito]
 */
export function fusionarSlotsHorarios(actual, frio, fechaRemito = null) {
  const a = actual && typeof actual === "object" ? actual : {};
  const f = frio && typeof frio === "object" ? frio : {};
  /** @type {Record<string, {fecha: string|null, hora: string|null}>} */
  const out = {};
  for (const campo of ORDEN_CAMPOS) {
    const horaA = normalizarHora(a[campo]?.hora);
    const horaF = normalizarHora(f[campo]?.hora);
    out[campo] = {
      fecha:
        normalizarFecha(a[campo]?.fecha) ??
        normalizarFecha(f[campo]?.fecha) ??
        normalizarFecha(fechaRemito) ??
        null,
      hora: horaA || horaF || null,
    };
  }
  return out;
}

/**
 * Si faltan etiquetas OCR, toma una secuencia de 5 HH:MM en orden típico del remito.
 * @param {string} texto
 * @returns {Record<string, string>|null}
 */
function secuenciaCincoHoras(texto) {
  const bloque =
    texto.match(
      /(?:HORA\s*ENT|Hora[_\s]?ent|CARGA[\s\S]{0,40}?HORA|DESCARGA)[\s\S]{0,500}/i,
    )?.[0] ?? texto;
  const raw = [...bloque.matchAll(/\b(\d{1,2}[:.,]\d{2})\b/g)]
    .map((m) => normalizarHora(m[1]))
    .filter(Boolean);
  const uniq = [];
  for (const h of raw) {
    if (uniq[uniq.length - 1] !== h) uniq.push(h);
  }
  if (uniq.length < 5) return null;
  return {
    carga_entrada: uniq[0],
    carga_salida: uniq[1],
    descarga_llegada: uniq[2],
    descarga_inicio: uniq[3],
    descarga_fin: uniq[4],
  };
}

/** Remito Transportes Beraldi */
export function parsearHorariosBeraldi(texto) {
  const t = texto.replace(/\n/g, " ");
  const fechaRemito =
    capturar(t, /FECHA:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ??
    capturar(t, /FECHA\s+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i);
  const fechaNorm = normalizarFecha(fechaRemito);
  const fechaCarga =
    capturar(t, /CARGA[\s\S]*?FECHA\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito;
  const fechaDescarga =
    capturar(t, /DESCARGA[\s\S]*?(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito;

  let carga_entrada = capturarHora(t, [
    /HORA\s*ENT\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hora[_\s]?ent\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /ENTRADA\s*(?:CARGA)?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hs\.?\s*Ent\.?\s*:?\s*(\d{1,2}[:\.,]\d{2}|\d{3,4})\b/i,
  ]);
  let carga_salida = capturarHora(t, [
    /HORA\s*SAL\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hora[_\s]?sal\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /SALIDA\s*(?:CARGA)?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hs\.?\s*Sal\.?\s*:?\s*(\d{1,2}[:\.,]\d{2}|\d{3,4})\b/i,
  ]);
  let descarga_llegada = capturarHora(t, [
    /HORA\s*LLEGA\w*\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hora[_\s]?llega\w*\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /LLEGADA\s*(?:DESCARGA)?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hs\.?\s*Llega\w*\s*:?\s*(\d{1,2}[:\.,]\d{2}|\d{3,4})\b/i,
  ]);
  let descarga_inicio = capturarHora(t, [
    /HORA\s*INIC\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hora[_\s]?ini\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /INICIO\s*(?:DESCARGA)?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hs\.?\s*Ini\.?\s*:?\s*(\d{1,2}[:\.,]\d{2}|\d{3,4})\b/i,
  ]);
  let descarga_fin = capturarHora(t, [
    /HORA\s*FIN\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hora[_\s]?fin\.?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /FIN\s*(?:DESCARGA)?\s*:?\s*(\d{1,2}[:\.,]\d{2})/i,
    /Hs\.?\s*Fin\.?\s*:?\s*(\d{1,2}[:\.,]\d{2}|\d{3,4})\b/i,
  ]);

  const faltan =
    !carga_entrada || !carga_salida || !descarga_llegada || !descarga_inicio || !descarga_fin;
  if (faltan) {
    const seq = secuenciaCincoHoras(t);
    if (seq) {
      carga_entrada = carga_entrada || seq.carga_entrada;
      carga_salida = carga_salida || seq.carga_salida;
      descarga_llegada = descarga_llegada || seq.descarga_llegada;
      descarga_inicio = descarga_inicio || seq.descarga_inicio;
      descarga_fin = descarga_fin || seq.descarga_fin;
    }
  }

  return {
    tenant: "beraldi",
    fecha_remito: fechaNorm,
    horarios: {
      carga_entrada: { fecha: fechaCarga, hora: carga_entrada },
      carga_salida: { fecha: fechaCarga, hora: carga_salida },
      descarga_llegada: { fecha: fechaDescarga, hora: descarga_llegada },
      descarga_inicio: { fecha: fechaDescarga, hora: descarga_inicio },
      descarga_fin: { fecha: fechaDescarga, hora: descarga_fin },
    },
  };
}

/** Guía TSB — mapeo a los mismos 5 campos del CRM */
export function parsearHorariosTSB(texto) {
  const t = texto.replace(/\n/g, " ");

  const fechaDe = (bloque) => {
    const m = bloque?.match(/(\d{1,2}[\/\.\-\s]?\d{1,2}[\/\.\-\s]?\d{2,4}|\d{6})/);
    return m ? normalizarFecha(m[1]) : null;
  };

  const horaDe = (bloque) => {
    if (!bloque) return null;
    const patterns = [
      /Hs\.?\s*:?\s*(\d{1,2}[:\.\-]\d{2})/i,
      /Hs\.?\s*:?\s*(\d{3,4})\b/i,
      /\b(\d{1,2}:\d{2})\b/,
    ];
    for (const p of patterns) {
      const m = bloque.match(p);
      if (m) return normalizarHora(m[1]);
    }
    return null;
  };

  const llegaCarga = capturar(t, /Llega a lugar de carga:([\s\S]*?)(?=Inicia carga|Sale lugar|$)/i);
  const iniciaCarga = capturar(t, /Inicia carga:([\s\S]*?)(?=Sale lugar|Llega a lugar de descarga|$)/i);
  const saleCarga = capturar(t, /Sale lugar de carga:([\s\S]*?)(?=Inicia descarga|Llega a lugar de descarga|$)/i);
  const llegaDescarga = capturar(t, /Llega a lugar de descarg[a]?[:\s]*([\s\S]*?)(?=Inicia descarga|$)/i);
  const iniciaDescarga = capturar(t, /Inicia descarga:([\s\S]*?)(?=Sale lugar de descarga|Llegada a BASE|$)/i);
  const saleDescarga = capturar(t, /Sale lugar de descarga:([\s\S]*?)(?=Llegada a BASE|$)/i);

  // CRM usa entrada carga = inicia carga (Gisela: 5 campos, no 6)
  const bloqueEntrada = iniciaCarga ?? llegaCarga;

  return {
    tenant: "tsb",
    fecha_remito: fechaDe(llegaCarga) ?? fechaDe(iniciaCarga),
    horarios: {
      carga_entrada: { fecha: fechaDe(bloqueEntrada), hora: horaDe(bloqueEntrada) },
      carga_salida: { fecha: fechaDe(saleCarga), hora: horaDe(saleCarga) },
      descarga_llegada: { fecha: fechaDe(llegaDescarga), hora: horaDe(llegaDescarga) },
      descarga_inicio: { fecha: fechaDe(iniciaDescarga), hora: horaDe(iniciaDescarga) },
      descarga_fin: { fecha: fechaDe(saleDescarga), hora: horaDe(saleDescarga) },
    },
    extra: {
      llega_lugar_carga: { fecha: fechaDe(llegaCarga), hora: horaDe(llegaCarga) },
    },
  };
}

export function parsearHorarios(texto) {
  const upper = texto.toUpperCase();
  const esTSB = upper.includes("TSB") || upper.includes("COMPAÑIA DE TRANSPORTES");
  const esBeraldi =
    upper.includes("BERALDI") || upper.includes("ERALDI") || upper.includes("TRANSPORTES JOSE");

  const parsed = esTSB && !esBeraldi ? parsearHorariosTSB(texto) : parsearHorariosBeraldi(texto);
  const validacion = validarOrdenHorarios(parsed.horarios);

  return { ...parsed, validacion };
}
