/**
 * Prueba local: procesa un remito con Document AI.
 * Uso:
 *   npm install
 *   cp .env.example .env   # completar credenciales
 *   npm run procesar -- samples/remitos/archivo.jpeg
 *   npm run procesar:all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { parsearHorarios } from "../../lib/horarios.mjs";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.DOCUMENT_AI_LOCATION || "us";
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID;

function getClient() {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (json) {
    const creds = JSON.parse(json);
    return new DocumentProcessorServiceClient({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
    });
  }
  return new DocumentProcessorServiceClient();
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

function extractFields(document) {
  const entities = (document.entities || []).map((e) => ({
    tipo: e.type,
    valor: e.mentionText ?? e.normalizedValue?.text ?? "",
    confianza: e.confidence ?? null,
  }));

  return {
    texto_completo: (document.text || "").trim(),
    entidades: entities,
    paginas: document.pages?.length ?? 0,
  };
}

export async function procesarArchivo(filePath) {
  if (!PROJECT_ID || !PROCESSOR_ID) {
    throw new Error("Faltan GOOGLE_CLOUD_PROJECT o DOCUMENT_AI_PROCESSOR_ID en .env");
  }

  const buffer = fs.readFileSync(filePath);
  const client = getClient();
  const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: buffer.toString("base64"),
      mimeType: mimeFor(filePath),
    },
  });

  const campos = extractFields(result.document);
  const horarios = parsearHorarios(campos.texto_completo);

  return {
    archivo: path.basename(filePath),
    ...campos,
    horarios,
  };
}

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const files = all
    ? fs.readdirSync(path.join(root, "samples/remitos")).map((f) => path.join(root, "samples/remitos", f))
    : args.filter((a) => !a.startsWith("--")).map((f) => path.resolve(f));

  if (files.length === 0) {
    console.error("Uso: npm run procesar -- ruta/al/remito.jpeg");
    console.error("     npm run procesar:all");
    process.exit(1);
  }

  for (const file of files) {
    if (!/\.(jpe?g|png|pdf)$/i.test(file)) continue;
    console.log("\n---", path.basename(file), "---");
    try {
      const out = await procesarArchivo(file);
      console.log(JSON.stringify(out, null, 2));
    } catch (err) {
      console.error("Error:", err.message);
    }
  }
}

import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}