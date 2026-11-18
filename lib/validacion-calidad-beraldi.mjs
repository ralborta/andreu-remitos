/**
 * Validaciones de calidad Beraldi: fecha, OT, km, peso, origen, duplicados.
 * Complementa destino/unidades de validacion-maestros.mjs.
 * Los errores bloquean procesar en mesa y confirmación OK del chofer.
 */
import { findLocalidad, limpiarTextoBusqueda, norm } from "./planilla-common.mjs";
import { normalizarFecha } from "./horarios.mjs";

/** Rango típico de carga arena Beraldi (kg). */
export const PESO_BERALDI_MIN_KG = 25000;
export const PESO_BERALDI_MAX_KG = 40000;

/** Días hacia atrás/adelante aceptables vs recepción. */
export const FECHA_MAX_DIAS_PASADO = 14;
export const FECHA_MAX_DIAS_FUTURO = 2;

/** Delta km máximo razonable para un viaje. */
export const KM_DELTA_MAX = 5000;

/** OT Beraldi: 5–7 dígitos típicos (aceptamos 4–7; 8+ suele ser dígito de más). */
export function otBeraldiValida(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return { ok: false, motivo: "OT vacía" };
  if (digits.length < 4 || digits.length > 7) {
    return { ok: false, motivo: `OT "${digits}" tiene formato inválido (esperado 4–7 dígitos)` };
  }
  return { ok: true, ot: digits };
}

/**
 * Elige la interpretación DD/MM más cercana a `referenciaIso` (recepción).
 * Si la fecha queda muy lejos, prueba swap día↔mes (caso 17-11 leído como 17/12 o 11/17).
 * @param {string|null} iso yyyy-mm-dd ya normalizado DD/MM
 * @param {string|Date|null} [referencia] fecha de recepción
 */
export function sanearFechaRespectoRecepcion(iso, referencia = null) {
  const base = normalizarFecha(iso) ?? (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null);
  if (!base) return { iso: null, corregida: false, sospechosa: true, motivo: "Fecha ilegible o inválida" };

  const ref = referencia instanceof Date ? referencia : referencia ? new Date(referencia) : new Date();
  const refMs = Number.isNaN(ref.getTime()) ? Date.now() : ref.getTime();

  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { iso: null, corregida: false, sospechosa: true, motivo: "Fecha ilegible o inválida" };

  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];

  /** @param {number} yy @param {number} month @param {number} day */
  function cand(yy, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const s = `${yy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dt = new Date(`${s}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return null;
    if (dt.getFullYear() !== yy || dt.getMonth() + 1 !== month || dt.getDate() !== day) return null;
    return { iso: s, ms: dt.getTime(), deltaAbs: Math.abs(dt.getTime() - refMs) };
  }

  const opciones = [];
  const a = cand(y, mo, d);
  if (a) opciones.push({ ...a, swap: false });
  // Swap día/mes si ambos ≤ 12 (ambigüedad US vs AR).
  if (d !== mo && d <= 12) {
    const b = cand(y, d, mo);
    if (b) opciones.push({ ...b, swap: true });
  }
  // Año OCR viejo / mes OCR ±1 del leído (17-11 → 17/12). No saltar a otro mes lejano.
  const yRef = new Date(refMs).getFullYear();
  for (const yy of new Set([y, yRef, yRef - 1])) {
    for (const month of [mo - 1, mo, mo + 1]) {
      if (month < 1 || month > 12) continue;
      const c = cand(yy, month, d);
      if (c) opciones.push({ ...c, swap: month !== mo || yy !== y });
    }
  }

  if (!opciones.length) {
    return { iso: null, corregida: false, sospechosa: true, motivo: "Fecha ilegible o inválida" };
  }

  opciones.sort((x, z) => x.deltaAbs - z.deltaAbs);
  const best = opciones[0];
  const dias = best.deltaAbs / (24 * 3600 * 1000);
  const futuro = best.ms - refMs > FECHA_MAX_DIAS_FUTURO * 24 * 3600 * 1000;
  const pasado = refMs - best.ms > FECHA_MAX_DIAS_PASADO * 24 * 3600 * 1000;

  if (futuro || pasado) {
    return {
      iso: best.iso,
      corregida: best.iso !== base || best.swap,
      sospechosa: true,
      motivo: futuro
        ? `Fecha ${best.iso} está demasiado a futuro respecto a la recepción`
        : `Fecha ${best.iso} está demasiado lejos de la recepción (>${FECHA_MAX_DIAS_PASADO} días)`,
    };
  }

  return {
    iso: best.iso,
    corregida: best.iso !== base || best.swap,
    sospechosa: false,
    motivo: null,
  };
}

