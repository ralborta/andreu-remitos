import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.join(backendRoot, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(repoRoot, "data");
const JSON_DEFAULT = path.join(DATA_DIR, "demo-flota.json");

function truthy(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  return ["si", "sí", "yes", "true", "1", "disponible", "ok"].includes(s);
}

function readJsonFlota() {
  const file = JSON_DEFAULT;
  if (!fs.existsSync(file)) {
    return { choferes: [], camiones: [] };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    choferes: Array.isArray(raw.choferes) ? raw.choferes : [],
    camiones: Array.isArray(raw.camiones) ? raw.camiones : [],
  };
}

function readXlsxFlota(filePath) {
  const wb = XLSX.readFile(filePath);
  const choferesSheet = wb.SheetNames.find((n) => /chofer/i.test(n)) ?? wb.SheetNames[0];
  const camionesSheet = wb.SheetNames.find((n) => /camion|unidad|flota/i.test(n)) ?? wb.SheetNames[1];

  const choferesRows = XLSX.utils.sheet_to_json(wb.Sheets[choferesSheet] ?? {}, { defval: "" });
  const camionesRows = XLSX.utils.sheet_to_json(wb.Sheets[camionesSheet] ?? {}, { defval: "" });

  const choferes = choferesRows
    .map((r) => ({
      nombre: String(r.nombre ?? r.Nombre ?? r.chofer ?? r.Chofer ?? "").trim(),
      telefono: String(r.telefono ?? r.Teléfono ?? r.telefono_whatsapp ?? "").trim(),
      disponible: truthy(r.disponible ?? r.Disponible ?? "si"),
      licencia: String(r.licencia ?? r.Licencia ?? "").trim() || null,
    }))
    .filter((c) => c.nombre);

  const camiones = camionesRows
    .map((r) => ({
      tractor: String(r.tractor ?? r.Tractor ?? r.patente ?? r.Patente ?? "").trim(),
      semi: String(r.semi ?? r.Semi ?? r.acoplado ?? r.Acoplado ?? "").trim() || null,
      tipo: String(r.tipo ?? r.Tipo ?? "").trim() || null,
      capacidad_t: Number(r.capacidad_t ?? r.capacidad ?? r.Capacidad ?? r.toneladas ?? 28) || 28,
      disponible: truthy(r.disponible ?? r.Disponible ?? "si"),
    }))
    .filter((c) => c.tractor);

  return { choferes, camiones };
}

/** @returns {{ choferes: object[], camiones: object[], fuente: string }} */
export function cargarFlota() {
  const xlsxPath = process.env.VIAJES_FLOTA_XLSX?.trim();
  if (xlsxPath && fs.existsSync(xlsxPath)) {
    return { ...readXlsxFlota(xlsxPath), fuente: xlsxPath };
  }
  const localXlsx = path.join(DATA_DIR, "demo-flota.xlsx");
  if (fs.existsSync(localXlsx)) {
    return { ...readXlsxFlota(localXlsx), fuente: localXlsx };
  }
  return { ...readJsonFlota(), fuente: JSON_DEFAULT };
}

/**
 * Asigna chofer + unidad según disponibilidad y capacidad.
 * @param {{ toneladas?: number, viajesActivos?: { chofer?: string|null, tractor?: string|null }[] }} opts
 */
export function asignarDesdeFlota(opts = {}) {
  const toneladas = Number(opts.toneladas) || 20;
  const ocupadosChoferes = new Set(
    (opts.viajesActivos ?? [])
      .map((v) => String(v.chofer ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const ocupadosTractores = new Set(
    (opts.viajesActivos ?? [])
      .map((v) => String(v.tractor ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const { choferes, camiones, fuente } = cargarFlota();

  const camion = camiones.find(
    (c) =>
      c.disponible &&
      c.capacidad_t >= toneladas &&
      !ocupadosTractores.has(String(c.tractor).trim().toUpperCase()),
  );
  if (!camion) {
    return { ok: false, error: "Sin unidades disponibles con la capacidad requerida", fuente };
  }

  const chofer = choferes.find(
    (c) => c.disponible && !ocupadosChoferes.has(String(c.nombre).trim().toLowerCase()),
  );
  if (!chofer) {
    return { ok: false, error: "Sin choferes disponibles", fuente };
  }

  return {
    ok: true,
    fuente,
    chofer: chofer.nombre,
    telefono_chofer: chofer.telefono || null,
    tractor: camion.tractor,
    semi: camion.semi,
    tipo_unidad: camion.tipo,
    capacidad_t: camion.capacidad_t,
  };
}
