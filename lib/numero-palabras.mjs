/**
 * Convierte cantidades en palabras (es-AR) a número entero.
 * Cubre rangos típicos de peso/km en remitos (hasta ~999.999).
 */
const UNIDADES = {
  cero: 0,
  uno: 1,
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};

const ESPECIALES = {
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiún: 21,
  veintiuna: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

function normalizarTokens(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function valorToken(tok) {
  if (tok in ESPECIALES) return ESPECIALES[tok];
  if (tok in UNIDADES) return UNIDADES[tok];
  if (/^\d+$/.test(tok)) return Number(tok);
  return null;
}

/** @param {string} texto */
export function palabrasANumero(texto) {
  const tokens = normalizarTokens(texto);
  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;

  for (const tok of tokens) {
    if (tok === "y") continue;

    if (tok === "millon" || tok === "millones") {
      current = (current || 1) * 1_000_000;
      total += current;
      current = 0;
      continue;
    }

    if (tok === "mil") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      continue;
    }

    const v = valorToken(tok);
    if (v == null) continue;
    current += v;
  }

  total += current;
  return total > 0 ? total : null;
}
