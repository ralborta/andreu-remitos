import { normalizarPatente } from "./normalizar-remito.mjs";
import { normalizarFecha } from "./horarios.mjs";

const PALABRAS_CONFIRMACION =
  /^(ok|okey|okay|dale|listo|correcto|correcta|esta bien|está bien|confirmo|confirmado|perfecto|si|sí|todo bien|bueno|genial|gracias|de acuerdo|claro|joya)$/i;

const PALABRA_REMITO = /^remit[oa]s?$/i;

function normalizarTextoConfirmacion(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.!?,¿¡:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Es solo una confirmación, no un dato? */
export function esPalabraConfirmacion(valor) {
  const s = normalizarTextoConfirmacion(valor);
  if (!s) return false;
  return PALABRAS_CONFIRMACION.test(s) || PALABRA_REMITO.test(s);
}

const PREFIJO_BERALDI = "00009";

/**
 * Beraldi: el prefijo impreso (00009-) no se usa en el CRM/planilla.
 * Queda el número principal + copia manuscrita (ej. 00177056-4).
 * @param {string} raw
 */
function normalizarNroRemitoBeraldi(raw) {
  const s = String(raw).trim();
  if (!s) return null;

  let copia = "";
  let base = s;
  const copiaMatch = s.match(/[-–—]\s*(\d{1,2})\s*$/);
  if (copiaMatch) {
    copia = copiaMatch[1];
    base = s.slice(0, copiaMatch.index).trim();
  }

  base = base.replace(/^00009\s*[-–—]?\s*/i, "").trim();
  let digits = base.replace(/\D/g, "");

  if (digits.startsWith(PREFIJO_BERALDI) && digits.length > PREFIJO_BERALDI.length) {
    digits = digits.slice(PREFIJO_BERALDI.length);
  }

  if (!copia && digits.length === 9) {
    copia = digits.slice(-1);
    digits = digits.slice(0, -1);
  } else if (!copia && digits.length === 8 && !digits.startsWith("00")) {
    // 7 dígitos + copia manuscrita (ej. 2355786-1)
    copia = digits.slice(-1);
    digits = digits.slice(0, -1);
  }

  if (digits.length < 4) return null;
  return copia ? `${digits}-${copia}` : digits;
}

/** Dígitos del nro remito/guía para deduplicar entre tenants (0001-00001037 ≡ 000100001037). */
export function nroRemitoCanonico(datos) {
  const raw = datos?.nro_remito ?? datos?.nro_guia;
  if (raw == null || raw === "") return null;
  const tenant = datos?.tenant;
  const n =
    tenant === "beraldi" || /^00009/.test(String(raw).replace(/\s/g, ""))
      ? normalizarNroRemitoBeraldi(String(raw).trim())
      : normalizarNroRemitoGuia(raw, { tenant });
  if (!n) return null;
  const digits = String(n).replace(/\D/g, "");
  return digits.length >= 4 ? digits : null;
}

/** Nro guía/remito: dígitos (mín. 4). Beraldi conserva -1/-2/-3. Corina conserva 3264-########. */
export function normalizarNroRemitoGuia(valor, opts = {}) {
  if (valor == null || valor === "") return null;
  const raw = String(valor).trim();
  if (!raw || PALABRA_REMITO.test(raw) || esPalabraConfirmacion(raw)) return null;

  if (opts.tenant === "corina") {
    const conGuion = raw.match(/(\d{4})\s*[-–—]\s*(\d{6,10})/);
    if (conGuion) return `${conGuion[1]}-${conGuion[2]}`;
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 12) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length >= 10) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length >= 4) return digits;
    return null;
  }

  if (opts.tenant === "beraldi" || opts.permitirCopia === true) {
    if (opts.tenant === "beraldi") return normalizarNroRemitoBeraldi(raw);
    // Legacy TSB u otros con sufijo -1/-2/-3
    const copiaMatch = raw.match(/[-–—]\s*([123])\s*$/);
    const sufijo = copiaMatch ? `-${copiaMatch[1]}` : "";
    const baseRaw = copiaMatch ? raw.slice(0, copiaMatch.index) : raw;
    const digits = baseRaw.replace(/\D/g, "");
    if (digits.length < 4) return null;
    return sufijo ? `${digits}${sufijo}` : digits;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits;
}

