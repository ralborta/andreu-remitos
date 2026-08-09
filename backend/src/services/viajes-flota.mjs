import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { DEMO_FLOTA } from "../seed/demo-flota.mjs";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.join(backendRoot, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(repoRoot, "data");

function resolveFlotaJson() {
  const candidates = [
    path.join(DATA_DIR, "demo-flota.json"),
    path.join(backendRoot, "data", "demo-flota.json"),
    path.join(repoRoot, "data", "demo-flota.json"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function truthy(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  return ["si", "sí", "yes", "true", "1", "disponible", "ok"].includes(s);
}

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Fecha de retiro → YYYY-MM-DD (hoy si no se puede parsear). */
export function normalizarFechaRetiro(texto, { hoy = new Date() } = {}) {
  const raw = String(texto ?? "").trim().toLowerCase();
  const base = new Date(hoy);
  base.setHours(12, 0, 0, 0);

  if (!raw) return isoDate(base);

  if (/^hoy\b/.test(raw)) return isoDate(base);
  if (/^mañana|^manana/.test(raw)) {
    base.setDate(base.getDate() + 1);
    return isoDate(base);
  }
  if (/pasado\s*mañana|pasado\s*manana/.test(raw)) {
    base.setDate(base.getDate() + 2);
    return isoDate(base);
  }

  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = raw.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    let y = dmy[3] ? Number(dmy[3]) : base.getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d, 12);
    if (!Number.isNaN(dt.getTime())) return isoDate(dt);
  }

  return isoDate(base);
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function disponibleEnFecha(item, fechaIso) {
  if (item.disponible === false) return false;
  const lista = item.disponibilidad;
  if (!Array.isArray(lista) || lista.length === 0) return Boolean(item.disponible ?? true);
  return lista.includes(fechaIso);
}

function camionSirveParaCarga(camion, tipoCarga) {
  const carga = norm(tipoCarga);
  if (!carga) return true;
  const tipos = (camion.tipos_carga ?? []).map(norm);
  if (tipos.length === 0) return true;
  if (tipos.some((t) => carga.includes(t) || t.includes(carga))) return true;
  // match por tipo de unidad
  const tipoUnidad = norm(camion.tipo);
  if (tipoUnidad && (carga.includes(tipoUnidad) || tipoUnidad.includes(carga))) return true;
  return false;
}

function readJsonFlota() {
  const file = resolveFlotaJson();
  const rolling = buildRollingDates(14);
  let raw = DEMO_FLOTA;
  let fuente = "seed:demo-flota";
  if (file && fs.existsSync(file)) {
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
      fuente = file;
    } catch {
      /* usar seed embebido */
    }
  }
  return {
    choferes: (Array.isArray(raw.choferes) ? raw.choferes : []).map((c) =>
      mergeDisponibilidad(c, rolling),
    ),
    camiones: (Array.isArray(raw.camiones) ? raw.camiones : []).map((c) =>
      mergeDisponibilidad(c, rolling),
    ),
    _file: fuente,
  };
}

function buildRollingDates(days) {
  const out = [];
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i);
    out.push(isoDate(d));
  }
  return out;
}

/** Resuelve disponibilidad: offsets relativos (días desde hoy) o fechas ISO. */
function mergeDisponibilidad(item, rolling) {
  if (item.disponible === false) return { ...item, disponibilidad: [] };
  if (Array.isArray(item.disponibilidad_dias) && item.disponibilidad_dias.length) {
    const disponibilidad = item.disponibilidad_dias
      .map((i) => rolling[Number(i)])
      .filter(Boolean);
    return { ...item, disponibilidad };
  }
  const seed = Array.isArray(item.disponibilidad) ? item.disponibilidad : [];
  const setRolling = new Set(rolling);
  const inter = seed.filter((f) => setRolling.has(f));
  return { ...item, disponibilidad: inter.length ? inter : rolling };
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
      disponibilidad: [],
    }))
    .filter((c) => c.nombre);

  const camiones = camionesRows
    .map((r) => ({
      tractor: String(r.tractor ?? r.Tractor ?? r.patente ?? r.Patente ?? "").trim(),
      semi: String(r.semi ?? r.Semi ?? r.acoplado ?? r.Acoplado ?? "").trim() || null,
      tipo: String(r.tipo ?? r.Tipo ?? "").trim() || null,
      tipos_carga: String(r.tipos_carga ?? r.Tipos ?? "")
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
      capacidad_t: Number(r.capacidad_t ?? r.capacidad ?? r.Capacidad ?? r.toneladas ?? 28) || 28,
      disponible: truthy(r.disponible ?? r.Disponible ?? "si"),
      disponibilidad: [],
    }))
    .filter((c) => c.tractor);

  return { choferes, camiones };
}

