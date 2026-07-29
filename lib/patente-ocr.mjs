import { patentePlanilla } from "./planilla-common.mjs";
import { patenteFormatoValido } from "./validacion-maestros.mjs";

/** Confusiones frecuentes OCR en la zona numérica (posiciones 2–4 Mercosur). */
const A_DIGITO = {
  I: "1",
  L: "1",
  "|": "1",
  O: "0",
  D: "0",
  S: "5",
  B: "8",
  G: "6",
  Z: "2",
};

const A_LETRA = { "0": "O", "1": "I", "5": "S", "8": "B" };

function limpiarRaw(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/^[•·*○●◦\.]+/, "")
    .replace(/\./g, "")
    .replace(/\+/g, "7")
    .replace(/[^A-Z0-9]/g, "");
}

function corregirDigitos(middle) {
  return middle
    .split("")
    .map((c) => A_DIGITO[c] ?? c)
    .join("");
}

function corregirLetras(tail) {
  return tail
    .split("")
    .map((c) => A_LETRA[c] ?? c)
    .join("");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Intenta reconstruir patente Mercosur AA###AA desde lectura OCR ruidosa. */
export function corregirPatenteMercosur(raw) {
  const s = limpiarRaw(raw);
  if (!s || s.length < 5) return s;

  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(s)) return s;

  if (s.length === 7) {
    const cand = s.slice(0, 2) + corregirDigitos(s.slice(2, 5)) + corregirLetras(s.slice(5, 7));
    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cand)) return cand;
  }

  // Falta un dígito en el medio (ej. AG9SQL → AG952QL)
  if (s.length === 6 && /^[A-Z]{2}[A-Z0-9]{2}[A-Z]{2}$/.test(s)) {
    const l1 = s.slice(0, 2);
    const rawMid = s.slice(2, 4);
    const mid = corregirDigitos(rawMid);
    const l2 = corregirLetras(s.slice(4, 6));
    /** @type {string[]} */
    const opciones = [];
    const tieneLetraEnMedio = /[A-Z]/i.test(rawMid);

    const push = (expanded) => {
      if (!/^\d{3}$/.test(expanded)) return;
      const cand = l1 + expanded + l2;
      if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(cand)) opciones.push(cand);
    };

    /** Letras en el bloque numérico que suelen ser 2 dígitos mal leídos (S→52, etc.). */
    const expansionLetra = { S: ["52", "5"], Z: ["2"], G: ["6"], I: ["1"], L: ["1"], O: ["0"], B: ["8"] };

    if (tieneLetraEnMedio && rawMid.length === 2) {
      const d0 = corregirDigitos(rawMid[0]) || rawMid[0];
      const letra = rawMid[1].toUpperCase();
      for (const tail of expansionLetra[letra] ?? [corregirDigitos(letra)]) {
        push(String(d0) + tail);
      }
    }
    for (const d of "0123456789") {
      push(mid + d);
      if (!tieneLetraEnMedio) push(mid[0] + d + mid[1]);
      push(d + mid);
    }

    if (opciones.length) {
      const unicos = [...new Set(opciones)];
      unicos.sort((a, b) => levenshtein(a, s) - levenshtein(b, s));
      return unicos[0];
    }
  }

  return s;
}

/** Puntaje simple para elegir la mejor lectura entre candidatos. */
export function puntajeLecturaPatente(raw) {
  const corregida = corregirPatenteMercosur(raw);
  let score = 0;
  if (patenteFormatoValido(corregida)) score += 60;
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(corregida)) score += 30;
  if (String(raw ?? "").length >= 6) score += 5;
  return { corregida, score };
}

/** Elige la patente más confiable entre OCR foundation y regex en frío. */
export function mejorPatenteOcr(actual, fallback) {
  const candidatos = [actual, fallback].filter(Boolean);
  if (!candidatos.length) return null;

  let best = null;
  let bestScore = -1;
  for (const c of candidatos) {
    const { corregida, score } = puntajeLecturaPatente(c);
    const finalScore = score + (corregida !== limpiarRaw(c) ? 8 : 0);
    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = corregida;
    }
  }
  return best;
}

/**
 * Busca patentes manuscritas en remitos Beraldi (cuadro OT/unidad, sin etiqueta TRACTOR).
 * @param {string} texto
 */
export function extraerPatentesManuscritasBeraldi(texto) {
  const t = String(texto ?? "").replace(/\s+/g, " ");
  const re = /\b([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{2}[A-Z0-9ILOSGBZ|]{2,5}[A-Z]{2})\b/gi;
  const vistos = new Set();
  /** @type {string[]} */
  const patentes = [];

  for (const m of t.matchAll(re)) {
    const corregida = corregirPatenteMercosur(m[1]);
    if (!patenteFormatoValido(corregida)) continue;
    if (vistos.has(corregida)) continue;
    vistos.add(corregida);
    patentes.push(corregida);
  }

  return {
    tractor: patentes[0] ?? null,
    semi: patentes[1] ?? null,
    todas: patentes,
  };
}

/** Normaliza patente para comparación fuzzy (post-corrección OCR). */
export function patenteParaMatch(raw) {
  const c = corregirPatenteMercosur(raw);
  return patentePlanilla(c || raw);
}
