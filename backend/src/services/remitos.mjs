import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { leerRemito } from "../../../lib/lectura.mjs";
import * as store from "../db/file-store.mjs";

function uploadDir() {
  const dir = process.env.UPLOAD_DIR || "./uploads";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function ingestarRemito(buffer, { filename, telefono, tenantForzado }) {
  const resultado = await leerRemito(buffer, { filename, telefono, tenantForzado });

  const id = randomUUID();
  const ext = path.extname(filename || ".jpg") || ".jpg";
  const imagenPath = path.join(uploadDir(), `${id}${ext}`);
  fs.writeFileSync(imagenPath, buffer);

  const row = {
    id,
    tenant: resultado.tenant,
    estado: resultado.estado,
    telefono_chofer: telefono ?? null,
    imagen_path: imagenPath,
    texto_ocr: resultado.ocr.texto,
    datos: resultado.lectura,
    validacion: resultado.validacion,
  };

  await store.insertRemito(row);

  return { id, ...resultado };
}

export async function listarRemitos(opts) {
  return store.listRemitos(opts);
}

export async function obtenerRemito(id) {
  return store.getRemito(id);
}

export async function actualizarCampos(id, datosParciales) {
  const row = await store.getRemito(id);
  if (!row) return null;

  const datos = { ...row.datos, ...datosParciales, _editado_manual: true };
  const validacion = datosParciales.horarios?.validacion ?? row.validacion;
  const estado = validacion?.valido ? "confirmado" : "incompleto";

  return store.updateRemito(id, {
    datos,
    validacion,
    estado,
  });
}
