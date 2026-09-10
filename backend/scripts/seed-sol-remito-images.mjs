#!/usr/bin/env node
/**
 * Instala imágenes reales de remitos y regenera remitos.json
 * SOLO con esas fotos (duplica si hacen falta más filas).
 *
 * Uso (cwd /app/backend):
 *   DATA_DIR=./data UPLOAD_DIR=./uploads node scripts/seed-sol-remito-images.mjs
 *
 * Requiere que backend/seed-media/remitos/*.png esté en el repo
 * (o REMITO_MEDIA_BASE_URL apuntando a raw github).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const LOCAL_MEDIA = path.join(__dirname, "..", "seed-media", "remitos");
const DEST_DIR = path.join(UPLOAD_DIR, "remitos-demo");
const BASE_URL =
  process.env.REMITO_MEDIA_BASE_URL ||
  "https://raw.githubusercontent.com/ralborta/andreu-remitos/demo/backend/seed-media/remitos";

const ESTADOS = [
  "pendiente_revision",
  "pendiente_revision",
  "confirmado",
  "confirmado",
  "incompleto",
  "bloqueado",
];

const TEL = [
  "5491144556677",
  "5491155667788",
  "5491166778899",
  "5491177889900",
  "5491188990011",
  "5491199001122",
];

async function ensureImages(catalog) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  const installed = [];
  for (const row of catalog) {
    const dest = path.join(DEST_DIR, row.file);
    const local = path.join(LOCAL_MEDIA, row.file);
    if (fs.existsSync(local)) {
      fs.copyFileSync(local, dest);
    } else if (!fs.existsSync(dest)) {
      const url = `${BASE_URL}/${row.file}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No pude bajar ${url}: ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    installed.push({
      ...row,
      imagen_path: path.join("uploads", "remitos-demo", row.file).replace(/\\/g, "/"),
    });
  }
  return installed;
}

function buildRemitos(installed, targetCount = 18) {
  const rows = [];
  for (let i = 0; i < targetCount; i++) {
    const src = installed[i % installed.length];
    const estado = ESTADOS[i % ESTADOS.length];
    const id = randomUUID();
    const fecha = src.fecha;
    rows.push({
      id,
      tenant: "tsb",
      estado,
      telefono_chofer: TEL[i % TEL.length],
      imagen_path: src.imagen_path,
      texto_ocr: `GUÍA ${src.nro} · ${src.conductor} · ${src.procedencia} → ${src.destino}`,
      datos: {
        tenant: "tsb",
        nro_guia: src.nro,
        nro_remito: src.nro,
        fecha_guia: fecha,
        conductor: src.conductor,
        chasis: src.chasis,
        acoplado: estado === "incompleto" ? null : `ZD${String(100 + i).padStart(3, "0")}EE`,
        peso_kg: src.peso_kg,
        procedencia: src.procedencia,
        destino: src.destino,
        malla: "general",
        remito_cliente: `${1000 + i}-${4500 + i}`,
        nro_interno: `D${400 + i}`,
        descripcion: src.descripcion,
        cantidad: src.cantidad,
        horarios: {
          tenant: "tsb",
          fecha_remito: fecha,
          horarios: {
            carga_entrada: { fecha, hora: "07:30" },
            carga_salida: { fecha, hora: "08:15" },
            descarga_llegada: { fecha, hora: "14:10" },
            descarga_inicio: { fecha, hora: "14:25" },
            descarga_fin: { fecha, hora: "15:40" },
          },
        },
      },
      validacion: {
        valido: estado === "confirmado",
        faltantes: estado === "incompleto" ? ["Semi / remolque"] : estado === "bloqueado" ? ["destino"] : [],
        errores: estado === "bloqueado" ? ["Destino no coincide con maestro"] : [],
        destino_maestro: estado === "bloqueado" ? null : src.destino,
        unidades_maestro: { tractor: src.chasis },
      },
      created_at: `${fecha}T08:05:00.000Z`,
      updated_at: `${fecha}T09:10:00.000Z`,
      _seed_demo: true,
      _seed_remito_image: src.file,
    });
  }
  return rows;
}

const catalogPath = path.join(LOCAL_MEDIA, "catalog.json");
let catalog;
if (fs.existsSync(catalogPath)) {
  catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
} else {
  const res = await fetch(`${BASE_URL}/catalog.json`);
  if (!res.ok) throw new Error("No hay catalog.json de remitos");
  catalog = await res.json();
  fs.mkdirSync(LOCAL_MEDIA, { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
}

const remitosFile = path.join(DATA_DIR, "remitos.json");
if (fs.existsSync(remitosFile)) {
  const bak = `${remitosFile}.bak-remitos-img-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(remitosFile, bak);
}

const installed = await ensureImages(catalog);
const remitos = buildRemitos(installed, 18);
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(remitosFile, JSON.stringify(remitos, null, 2));

console.log(
  JSON.stringify(
    {
      ok: true,
      images: installed.length,
      remitos: remitos.length,
      onlyRemitoImages: true,
      sample: remitos.slice(0, 3).map((r) => ({
        nro: r.datos.nro_guia,
        img: r.imagen_path,
        chofer: r.datos.conductor,
      })),
    },
    null,
    2,
  ),
);