/**
 * Valida odómetros. Intenta corregir dígito faltante (11499 vs 115237) si el texto ayuda.
 * @returns {{ ok: boolean, errores: string[], km_inicial?: string|null, km_final?: string|null, advertencias: string[] }}
 */
export function validarKmBeraldi(kmInicial, kmFinal) {
  const errores = [];
  const advertencias = [];
  const ini = kmInicial != null && String(kmInicial).trim() !== "" ? String(kmInicial).replace(/\D/g, "") : null;
  const fin = kmFinal != null && String(kmFinal).trim() !== "" ? String(kmFinal).replace(/\D/g, "") : null;

  if (!ini || !fin) {
    if (!ini) errores.push("Falta km inicial");
    if (!fin) errores.push("Falta km final");
    return { ok: false, errores, advertencias, km_inicial: ini, km_final: fin };
  }

  const a = Number(ini);
  const b = Number(fin);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    errores.push("Km inicial/final ilegibles");
    return { ok: false, errores, advertencias, km_inicial: ini, km_final: fin };
  }

  if (b < a) {
    // Caso típico: dígito de más/menos (149037 vs 147037 leído mal; o 11499 vs 115237)
    const intento = intentarCorregirKmInvertidos(ini, fin);
    if (intento) {
      advertencias.push(`Km corregidos automáticamente: ${ini}/${fin} → ${intento.km_inicial}/${intento.km_final}`);
      return { ok: true, errores: [], advertencias, ...intento };
    }
    errores.push(`Km final (${fin}) es menor que km inicial (${ini}) — confirmar en el papel`);
    return { ok: false, errores, advertencias, km_inicial: ini, km_final: fin };
  }

  const delta = b - a;
  if (delta === 0) {
    advertencias.push("Km inicial y final iguales — confirmar recorrido");
  }
  if (delta > KM_DELTA_MAX) {
    errores.push(`Salto de km imposible (${delta} km; máximo ${KM_DELTA_MAX}) — confirmar odómetro`);
    return { ok: false, errores, advertencias, km_inicial: ini, km_final: fin };
  }

  // Longitudes muy distintas: posible dígito faltante
  if (Math.abs(ini.length - fin.length) >= 2) {
    errores.push(`Km con largo inconsistente (${ini} / ${fin}) — confirmar odómetro`);
    return { ok: false, errores, advertencias, km_inicial: ini, km_final: fin };
  }

  return { ok: true, errores: [], advertencias, km_inicial: ini, km_final: fin };
}

function intentarCorregirKmInvertidos(ini, fin) {
  // Si fin parece truncado del ini (mismo prefijo, fin más corto) no alcanza.
  // Probar insertar un dígito en el más corto para que fin > ini y delta ≤ MAX.
  const corto = ini.length <= fin.length ? ini : fin;
  const largo = ini.length <= fin.length ? fin : ini;
  if (largo.length !== corto.length + 1) return null;

  for (let i = 0; i <= corto.length; i++) {
    for (const dig of "0123456789") {
      const expanded = corto.slice(0, i) + dig + corto.slice(i);
      const a = ini.length <= fin.length ? expanded : largo;
      const b = ini.length <= fin.length ? largo : expanded;
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isFinite(na) || !Number.isFinite(nb)) continue;
      if (nb > na && nb - na <= KM_DELTA_MAX) {
        return { km_inicial: a, km_final: b };
      }
    }
  }
  return null;
}

/**
 * Peso Beraldi: tipicamente 30–34 t. Detecta estimado/default y fuera de rango.
 */
export function validarPesoBeraldi(pesoKg, { estimado = false } = {}) {
  const errores = [];
  const advertencias = [];
  if (pesoKg == null || pesoKg === "") {
    return { ok: false, errores: ["Falta peso"], advertencias };
  }
  const n = Number(pesoKg);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, errores: ["Peso inválido"], advertencias };
  }
  if (estimado) {
    errores.push("Peso no leído del papel — confirmar cantidad (kg o toneladas)");
    return { ok: false, errores, advertencias };
  }
  if (n < PESO_BERALDI_MIN_KG || n > PESO_BERALDI_MAX_KG) {
    // Posible lectura en toneladas sin convertir (32) o truncada (3206)
    if (n >= 20 && n <= 45) {
      errores.push(`Peso ${n} parece toneladas sin convertir — confirmar (esperado ~${Math.round(n * 1000)} kg)`);
    } else if (n >= 2000 && n <= 4500) {
      errores.push(`Peso ${n} kg fuera de rango típico — posible dígito faltante (¿${n * 10} kg?)`);
    } else {
      errores.push(`Peso ${n} kg fuera de rango típico (${PESO_BERALDI_MIN_KG}–${PESO_BERALDI_MAX_KG} kg)`);
    }
    return { ok: false, errores, advertencias };
  }
  return { ok: true, errores: [], advertencias };
}

