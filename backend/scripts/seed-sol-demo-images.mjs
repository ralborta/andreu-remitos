#!/usr/bin/env node
/**
 * Duplica imágenes existentes de uploads/ y las enlaza en seed demo
 * (POP/POD, reclamos, rendiciones, remitos).
 *
 * Uso (cwd /app/backend):
 *   DATA_DIR=./data UPLOAD_DIR=./uploads node scripts/seed-sol-demo-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const MEDIA = path.join(UPLOAD_DIR, "chat-media");

fs.mkdirSync(MEDIA, { recursive: true });

function collectSources() {
  const out = [];
  for (const dir of [UPLOAD_DIR, MEDIA]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (!fs.statSync(p).isFile()) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      if (f.startsWith("demo-")) continue;
      out.push(p);
    }
  }
  return out;
}

const sources = collectSources();
if (!sources.length) {
  console.error("No hay imágenes fuente en uploads/");
  process.exit(1);
}

function pick(i) {
  return sources[i % sources.length];
}

const urls = [];
const remitoPaths = [];
const kinds = [
  ...Array.from({ length: 18 }, (_, i) => `demo-pop-${i + 1}.jpg`),
  ...Array.from({ length: 18 }, (_, i) => `demo-pod-${i + 1}.jpg`),
  ...Array.from({ length: 18 }, (_, i) => `demo-gasto-${i + 1}.jpg`),
  ...Array.from({ length: 18 }, (_, i) => `demo-reclamo-${i + 1}.jpg`),
  ...Array.from({ length: 18 }, (_, i) => `demo-remito-${i + 1}.jpg`),
];

kinds.forEach((name, i) => {
  const src = pick(i);
  const ext = path.extname(src).toLowerCase();
  const destName = name.replace(/\.jpg$/i, ext === ".png" ? ".png" : ".jpg");
  fs.copyFileSync(src, path.join(MEDIA, destName));
  const url = `/api/media/local/${destName}`;
  if (destName.startsWith("demo-remito-")) {
    fs.copyFileSync(src, path.join(UPLOAD_DIR, destName));
    remitoPaths.push(path.join("uploads", destName).replace(/\\/g, "/"));
  }
  urls.push({ name: destName, url });
});

function byPrefix(prefix) {
  return urls.filter((u) => u.name.startsWith(prefix)).map((u) => u.url);
}

const popUrls = byPrefix("demo-pop-");
const podUrls = byPrefix("demo-pod-");
const gastoUrls = byPrefix("demo-gasto-");
const reclamoUrls = byPrefix("demo-reclamo-");

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}
function write(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

const evidence = read("transport-evidence.json");
let pi = 0;
let di = 0;
for (const r of evidence) {
  const waiting = String(r.estado || "").startsWith("esperando");
  if (waiting) {
    r.imagen_url = null;
    r.attachments = [];
    continue;
  }
  if (r.type === "POP") {
    const url = popUrls[pi++ % popUrls.length];
    r.imagen_url = url;
    r.attachments = [
      {
        id: `ATT-${r.id}`,
        url,
        mime_type: url.endsWith(".png") ? "image/png" : "image/jpeg",
        kind: "photo",
        created_at: r.created_at,
      },
    ];
  } else if (r.type === "POD") {
    const url = podUrls[di++ % podUrls.length];
    r.imagen_url = url;
    r.attachments = [
      {
        id: `ATT-${r.id}`,
        url,
        mime_type: url.endsWith(".png") ? "image/png" : "image/jpeg",
        kind: "photo",
        created_at: r.created_at,
      },
    ];
  }
}
write("transport-evidence.json", evidence);
write(
  "pod-casos.json",
  evidence.filter((r) => r.type === "POD"),
);

const reclamos = read("reclamos.json");
reclamos.forEach((r, i) => {
  r.imagen_url = reclamoUrls[i % reclamoUrls.length];
});
write("reclamos.json", reclamos);

const gastos = read("rendicion-gastos.json");
gastos.forEach((r, i) => {
  r.imagen_url = gastoUrls[i % gastoUrls.length];
});
write("rendicion-gastos.json", gastos);

const remitos = read("remitos.json");
remitos.forEach((r, i) => {
  r.imagen_path = remitoPaths[i % remitoPaths.length];
});
write("remitos.json", remitos);

console.log(
  JSON.stringify(
    {
      ok: true,
      sources: sources.length,
      duplicated: kinds.length,
      evidenceConFoto: evidence.filter((r) => r.imagen_url).length,
      reclamos: reclamos.length,
      gastos: gastos.length,
      remitos: remitos.length,
      sample: popUrls[0],
    },
    null,
    2,
  ),
);