/** Fecha del remito en datos (ISO o null). */
export function fechaRemitoEnDatos(datos) {
  if (!datos || typeof datos !== "object") return null;
  const candidatos = [datos.fecha_guia, datos.fecha_remito, datos.fecha];
  for (const c of candidatos) {
    const f = normalizarFecha(c);
    if (f) return f;
  }
  return null;
}

/** Formato día/mes/año para chofer y UI. */
export function fechaDmY(iso) {
  if (!iso) return null;
  const f = normalizarFecha(iso);
  if (!f) return null;
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Valor de patente para mostrar/guardar (null si es confirmación u OCR inválido). */
export function valorPatenteValido(valor) {
  if (valor == null || valor === "") return null;
  if (esPalabraConfirmacion(valor)) return null;
  const s = String(valor).trim();
  if (s.length < 5) return null;
  return normalizarPatente(s);
}

function limpiarPatente(val) {
  return valorPatenteValido(val);
}

function limpiarTextoCampo(val) {
  if (val == null || val === "") return null;
  if (esPalabraConfirmacion(val)) return null;
  const s = String(val).trim();
  return s || null;
}

/** Etiquetas de formulario que el OCR/extractor a veces guarda como valor. */
export function esEtiquetaCampoRemito(valor) {
  const s = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:.|]+$/g, "")
    .trim();
  if (!s) return true;
  if (/^[:.\-/]+$/.test(s)) return true;
  const u = s
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /^(DESTINO\s*\/?\s*POZO|LUGAR\s+DE\s+CARGA|PROCEDENCIA|ORIGEN|DESTINO|CHOFER|EQUIPO|CAMION|ACOPLADO|PRODUCTO(\s+TRANSPORTADO)?|CANTIDAD|PESO(\s+NETO)?|FIRMA|ACLARACION)$/.test(
    u,
  );
}

const CAMPOS_PATENTE = new Set([
  "chasis",
  "acoplado",
  "tractor",
  "semi",
  "patente_chasis",
  "patente_acoplado",
  "patente",
  "dominio",
]);

const CAMPOS_NRO = new Set(["nro_guia", "nro_remito", "nro_interno"]);

/**
 * Limpia valores OCR/chats inválidos (remito, correcto, ok…).
 * @param {Record<string, unknown>} datos
 * @param {string} [tenant]
 */
export function sanitizarDatosRemito(datos, tenant) {
  if (!datos || typeof datos !== "object") return datos;
  const d = { ...datos };

  for (const k of CAMPOS_NRO) {
    if (k in d) {
      const n = normalizarNroRemitoGuia(d[k], { tenant });
      d[k] = n;
    }
  }

  for (const k of CAMPOS_PATENTE) {
    if (k in d) d[k] = limpiarPatente(d[k]);
  }

  for (const k of ["conductor", "chofer", "origen", "procedencia", "destino", "destino_nombre", "destino_locacion", "malla"]) {
    if (k in d) {
      let v = limpiarTextoCampo(d[k]);
      if (v) {
        v = String(v)
          .replace(/[дД]/g, "a")
          .replace(/[аА]/g, "a")
          .trim();
      }
      if (v && esEtiquetaCampoRemito(v)) v = null;
      d[k] = v || null;
    }
  }

  const fecha = fechaRemitoEnDatos(d);
  if (tenant === "tsb" || tenant === "mye") {
    d.fecha_guia = fecha;
    if (d.horarios && typeof d.horarios === "object") {
      d.horarios = { ...d.horarios, fecha_remito: fecha };
    }
  } else {
    d.fecha_remito = fecha;
    if (d.fecha != null) d.fecha = fecha;
    if (d.horarios && typeof d.horarios === "object") {
      d.horarios = { ...d.horarios, fecha_remito: fecha };
    }
  }

  return d;
}