/**
 * Origen Beraldi vs maestros (ALMACEN / planta).
 */
export function validarOrigenBeraldi(origen, localidades) {
  const texto = String(origen ?? "").trim();
  if (!texto) {
    return { ok: false, errores: [], faltantes: ["origen"], localidad: null };
  }
  if (!localidades?.length) {
    return { ok: true, errores: [], faltantes: [], localidad: null };
  }
  const loc =
    findLocalidad(localidades, texto) ??
    findLocalidad(localidades, limpiarTextoBusqueda(texto));
  if (!loc) {
    return {
      ok: false,
      errores: [`Origen "${texto}" no está en la base de localidades — corregir antes de procesar`],
      faltantes: [],
      localidad: null,
    };
  }
  return { ok: true, errores: [], faltantes: [], localidad: loc };
}

/**
 * Validación de calidad completa para Beraldi (sin maestros de unidades/destino).
 * @param {Record<string, unknown>} datos
 * @param {{ localidades?: object[], createdAt?: string|Date|null, duplicadoNro?: boolean }} [opts]
 */
export function validarCalidadBeraldi(datos, opts = {}) {
  const errores = [];
  const faltantes = [];
  const advertencias = [...(datos?._advertencias_lectura ?? [])];

  // Fecha
  const fechaRaw = datos?.fecha_remito ?? datos?.horarios?.fecha_remito ?? null;
  const fechaCheck = sanearFechaRespectoRecepcion(fechaRaw, opts.createdAt ?? null);
  let fecha_remito = fechaCheck.iso;
  if (!fecha_remito) {
    faltantes.push("fecha");
    if (fechaCheck.motivo) errores.push(fechaCheck.motivo);
  } else if (fechaCheck.sospechosa && fechaCheck.motivo) {
    errores.push(fechaCheck.motivo);
  } else if (fechaCheck.corregida) {
    advertencias.push(`Fecha ajustada a ${fecha_remito} (lectura OCR dudosa)`);
  }

  // OT
  const otCheck = otBeraldiValida(datos?.ot);
  if (!otCheck.ok) {
    if (/vacía/i.test(otCheck.motivo)) faltantes.push("OT");
    else errores.push(otCheck.motivo);
  }

  // Km
  const kmCheck = validarKmBeraldi(datos?.km_inicial, datos?.km_final);
  errores.push(...kmCheck.errores);
  advertencias.push(...kmCheck.advertencias);

  // Peso
  const pesoCheck = validarPesoBeraldi(datos?.peso_kg ?? datos?.peso, {
    estimado: datos?._peso_estimado === true,
  });
  errores.push(...pesoCheck.errores);
  advertencias.push(...pesoCheck.advertencias);

  // Origen
  const origenCheck = validarOrigenBeraldi(datos?.origen, opts.localidades);
  errores.push(...origenCheck.errores);
  faltantes.push(...origenCheck.faltantes);

  // Tractor == semi (lectura inventada / copiada)
  const tractor = norm(datos?.tractor ?? datos?.patente_chasis ?? "");
  const semi = norm(datos?.semi ?? datos?.patente_acoplado ?? "");
  if (tractor && semi && tractor === semi) {
    errores.push(`Tractor y semi tienen la misma patente (${tractor}) — confirmar en el papel`);
  }

  if (opts.duplicadoNro) {
    errores.push(
      `Nro remito ${datos?.nro_remito ?? ""} duplicado — ya existe otro remito con el mismo número`,
    );
  }

  const ok = errores.length === 0 && faltantes.length === 0;
  return {
    ok,
    errores,
    faltantes,
    advertencias,
    fecha_remito,
    km_inicial: kmCheck.km_inicial ?? datos?.km_inicial ?? null,
    km_final: kmCheck.km_final ?? datos?.km_final ?? null,
    origen_maestro: origenCheck.localidad
      ? { id: origenCheck.localidad.id, nombre: origenCheck.localidad.nombre, codigo: origenCheck.localidad.codigo }
      : null,
  };
}
