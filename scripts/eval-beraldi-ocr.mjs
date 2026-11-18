#!/usr/bin/env node
/**
 * Evalúa extracción Beraldi con fallback OpenAI (sin Document AI).
 *
 * Uso:
 *   OPENAI_API_KEY=… node scripts/eval-beraldi-ocr.mjs
 *   node scripts/eval-beraldi-ocr.mjs --fixtures-only   # solo compara enrich sobre texto fixture
 *
 * Reporta precisión por campo vs expected.json de cada caso.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entidadesAMapa, extraerBeraldiFoundation } from "../lib/extract-foundation.mjs";
import { enriquecerBeraldiDesdeTexto } from "../lib/enriquecer-beraldi-ocr.mjs";
import { normalizarFecha } from "../lib/horarios.mjs";
import { normalizarPeso } from "../lib/extract-cold.mjs";
import { findLocalidad } from "../lib/planilla-common.mjs";
import { findUnidad } from "../lib/maestros-match.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures/beraldi-ocr");
const fixturesOnly = process.argv.includes("--fixtures-only");

const CAMPOS = ["fecha_remito", "ot", "tractor", "semi", "origen", "destino", "peso_kg", "km_inicial", "km_final"];

function loadCases() {
  if (!fs.existsSync(FIXTURES)) return [];
  return fs
    .readdirSync(FIXTURES)
    .filter((d) => fs.existsSync(path.join(FIXTURES, d, "expected.json")))
    .map((id) => {
      const dir = path.join(FIXTURES, id);
      const expected = JSON.parse(fs.readFileSync(path.join(dir, "expected.json"), "utf8"));
      const textoPath = path.join(dir, "ocr-texto.txt");
      const img =
        ["foto.jpg", "foto.jpeg", "foto.png", "image.jpg", "image.png"].map((f) => path.join(dir, f)).find((p) => fs.existsSync(p)) ??
        null;
      const texto = fs.existsSync(textoPath) ? fs.readFileSync(textoPath, "utf8") : "";
      return { id, expected, texto, img };
    });
}

function normVal(campo, v) {
  if (v == null || v === "") return "";
  if (campo === "fecha_remito") return normalizarFecha(v) ?? String(v);
  if (campo === "peso_kg") return String(normalizarPeso(v) ?? v);
  if (campo === "ot" || campo === "km_inicial" || campo === "km_final") return String(v).replace(/\D/g, "");
  if (campo === "tractor" || campo === "semi") return String(v).replace(/\s+/g, "").toUpperCase();
  return String(v).trim().toUpperCase().replace(/\s+/g, " ");
}

function scoreCase(got, expected) {
  const perField = {};
  let ok = 0;
  for (const c of CAMPOS) {
    if (!(c in expected)) continue;
    const a = normVal(c, got[c] ?? got.destino_nombre);
    const b = normVal(c, expected[c]);
    const match = a === b || (a && b && (a.includes(b) || b.includes(a)));
    perField[c] = match;
    if (match) ok++;
  }
  const total = CAMPOS.filter((c) => c in expected).length;
  return { perField, ok, total };
}

async function runOpenAi(imgPath) {
  process.env.DOCUMENT_AI_OPENAI_FALLBACK = "true";
  // Forzar fallo DocAI → OpenAI
  delete process.env.DOCUMENT_AI_CUSTOM_BERALDI_ID;
  delete process.env.GOOGLE_CLOUD_PROJECT;

  const { procesarBeraldiOpenAi } = await import("../lib/ocr-openai-fallback.mjs");
  const buf = fs.readFileSync(imgPath);
  const ocr = await procesarBeraldiOpenAi(buf, path.basename(imgPath));
  const lectura = extraerBeraldiFoundation(entidadesAMapa(ocr.entidades), ocr.texto);
  return { ocr, lectura };
}

function runTexto(texto, seedEntidades = {}) {
  return enriquecerBeraldiDesdeTexto(
    {
      tenant: "beraldi",
      ...seedEntidades,
      peso_kg: seedEntidades.peso != null ? normalizarPeso(seedEntidades.peso) : seedEntidades.peso_kg,
      fecha_remito: seedEntidades.fecha ? normalizarFecha(seedEntidades.fecha) : seedEntidades.fecha_remito,
    },
    texto,
  );
}

const localidades = [
  { id: "1", nombre: "TRON-22", codigo: "TRON22" },
  { id: "2", nombre: "TRON-24", codigo: "TRON24" },
  { id: "3", nombre: "LOMA CAMPANA", codigo: "LC" },
  { id: "4", nombre: "CIMSA", codigo: "CIMSA" },
];
const unidades = [
  { id: "u1", patente: "AH860KG", tipo: "tractor", activo: true },
  { id: "u2", patente: "AH860KH", tipo: "tractor", activo: true },
  { id: "u3", patente: "AH318WC", tipo: "acoplado", activo: true },
  { id: "u4", patente: "AD215TD", tipo: "acoplado", activo: true },
  { id: "u5", patente: "AD215TJ", tipo: "acoplado", activo: true },
];

async function main() {
  const cases = loadCases();
  if (!cases.length) {
    console.error("Sin fixtures en", FIXTURES);
    process.exit(1);
  }

  const fieldHits = Object.fromEntries(CAMPOS.map((c) => [c, { ok: 0, total: 0 }]));
  const fieldHitsBefore = Object.fromEntries(CAMPOS.map((c) => [c, { ok: 0, total: 0 }]));
  const rows = [];

  function applyMaestros(lectura) {
    const out = { ...lectura };
    const tractor = findUnidad(unidades, out.tractor, "tractor");
    if (tractor) out.tractor = tractor.patente;
    const semi = findUnidad(unidades, out.semi, "acoplado");
    if (semi) out.semi = semi.patente;
    const dest = findLocalidad(localidades, out.destino ?? out.destino_nombre);
    if (dest) out.destino = dest.nombre;
    const orig = findLocalidad(localidades, out.origen);
    if (orig) out.origen = orig.nombre;
    return out;
  }

  for (const c of cases) {
    // Baseline: entidades crudas del OCR malo (sin enrich), como caía OpenAI Vision.
    const seed = c.expected.seed_entidades ?? {};
    const beforeRaw = {
      fecha_remito: seed.fecha ? normalizarFecha(seed.fecha) : null,
      ot: seed.ot ?? null,
      tractor: seed.tractor ?? null,
      semi: seed.semi ?? null,
      origen: seed.origen ?? null,
      destino: seed.destino ?? null,
      peso_kg: seed.peso != null ? normalizarPeso(seed.peso) : seed.peso_kg ?? null,
      km_inicial: seed.km_inicial ?? null,
      km_final: seed.km_final ?? null,
    };
    const before = scoreCase(beforeRaw, c.expected);
    for (const [k, hit] of Object.entries(before.perField)) {
      fieldHitsBefore[k].total++;
      if (hit) fieldHitsBefore[k].ok++;
    }

    let lectura;
    let motor = "texto-fixture+enrich";
    if (!fixturesOnly && c.img && process.env.OPENAI_API_KEY) {
      try {
        const r = await runOpenAi(c.img);
        lectura = r.lectura;
        motor = r.ocr.motor;
      } catch (err) {
        console.warn(`[${c.id}] OpenAI falló (${err.message}); uso texto fixture`);
        lectura = runTexto(c.texto, seed);
      }
    } else {
      lectura = runTexto(c.texto, seed);
    }

    lectura = applyMaestros(lectura);

    const sc = scoreCase(lectura, c.expected);
    for (const [k, hit] of Object.entries(sc.perField)) {
      fieldHits[k].total++;
      if (hit) fieldHits[k].ok++;
    }
    rows.push({
      id: c.id,
      motor,
      precision: sc.total ? sc.ok / sc.total : 0,
      precisionBefore: before.total ? before.ok / before.total : 0,
      perField: sc.perField,
      got: Object.fromEntries(CAMPOS.map((k) => [k, lectura[k] ?? lectura.destino_nombre ?? null])),
      expected: Object.fromEntries(CAMPOS.filter((k) => k in c.expected).map((k) => [k, c.expected[k]])),
    });
  }

  console.log("\n=== Eval Beraldi OCR ===\n");
  for (const r of rows) {
    const pct = (r.precision * 100).toFixed(0);
    const pctB = (r.precisionBefore * 100).toFixed(0);
    console.log(`• ${r.id} (${r.motor}): ${pctB}% → ${pct}%`);
    for (const [k, hit] of Object.entries(r.perField)) {
      if (!hit) console.log(`    ✗ ${k}: got=${r.got[k]} expected=${r.expected[k]}`);
    }
  }
  console.log("\nPrecisión por campo (antes → después):");
  for (const c of CAMPOS) {
    const a = fieldHitsBefore[c];
    const b = fieldHits[c];
    if (!b.total) continue;
    const pa = a.total ? ((a.ok / a.total) * 100).toFixed(0) : "—";
    const pb = ((b.ok / b.total) * 100).toFixed(0);
    console.log(`  ${c}: ${pa}% → ${pb}% (${b.ok}/${b.total})`);
  }
  const totOkB = Object.values(fieldHitsBefore).reduce((s, x) => s + x.ok, 0);
  const totB = Object.values(fieldHitsBefore).reduce((s, x) => s + x.total, 0);
  const totOk = Object.values(fieldHits).reduce((s, x) => s + x.ok, 0);
  const tot = Object.values(fieldHits).reduce((s, x) => s + x.total, 0);
  console.log(
    `\nGlobal: ${totB ? ((totOkB / totB) * 100).toFixed(0) : 0}% → ${tot ? ((totOk / tot) * 100).toFixed(0) : 0}% (${totOk}/${tot})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
