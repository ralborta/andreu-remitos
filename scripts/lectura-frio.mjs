/**
 * Lectura en frío: OCR genérico + extracción por regex (sin entrenamiento).
 * Uso: npm run lectura:frio
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { procesarArchivo } from "./procesar-remito.mjs";
import { extraerFrio } from "../../lib/extract-cold.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "samples/remitos");

const files = fs
  .readdirSync(dir)
  .filter((f) => /\.jpe?g$/i.test(f))
  .filter((f) => f.includes("14.47") || f.includes("14.48"))
  .sort();

const resultados = [];

for (const f of files) {
  const filePath = path.join(dir, f);
  process.stderr.write(`Procesando ${f}...\n`);
  try {
    const ocr = await procesarArchivo(filePath);
    const lectura = extraerFrio(ocr.texto_completo);
    resultados.push({
      archivo: f,
      lectura,
    });
  } catch (err) {
    resultados.push({ archivo: f, error: err.message });
  }
}

// Resumen compacto
const resumen = {
  total: resultados.length,
  tsb: resultados.filter((r) => r.lectura?.tenant === "tsb").length,
  beraldi: resultados.filter((r) => r.lectura?.tenant === "beraldi").length,
  horas_ok: resultados.filter((r) => r.lectura?.resumen?.horas_completas).length,
  detalle: resultados.map((r) => ({
    archivo: r.archivo,
    error: r.error,
    tenant: r.lectura?.tenant,
    nro: r.lectura?.nro_remito ?? r.lectura?.nro_guia,
    destino: r.lectura?.destino_nombre ?? r.lectura?.destino,
    chofer: r.lectura?.chofer ?? r.lectura?.conductor,
    peso_kg: r.lectura?.peso_kg,
    horas_ok: r.lectura?.resumen?.horas_completas,
    horas: r.lectura?.horarios?.validacion?.orden?.map((o) => o.hora ?? "—").join(" → "),
    campos: r.lectura?.resumen?.campos_extraidos,
  })),
};

console.log(JSON.stringify(resumen, null, 2));

// Guardar detalle completo
const outPath = path.join(root, "samples/lectura-frio-resultados.json");
fs.writeFileSync(outPath, JSON.stringify(resultados, null, 2));
process.stderr.write(`\nDetalle guardado en ${outPath}\n`);
