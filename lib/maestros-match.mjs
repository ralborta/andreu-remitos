import { findLocalidad, norm, patentePlanilla } from "./planilla-common.mjs";
import { canonicalizarLocalidadesEnDatos } from "./validacion-maestros.mjs";

function claveNombre(s) {
  return norm(s).replace(/[^A-Z]/g, "");
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

function mejorCandidato(candidatos, minScore, minGap) {
  let best = null;
  let bestScore = 0;
  let second = 0;
  for (const { item, score } of candidatos) {
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = item;
    } else if (score > second) {
      second = score;
    }
  }
  if (bestScore >= minScore && bestScore - second >= minGap) return { item: best, score: bestScore };
  return null;
}

/** Puntaje patente OCR ↔ unidad en maestros. */
export function puntajePatente(unidad, patenteOcr) {
  if (!unidad?.patente || !patenteOcr) return 0;
  const p = patentePlanilla(unidad.patente);
  const o = patentePlanilla(patenteOcr);
  if (!p || !o) return 0;
  if (p === o) return 100;

  let score = 0;
  if (p.endsWith(o) && o.length >= 5) score = Math.max(score, 88 - (p.length - o.length) * 2);
  if (o.endsWith(p) && p.length >= 5) score = Math.max(score, 82 - (o.length - p.length) * 2);
  if (p.includes(o) || o.includes(p)) {
    score = Math.max(score, 70 - Math.abs(p.length - o.length) * 3);
  }

  const dist = levenshtein(p, o);
  const sim = 1 - dist / Math.max(p.length, o.length);
  if (sim >= 0.75 && Math.max(p.length, o.length) >= 6) score = Math.max(score, sim * 80);

  return score;
}

/**
 * Busca unidad por patente aproximada (ej. 931YR → AG931YR).
 * @param {object[]} unidades
 * @param {string} patente
 * @param {"tractor"|"acoplado"} [tipo]
 */
export function findUnidad(unidades, patente, tipo) {
  if (!patente || !unidades?.length) return null;
  const pool = tipo ? unidades.filter((u) => u.tipo === tipo && u.activo !== false) : unidades;
  if (!pool.length) return null;

  const exact = pool.find((u) => patentePlanilla(u.patente) === patentePlanilla(patente));
  if (exact) return exact;

  const candidatos = pool.map((u) => ({ item: u, score: puntajePatente(u, patente) }));
  return mejorCandidato(candidatos, 75, 8)?.item ?? null;
}

/** Puntaje nombre chofer OCR ↔ maestro. */
export function puntajeChofer(chofer, nombreOcr) {
  if (!chofer?.nombre || !nombreOcr) return 0;
  const n = norm(nombreOcr);
  const cn = norm(chofer.nombre);
  if (!n || !cn) return 0;
  if (cn === n) return 100;

  let score = 0;
  const tokensIn = n.split(/[\s,]+/).filter((t) => t.length >= 3);
  const tokensC = cn.split(/[\s,]+/).filter((t) => t.length >= 2);
  for (const t of tokensIn) {
    if (tokensC.some((tc) => tc === t || tc.startsWith(t) || t.startsWith(tc))) score += 18;
  }

  const ki = claveNombre(nombreOcr);
  const kc = claveNombre(chofer.nombre);
  if (ki.length >= 4 && kc.length >= 4) {
    const dist = levenshtein(ki, kc);
    const sim = 1 - dist / Math.max(ki.length, kc.length);
    if (sim >= 0.65) score = Math.max(score, sim * 70);
  }

  if (cn.includes(n) || n.includes(cn)) {
    score = Math.max(score, 55 - Math.abs(cn.length - n.length) * 0.5);
  }

  return score;
}

/** Busca chofer por nombre aproximado (sin teléfono). */
export function findChoferPorNombre(choferes, nombre) {
  if (!nombre || !choferes?.length) return null;
  const candidatos = choferes
    .filter((c) => c.activo !== false)
    .map((c) => ({ item: c, score: puntajeChofer(c, nombre) }));
  return mejorCandidato(candidatos, 42, 12)?.item ?? null;
}

function canonLocalidad(texto, localidades) {
  if (texto == null || texto === "") return texto;
  return findLocalidad(localidades, texto)?.nombre ?? texto;
}

function aplicarPatente(d, campos, patente) {
  if (!patente) return;
  const p = patentePlanilla(patente);
  for (const k of campos) {
    if (k in d) d[k] = p;
  }
}

/**
 * Cruza datos OCR con maestros (localidades, unidades, choferes).
 * Solo reemplaza cuando la coincidencia es clara.
 */
export function canonicalizarConMaestros(datos, tenant, ctx = {}) {
  const {
    localidades = [],
    choferes = [],
    unidades = [],
    choferDesdeTelefono = false,
  } = ctx;

  if (!datos) return datos;

  let d = { ...datos };

  if (localidades.length) {
    const canonLoc = (t) => canonLocalidad(t, localidades);
    d = canonicalizarLocalidadesEnDatos(d, tenant, localidades, canonLoc);
  }

  if (unidades.length) {
    if (tenant === "tsb") {
      const chasis = findUnidad(unidades, d.chasis ?? d.patente_chasis, "tractor");
      if (chasis) aplicarPatente(d, ["chasis", "patente_chasis"], chasis.patente);
      const semi = findUnidad(unidades, d.acoplado ?? d.semi ?? d.patente_acoplado, "acoplado");
      if (semi) aplicarPatente(d, ["acoplado", "patente_acoplado", "semi"], semi.patente);
    } else if (tenant === "beraldi") {
      const tractor = findUnidad(unidades, d.tractor ?? d.chasis ?? d.patente_chasis, "tractor");
      if (tractor) aplicarPatente(d, ["tractor", "chasis", "patente_chasis"], tractor.patente);
      const semi = findUnidad(unidades, d.semi ?? d.acoplado ?? d.patente_acoplado, "acoplado");
      if (semi) aplicarPatente(d, ["semi", "acoplado", "patente_acoplado"], semi.patente);
    } else if (tenant === "corina") {
      const tractor = findUnidad(unidades, d.tractor ?? d.patente_chasis, "tractor");
      if (tractor) aplicarPatente(d, ["tractor", "patente_chasis"], tractor.patente);
      const semi = findUnidad(unidades, d.semi ?? d.patente_acoplado, "acoplado");
      if (semi) aplicarPatente(d, ["semi", "patente_acoplado"], semi.patente);
    }
  }

  if (choferes.length && !choferDesdeTelefono) {
    const nombreOcr = d.conductor ?? d.chofer;
    const chofer = findChoferPorNombre(choferes, nombreOcr);
    if (chofer?.nombre) {
      if (tenant === "tsb" || tenant === "corina") d.conductor = chofer.nombre;
      else d.chofer = chofer.nombre;
    }
  }

  return d;
}
