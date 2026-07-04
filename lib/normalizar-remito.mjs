/** Normaliza patente argentina: mayúsculas, sin espacios, correcciones OCR comunes. */
export function normalizarPatente(val) {
  if (val == null || val === "") return val;
  let s = String(val).replace(/\s+/g, "").toUpperCase();
  // OCR confunde + con 7 en dígitos (ej. AF+673LE → AF673LE)
  s = s.replace(/\+/g, "7");
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
  } else if (tenant === "corina") {
    if (d.tractor) d.patente_chasis = d.tractor;
    if (d.semi) d.patente_acoplado = d.semi;
  }

  return d;
}
