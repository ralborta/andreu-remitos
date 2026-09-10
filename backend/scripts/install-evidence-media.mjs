#!/usr/bin/env node
/**
 * Instala imágenes reales POP/POD y las enlaza SOLO a su tipo.
 * POP → pop-XX.png | POD → pod-XX.png (duplica si hay más filas).
 *
 * Uso:
 *   GITHUB_TOKEN=... DATA_DIR=./data UPLOAD_DIR=./uploads node scripts/install-evidence-media.mjs
 */
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN required");

const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MEDIA = path.join(UPLOAD_DIR, "chat-media");
fs.mkdirSync(MEDIA, { recursive: true });

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

async function listDir(dirPath) {
  const url = `https://api.github.com/repos/ralborta/andreu-remitos/contents/${dirPath}?ref=demo`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "sol-seed",
    },
  });
  if (!res.ok) throw new Error(`list ${dirPath} ${res.status}`);
  const data = await res.json();
  return (data || [])
    .filter((f) => f.type === "file" && /\.png$/i.test(f.name))
    .map((f) => f.name)
    .sort();
}

async function installKind(kind, remoteDir) {
  const names = await listDir(remoteDir);
  const urls = [];
  for (const name of names) {
    const buf = await ghRaw(`${remoteDir}/${name}`);
    fs.writeFileSync(path.join(MEDIA, name), buf);
    urls.push(`/api/media/local/${name}`);
  }
  return { kind, count: names.length, urls, names };
}

const pop = await installKind("POP", "backend/seed-media/pop");
const pod = await installKind("POD", "backend/seed-media/pod");

const evidenceFile = path.join(DATA_DIR, "transport-evidence.json");
const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));
fs.copyFileSync(
  evidenceFile,
  `${evidenceFile}.bak-evidence-img-${Date.now()}`,
);

let pi = 0;
let di = 0;
for (const row of evidence) {
  const waiting = String(row.estado || "").startsWith("esperando");
  if (waiting) {
    row.imagen_url = null;
    row.attachments = [];
    continue;
  }
  if (row.type === "POP") {
    const url = pop.urls[pi++ % pop.urls.length];
    const name = pop.names[(pi - 1) % pop.names.length];
    row.imagen_url = url;
    row.attachments = [
      {
        id: `ATT-${row.id}`,
        url,
        mime_type: "image/png",
        kind: "photo",
        created_at: row.created_at || new Date().toISOString(),
      },
    ];
    row._seed_evidence_image = name;
  } else if (row.type === "POD") {
    const url = pod.urls[di++ % pod.urls.length];
    const name = pod.names[(di - 1) % pod.names.length];
    row.imagen_url = url;
    row.attachments = [
      {
        id: `ATT-${row.id}`,
        url,
        mime_type: "image/png",
        kind: "photo",
        created_at: row.created_at || new Date().toISOString(),
      },
    ];
    row._seed_evidence_image = name;
  }
}

fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
const pods = evidence.filter((r) => r.type === "POD");
fs.writeFileSync(path.join(DATA_DIR, "pod-casos.json"), JSON.stringify(pods, null, 2));

console.log(
  JSON.stringify(
    {
      ok: true,
      popImages: pop.count,
      podImages: pod.count,
      evidencePop: evidence.filter((r) => r.type === "POP" && r.imagen_url).length,
      evidencePod: evidence.filter((r) => r.type === "POD" && r.imagen_url).length,
      sample: {
        pop: evidence.find((r) => r.type === "POP" && r.imagen_url)?.imagen_url,
        pod: evidence.find((r) => r.type === "POD" && r.imagen_url)?.imagen_url,
      },
    },
    null,
    2,
  ),
);
