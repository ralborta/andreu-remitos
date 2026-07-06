import { normalizarPatente } from "./normalizar-remito.mjs";
import { normalizarFecha } from "./horarios.mjs";

const PALABRAS_CONFIRMACION =
  /^(ok|dale|listo|correcto|correcta|esta\s*bien|está\s*bien|confirmo|confirmado|perfecto|si|sí|todo\s*bien|bueno|genial|gracias)$/i;

const PALABRA_REMITO = /^remit[oa]s?$/i;

/** ¿Es solo una confirmación, no un dato? */
export function esPalabraConfirmacion(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return false;
  return PALABRAS_CONFIRMACION.test(s) || PALABRA_REMITO.test(s);
}

/** Nro guía/remito: solo dígitos (mín. 4). Nunca la palabra "remito". */
export function normalizarNroRemitoGuia(valor) {
  if (valor == null || valor === "") return null;
  const raw = String(valor).trim();
  if (!raw || PALABRA_REMITO.test(raw) || esPalabraConfirmacion(raw)) return null;
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

function limpiarPatente(val) {
  if (val == null || val === "") return null;
  if (esPalabraConfirmacion(val)) return null;
  const s = String(val).trim();
  if (s.length < 5) return null;
  return normalizarPatente(s);
}

function limpiarTextoCampo(val) {
  if (val == null || val === "") return null;
  if (esPalabraConfirmacion(val)) return null;
  const s = String(val).trim();
  return s || null;
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
      const n = normalizarNroRemitoGuia(d[k]);
      d[k] = n;
    }
  }

  for (const k of CAMPOS_PATENTE) {
    if (k in d) d[k] = limpiarPatente(d[k]);
  }

  for (const k of ["conductor", "chofer", "origen", "procedencia", "destino", "destino_nombre", "destino_locacion", "malla"]) {
    if (k in d) d[k] = limpiarTextoCampo(d[k]);
  }

  const fecha = fechaRemitoEnDatos(d);
  if (tenant === "tsb") {
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
