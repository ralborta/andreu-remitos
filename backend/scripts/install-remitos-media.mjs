import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN required");
const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const DEST = path.join(UPLOAD_DIR, "remitos-demo");
fs.mkdirSync(DEST, { recursive: true });

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

const catalog = JSON.parse((await ghRaw("backend/seed-media/remitos/catalog.json")).toString("utf8"));
for (const row of catalog) {
  const buf = await ghRaw(`backend/seed-media/remitos/${row.file}`);
  fs.writeFileSync(path.join(DEST, row.file), buf);
}

const ESTADOS = ["pendiente_revision","pendiente_revision","confirmado","confirmado","incompleto","bloqueado"];
const TEL = ["5491144556677","5491155667788","5491166778899","5491177889900","5491188990011","5491199001122"];
const remitos = [];
for (let i = 0; i < 18; i++) {
  const src = catalog[i % catalog.length];
  const estado = ESTADOS[i % ESTADOS.length];
  const fecha = src.fecha;
  remitos.push({
    id: randomUUID(),
    tenant: "tsb",
    estado,
    telefono_chofer: TEL[i % TEL.length],
    imagen_path: `uploads/remitos-demo/${src.file}`,
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

const remitosFile = path.join(DATA_DIR, "remitos.json");
if (fs.existsSync(remitosFile)) {
  fs.copyFileSync(remitosFile, `${remitosFile}.bak-remitos-real-${Date.now()}`);
}
fs.writeFileSync(remitosFile, JSON.stringify(remitos, null, 2));

// Quitar de POP/POD/reclamos/gastos cualquier path de remito si quedó
function scrub(file, keys) {
  if (!fs.existsSync(file)) return 0;
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  let n = 0;
  for (const r of rows) {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "string" && (v.includes("remito") || v.includes("demo-remito"))) {
        r[k] = null;
        n++;
      }
      if (k === "attachments" && Array.isArray(r.attachments)) {
        r.attachments = r.attachments.filter((a) => !String(a.url || "").includes("remito"));
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return n;
}

console.log(JSON.stringify({
  ok: true,
  images: catalog.length,
  remitos: remitos.length,
  sample: remitos.slice(0,2).map(r=>({nro:r.datos.nro_guia,img:r.imagen_path,chofer:r.datos.conductor})),
  exists: fs.existsSync(path.join(DEST, "remito-01.png")),
  size: fs.statSync(path.join(DEST, "remito-01.png")).size,
}, null, 2));
