import { sanitizarDatosRemito } from "./sanitizar-campos-remito.mjs";

/** Basura típica OCR en destinos Beraldi (ej. Lach.874, paréntesis colgantes). */
function pareceBasuraDestino(valor) {
  const s = String(valor ?? "").trim();
  if (!s || s.length < 2) return true;
  if (/\.\d{2,}$/.test(s)) return true; // Lach.874
  if (/^[A-Za-z]{2,10}\.\s*$/.test(s)) return true;
  if (/^(hora|peso|chofer|tractor|semi|cimsa)$/i.test(s)) return true;
  return false;
}

function limpiarDestinoBeraldi(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor)
    .replace(/\s+/g, " ")
    .replace(/[.`'"´(]+$/g, "")
    .trim();
  return s || null;
}

/** Elige el mejor destino entre aliases OCR/editor y lo deja limpio. */
function elegirDestinoBeraldi(d) {
  const candidatos = [d.destino, d.destino_nombre, d.destino_locacion]
    .map((v) => limpiarDestinoBeraldi(v))
    .filter(Boolean);
  if (!candidatos.length) return null;
  return candidatos.find((c) => !pareceBasuraDestino(c)) ?? candidatos[0];
}

/** Normaliza patente argentina: mayúsculas, sin espacios, correcciones OCR comunes. */
export function normalizarPatente(val) {
  if (val == null || val === "") return val;
  let s = String(val).replace(/\s+/g, "").toUpperCase();
  // OCR: bullet/punto al inicio en lugar de A (•AL318WB → AL318WB)
  s = s.replace(/^[•·\*○●◦\.]+/, "");
  // OCR mete punto en patentes (MEZ62.3 → MEZ623)
  s = s.replace(/\./g, "");
  // OCR confunde + con 7 en dígitos (ej. AF+673LE → AF673LE)
  s = s.replace(/\+/g, "7");
  // Solo caracteres alfanuméricos
  s = s.replace(/[^A-Z0-9]/g, "");
  return s;
}

const CAMPOS_PATENTE = [
  "chasis",
  "acoplado",
  "tractor",
  "semi",
  "patente_chasis",
  "patente_acoplado",
  "patente",
  "dominio",
];

/** Sincroniza alias de campos según tenant tras OCR o edición. */
export function normalizarDatosRemito(datos, tenant) {
  if (!datos || typeof datos !== "object") return datos;
  const d = { ...datos };

  for (const k of CAMPOS_PATENTE) {
    if (d[k] != null && d[k] !== "") d[k] = normalizarPatente(d[k]);
  }

  if (tenant === "tsb") {
    if (d.chasis) {
      d.patente_chasis = d.chasis;
    } else if (d.patente_chasis) {
      d.chasis = d.patente_chasis;
    }
    if (d.acoplado) {
      d.patente_acoplado = d.acoplado;
      d.semi = d.acoplado;
    } else if (d.patente_acoplado) {
      d.acoplado = d.patente_acoplado;
      d.semi = d.patente_acoplado;
    }
  } else if (tenant === "beraldi") {
    if (d.tractor) d.patente_chasis = d.tractor;
    else if (d.patente_chasis) d.tractor = d.patente_chasis;
    if (d.semi) d.patente_acoplado = d.semi;
    else if (d.patente_acoplado) d.semi = d.patente_acoplado;
    if (d.ot != null && d.ot !== "") d.ot = String(d.ot).replace(/\D/g, "") || null;
    // UI edita `destino`; OCR deja basura en destino_locacion/nombre.
    // Unificar siempre los 3 aliases para que listado/validación no queden desfasados.
    const dest = elegirDestinoBeraldi(d);
    if (dest) {
      d.destino = dest;
      d.destino_nombre = dest;
      d.destino_locacion = dest;
    }
  } else if (tenant === "corina") {
    if (d.tractor) d.patente_chasis = d.tractor;
    if (d.semi) d.patente_acoplado = d.semi;
  }

  const cleaned = sanitizarDatosRemito(d, tenant);

  // Beraldi: peso típico de viaje si OCR/edición no trae valor.
  if (
    tenant === "beraldi" &&
    (cleaned.peso_kg == null || cleaned.peso_kg === "") &&
    (cleaned.peso == null || cleaned.peso === "")
  ) {
    cleaned.peso_kg = 31500;
  }

  return cleaned;
}
