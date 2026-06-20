import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { procesarArchivo } from "./procesar-remito.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "samples/remitos");
const files = fs
  .readdirSync(dir)
  .filter((f) => /\.jpe?g$/i.test(f))
  .filter((f) => !f.includes("12.38") && !f.includes("12.39"));

const porTenant = { tsb: [], beraldi: [] };

for (const f of files.sort()) {
  const out = await procesarArchivo(path.join(dir, f));
  const h = out.horarios ?? {};
  const v = h.validacion ?? {};
  const item = {
    archivo: f,
    fecha_remito: h.fecha_remito,
    valido: v.valido,
    faltantes: v.faltantes ?? [],
    errores: v.errores ?? [],
    orden: v.orden ?? [],
  };
  const t = h.tenant === "tsb" ? "tsb" : "beraldi";
  porTenant[t].push(item);
}

console.log(JSON.stringify(porTenant, null, 2));
