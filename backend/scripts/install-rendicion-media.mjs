#!/usr/bin/env node
/**
 * Instala comprobantes reales de rendición y reescribe rendicion-gastos.json.
 *
 * Uso:
 *   GITHUB_TOKEN=... DATA_DIR=./data UPLOAD_DIR=./uploads node scripts/install-rendicion-media.mjs
 */
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN required");

const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MEDIA = path.join(UPLOAD_DIR, "chat-media");
fs.mkdirSync(MEDIA, { recursive: true });

const CHOFERES = [
  { nombre: "Pereyra, Juan C.", tel: "5491144556677" },
  { nombre: "Gómez, Martín", tel: "5491155667788" },
  { nombre: "Ledesma, Ana", tel: "5491166778899" },
  { nombre: "Quiroga, Roberto", tel: "5491177889900" },
  { nombre: "Ferreyra, Sergio", tel: "5491188990011" },
  { nombre: "Cardozo, Pablo", tel: "5491199001122" },
];

const ESTADOS = [
  "pendiente_aprobacion",
  "aprobado",
  "pendiente_aprobacion",
  "aprobado",
  "pendiente_aprobacion",
  "aprobado",
  "rechazado",
  "pendiente_aprobacion",
  "aprobado",
  "pendiente_aprobacion",
  "aprobado",
  "pendiente_aprobacion",
  "aprobado",
  "rechazado",
  "pendiente_aprobacion",
  "aprobado",
  "pendiente_aprobacion",
  "aprobado",
];

async function ghRaw(filePath) {
  const url = `https://api.github.com/repos/ralborta/andreu-remitos/contents/${filePath}?ref=demo`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github.raw",
      "User-Agent": "sol-seed",
    },
  });
  if (!res.ok) throw new Error(`${filePath} ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const catalog = JSON.parse(
  (await ghRaw("backend/seed-media/rendiciones/catalog.json")).toString("utf8"),
);

for (const row of catalog) {
  const buf = await ghRaw(`backend/seed-media/rendiciones/${row.file}`);
  fs.writeFileSync(path.join(MEDIA, row.file), buf);
}

const gastosFile = path.join(DATA_DIR, "rendicion-gastos.json");
if (fs.existsSync(gastosFile)) {
  fs.copyFileSync(gastosFile, `${gastosFile}.bak-rendicion-img-${Date.now()}`);
}

const TARGET = 18;
const gastos = [];
for (let i = 0; i < TARGET; i++) {
  const src = catalog[i % catalog.length];
  const ch = CHOFERES[i % CHOFERES.length];
  const estado = ESTADOS[i % ESTADOS.length];
  const url = `/api/media/local/${src.file}`;
  const dup = i >= catalog.length ? `-${String(i + 1).padStart(2, "0")}` : "";
  gastos.push({
    id: `RG-DEMO-${src.codigo.replace("RG-", "")}${dup}`,
    codigo: src.codigo + (dup ? dup : ""),
    estado,
    categoria: src.categoria,
    monto: src.monto,
    moneda: "ARS",
    proveedor: src.proveedor,
    fecha_comprobante: src.fecha_comprobante,
    descripcion: src.descripcion,
    viaje_ref: `VJ-202609${String(4 + (i % 16)).padStart(2, "0")}-${String((i % 12) + 1).padStart(3, "0")}`,
    telefono: ch.tel,
    chofer_nombre: ch.nombre,
    patente: src.patente.replace(/\s+/g, ""),
    imagen_url: url,
    nota_chofer: src.observaciones || "Comprobante adjunto",
    nota_aprobacion:
      estado === "aprobado"
        ? "OK liquidación"
        : estado === "rechazado"
          ? "Ticket fuera de política / ilegible"
          : null,
    aprobado_por: estado === "pendiente_aprobacion" ? null : "backoffice",
    texto_ocr: `${src.proveedor} · ${src.tipo_gasto} · ${src.descripcion} · $${src.monto.toLocaleString("es-AR")} · ${src.ubicacion}`,
    historial: [
      `${src.fecha_iso} · Creado (pendiente_aprobacion)`,
      ...(estado !== "pendiente_aprobacion"
        ? [`${src.fecha_iso.replace("T08", "T14").replace("T09", "T15").replace("T10", "T16")} · ${estado}`]
        : []),
    ],
    created_at: src.fecha_iso,
    updated_at: src.fecha_iso,
    _seed_demo: true,
    _seed_rendicion_image: src.file,
    _seed_ubicacion: src.ubicacion,
    _seed_forma_pago: src.forma_pago,
  });
}

fs.writeFileSync(gastosFile, JSON.stringify(gastos, null, 2));

console.log(
  JSON.stringify(
    {
      ok: true,
      images: catalog.length,
      gastos: gastos.length,
      allRendicionImgs: gastos.every((g) => /rendicion-\d+\.png$/.test(g.imagen_url || "")),
      sample: gastos.slice(0, 3).map((g) => ({
        codigo: g.codigo,
        categoria: g.categoria,
        monto: g.monto,
        imagen_url: g.imagen_url,
      })),
    },
    null,
    2,
  ),
);
