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

const ETIQUETAS = {
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

  // 0812 → 08:12
  const compact = s.match(/^(\d{1,2})(\d{2})$/);
  if (compact) {
    return `${compact[1].padStart(2, "0")}:${compact[2]}`;
  }

  const m = s.match(/^(\d{1,2})[:.](\d{2})$/);
  if (m) {
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }

  // 6:50, 7:25
  const loose = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (loose) {
    return `${loose[1].padStart(2, "0")}:${loose[2].padStart(2, "0")}`;
  }

  return null;
}

function fechaIsoValida(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return iso;
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

/**
 * @param {Record<string, {fecha?: string|null, hora?: string|null}>} horarios
 */
export function validarOrdenHorarios(horarios) {
  const errores = [];
  const faltantes = [];
  let prevMin = null;
  let prevCampo = null;

  for (const campo of ORDEN_CAMPOS) {
    const slot = horarios[campo] ?? {};
    const hora = normalizarHora(slot.hora);
    const fecha = normalizarFecha(slot.fecha);

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
    faltantes,
    orden: ORDEN_CAMPOS.map((c) => ({
      campo: c,
      etiqueta: ETIQUETAS[c],
      fecha: normalizarFecha(horarios[c]?.fecha),
      hora: normalizarHora(horarios[c]?.hora),
    })),
  };
}

function capturar(texto, re) {
  const m = texto.match(re);
  return m ? m[1].trim() : null;
}

/** Remito Transportes Beraldi */
export function parsearHorariosBeraldi(texto) {
  const t = texto.replace(/\n/g, " ");
  const fechaRemito = capturar(t, /FECHA:\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i);

  return {
    tenant: "beraldi",
    fecha_remito: normalizarFecha(fechaRemito),
    horarios: {
      carga_entrada: {
        fecha: capturar(t, /CARGA[\s\S]*?FECHA\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito,
        hora: capturar(t, /HORA\s*ENT\.?\s*(\d{1,2}[:\.,]\d{2})/i),
      },
      carga_salida: {
        fecha: capturar(t, /CARGA[\s\S]*?FECHA\s*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito,
        hora: capturar(t, /HORA\s*SAL\.?\s*(\d{1,2}[:\.,]\d{2})/i),
      },
      descarga_llegada: {
        fecha: capturar(t, /DESCARGA[\s\S]*?(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito,
        hora: capturar(t, /HORA\s*LLEGA\s*(\d{1,2}[:\.,]\d{2})/i),
      },
      descarga_inicio: {
        fecha: capturar(t, /DESCARGA[\s\S]*?(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito,
        hora: capturar(t, /HORA\s*INIC\.?\s*(\d{1,2}[:\.,]\d{2})/i),
      },
      descarga_fin: {
        fecha: capturar(t, /DESCARGA[\s\S]*?(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})/i) ?? fechaRemito,
        hora: capturar(t, /HORA\s*FIN\s*(\d{1,2}[:\.,]\d{2})/i),
      },
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