/** @returns {{ choferes: object[], camiones: object[], fuente: string }} */
export function cargarFlota() {
  // Preferir JSON de prueba (tipos + fechas).
  const json = readJsonFlota();
  if (json.camiones.length || json.choferes.length) {
    return { choferes: json.choferes, camiones: json.camiones, fuente: json._file };
  }
  const xlsxPath = process.env.VIAJES_FLOTA_XLSX?.trim();
  if (xlsxPath && fs.existsSync(xlsxPath)) {
    return { ...readXlsxFlota(xlsxPath), fuente: xlsxPath };
  }
  const localXlsx = path.join(DATA_DIR, "demo-flota.xlsx");
  if (fs.existsSync(localXlsx)) {
    return { ...readXlsxFlota(localXlsx), fuente: localXlsx };
  }
  return { choferes: [], camiones: [], fuente: json._file };
}

/**
 * Asigna chofer + unidad por capacidad, tipo de carga y disponibilidad por fecha.
 * @param {{
 *   toneladas?: number,
 *   tipo_carga?: string|null,
 *   fecha_retiro?: string|null,
 *   viajesActivos?: { chofer?: string|null, tractor?: string|null }[]
 * }} opts
 */
export function asignarDesdeFlota(opts = {}) {
  const toneladas = Number(opts.toneladas) || 20;
  const tipoCarga = opts.tipo_carga ?? null;
  const fechaIso = normalizarFechaRetiro(opts.fecha_retiro);

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

  const candidatos = camiones.filter(
    (c) =>
      disponibleEnFecha(c, fechaIso) &&
      c.capacidad_t >= toneladas &&
      camionSirveParaCarga(c, tipoCarga) &&
      !ocupadosTractores.has(String(c.tractor).trim().toUpperCase()),
  );

  // Preferir match de tipo de carga; si no hay, capacidada+fecha
  let camion = candidatos[0] ?? null;
  if (!camion && tipoCarga) {
    camion =
      camiones.find(
        (c) =>
          disponibleEnFecha(c, fechaIso) &&
          c.capacidad_t >= toneladas &&
          !ocupadosTractores.has(String(c.tractor).trim().toUpperCase()),
      ) ?? null;
  }

  if (!camion) {
    return {
      ok: false,
      error: `Sin unidades disponibles para ${fechaIso}` +
        (tipoCarga ? ` / carga "${tipoCarga}"` : "") +
        ` / ≥${toneladas} t`,
      fuente,
      fecha: fechaIso,
    };
  }

  const chofer = choferes.find(
    (c) =>
      disponibleEnFecha(c, fechaIso) &&
      !ocupadosChoferes.has(String(c.nombre).trim().toLowerCase()),
  );
  if (!chofer) {
    return {
      ok: false,
      error: `Sin choferes disponibles para ${fechaIso}`,
      fuente,
      fecha: fechaIso,
    };
  }

  return {
    ok: true,
    fuente,
    fecha: fechaIso,
    chofer: chofer.nombre,
    telefono_chofer: chofer.telefono || null,
    tractor: camion.tractor,
    semi: camion.semi,
    tipo_unidad: camion.tipo,
    capacidad_t: camion.capacidad_t,
    tipos_carga: camion.tipos_carga ?? [],
  };
}
