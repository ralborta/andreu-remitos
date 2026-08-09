import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { DEMO_FLOTA } from "../seed/demo-flota.mjs";
import { flotaParaMatch } from "../db/viajes-flota-store.mjs";

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

/** "8", "8:00", "08hs", "a las 11" → "HH:MM" o null. */
export function normalizarHora(texto) {
  const raw = String(texto ?? "").trim().toLowerCase();
  if (!raw) return null;
  const m =
    raw.match(/\b(\d{1,2})[:.](\d{2})\b/) ||
    raw.match(/\b(\d{1,2})\s*hs?\b/) ||
    raw.match(/\ba\s*las?\s*(\d{1,2})(?::(\d{2}))?\b/) ||
    raw.match(/^(\d{1,2})$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] != null ? Number(m[2]) : 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (!Number.isFinite(min) || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoLocal(fechaIso) {
  const [y, m, d] = String(fechaIso).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function offsetDesdeHoy(fechaIso, hoy = new Date()) {
  const a = new Date(hoy);
  a.setHours(12, 0, 0, 0);
  const b = parseIsoLocal(fechaIso);
  return Math.round((b - a) / 86400000);
}

function horariosDeItem(item, fechaIso) {
  // Maestros Viajes: excepción por fecha exacta
  if (item.excepciones && Object.prototype.hasOwnProperty.call(item.excepciones, fechaIso)) {
    const h = item.excepciones[fechaIso];
    return Array.isArray(h) ? h : [];
  }
  // Legacy seed offsets
  const off = String(offsetDesdeHoy(fechaIso));
  if (item.horarios_offset && Array.isArray(item.horarios_offset[off])) {
    return item.horarios_offset[off];
  }
  if (Array.isArray(item.horarios) && item.horarios.length) return item.horarios;
  return ["08:00", "11:00", "14:00"];
}

function horaDisponible(item, fechaIso, hora) {
  if (!hora) return true;
  return horariosDeItem(item, fechaIso).includes(hora);
}

function disponibleEnFecha(item, fechaIso) {
  if (item.activo === false || item.disponible === false) return false;

  // Maestros Viajes: excepción con lista vacía = no disponible ese día
  if (item.excepciones && Object.prototype.hasOwnProperty.call(item.excepciones, fechaIso)) {
    const h = item.excepciones[fechaIso];
    return Array.isArray(h) && h.length > 0;
  }

  // Maestros Viajes: días de la semana (0=Dom … 6=Sáb)
  if (Array.isArray(item.dias_semana) && item.dias_semana.length) {
    const wd = parseIsoLocal(fechaIso).getDay();
    return item.dias_semana.map(Number).includes(wd);
  }

  // Legacy: lista ISO
  const lista = item.disponibilidad;
  if (!Array.isArray(lista) || lista.length === 0) return Boolean(item.disponible ?? item.activo ?? true);
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
  // Solo override con JSON externo si se pide explícito (demo usa seed versionado).
  const forceJson = process.env.VIAJES_FLOTA_JSON?.trim();
  const jsonPath = forceJson || null;
  if (jsonPath && fs.existsSync(jsonPath)) {
    try {
      raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      fuente = jsonPath;
    } catch {
      /* seed */
    }
  } else if (file && process.env.VIAJES_FLOTA_PREFER_JSON === "true") {
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
      fuente = file;
    } catch {
      /* seed */
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
  // 1) Maestros propios de Gestión de Viajes (NO Remitos/Parámetros)
  try {
    const maestros = flotaParaMatch();
    if (maestros.camiones.length || maestros.choferes.length) {
      return {
        choferes: maestros.choferes,
        camiones: maestros.camiones,
        fuente: maestros.fuente,
      };
    }
  } catch {
    /* seguir con fallbacks */
  }

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
  return { choferes: [], camiones: [], fuente: "vacio" };
}

/**
 * Consulta disponibilidad y arma propuesta + alternativas (fecha/hora).
 * No reserva: solo opciones para que el cliente confirme.
 */
export function consultarDisponibilidad(opts = {}) {
  const toneladas = Number(opts.toneladas) || 20;
  const tipoCarga = opts.tipo_carga ?? null;
  const fechaPedida = normalizarFechaRetiro(opts.fecha_retiro);
  const horaPedida = normalizarHora(opts.hora_retiro);
  const { choferes, camiones, fuente } = cargarFlota();
  const ocupados = ocupadosSets(opts.viajesActivos);

  const slotExacto = encontrarSlot({
    camiones,
    choferes,
    fechaIso: fechaPedida,
    hora: horaPedida,
    toneladas,
    tipoCarga,
    ocupados,
    exigirHoraExacta: Boolean(horaPedida),
  });

  const alternativas = [];
  const seen = new Set();
  const pushAlt = (slot, motivo) => {
    if (!slot) return;
    const key = `${slot.fecha}|${slot.hora}|${slot.tractor}`;
    if (seen.has(key)) return;
    seen.add(key);
    alternativas.push({ ...slot, motivo });
  };

  if (slotExacto) {
    seen.add(`${slotExacto.fecha}|${slotExacto.hora}|${slotExacto.tractor}`);
  }

  // Misma fecha, otras horas
  const horasDia = new Set();
  for (const c of camiones) {
    if (!disponibleEnFecha(c, fechaPedida) || !camionSirveParaCarga(c, tipoCarga)) continue;
    if (c.capacidad_t < toneladas) continue;
    for (const h of horariosDeItem(c, fechaPedida)) horasDia.add(h);
  }
  for (const h of [...horasDia].sort()) {
    if (horaPedida && h === horaPedida) continue;
    const s = encontrarSlot({
      camiones,
      choferes,
      fechaIso: fechaPedida,
      hora: h,
      toneladas,
      tipoCarga,
      ocupados,
      exigirHoraExacta: true,
    });
    pushAlt(s, horaPedida
      ? `mismo día, ${h} en vez de ${horaPedida}`
      : `horario ${h}`);
  }

  // Otras fechas (próx. 10 días)
  const base = parseIsoLocal(fechaPedida);
  for (let i = 1; i <= 10 && alternativas.length < 5; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const fechaAlt = isoDate(d);
    const s = encontrarSlot({
      camiones,
      choferes,
      fechaIso: fechaAlt,
      hora: horaPedida,
      toneladas,
      tipoCarga,
      ocupados,
      exigirHoraExacta: Boolean(horaPedida),
    });
    pushAlt(s, `otra fecha: ${fechaAlt}`);
  }

  const exactaOk = Boolean(
    slotExacto &&
      slotExacto.fecha === fechaPedida &&
      (!horaPedida || slotExacto.hora === horaPedida),
  );

  const propuesta = exactaOk ? slotExacto : alternativas[0] ?? slotExacto ?? null;
  const altsSinPropuesta = alternativas.filter(
    (a) => !(propuesta && a.fecha === propuesta.fecha && a.hora === propuesta.hora && a.tractor === propuesta.tractor),
  );

  return {
    ok: Boolean(propuesta),
    fuente,
    pedida: { fecha: fechaPedida, hora: horaPedida },
    exacta: exactaOk ? slotExacto : null,
    exacta_ok: exactaOk,
    propuesta,
    alternativas: altsSinPropuesta.slice(0, 4),
    error: propuesta
      ? null
      : `Sin disponibilidad para ${fechaPedida}` +
        (horaPedida ? ` ${horaPedida}` : "") +
        (tipoCarga ? ` / ${tipoCarga}` : "") +
        ` / ≥${toneladas} t`,
  };
}

function ocupadosSets(viajesActivos) {
  return {
    choferes: new Set(
      (viajesActivos ?? [])
        .map((v) => String(v.chofer ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
    tractores: new Set(
      (viajesActivos ?? [])
        .map((v) => String(v.tractor ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  };
}

function encontrarSlot({
  camiones,
  choferes,
  fechaIso,
  hora,
  toneladas,
  tipoCarga,
  ocupados,
  exigirHoraExacta,
}) {
  const candidatos = camiones.filter(
    (c) =>
      disponibleEnFecha(c, fechaIso) &&
      c.capacidad_t >= toneladas &&
      camionSirveParaCarga(c, tipoCarga) &&
      !ocupados.tractores.has(String(c.tractor).trim().toUpperCase()) &&
      (!exigirHoraExacta || !hora || horaDisponible(c, fechaIso, hora)),
  );

  let camion = candidatos[0] ?? null;
  if (!camion) return null;

  const horaFinal =
    (hora && horaDisponible(camion, fechaIso, hora) && hora) ||
    horariosDeItem(camion, fechaIso)[0] ||
    "08:00";

  if (exigirHoraExacta && hora && horaFinal !== hora) return null;

  const chofer = choferes.find(
    (c) =>
      disponibleEnFecha(c, fechaIso) &&
      horaDisponible(c, fechaIso, horaFinal) &&
      !ocupados.choferes.has(String(c.nombre).trim().toLowerCase()),
  );
  if (!chofer) return null;

  return {
    ok: true,
    fecha: fechaIso,
    hora: horaFinal,
    chofer: chofer.nombre,
    telefono_chofer: chofer.telefono || null,
    tractor: camion.tractor,
    semi: camion.semi,
    tipo_unidad: camion.tipo,
    capacidad_t: camion.capacidad_t,
    tipos_carga: camion.tipos_carga ?? [],
  };
}

/**
 * Asigna chofer + unidad por capacidad, tipo de carga y disponibilidad por fecha/hora.
 */
export function asignarDesdeFlota(opts = {}) {
  const consulta = consultarDisponibilidad(opts);
  if (!consulta.ok || !consulta.propuesta) {
    return {
      ok: false,
      error: consulta.error,
      fuente: consulta.fuente,
      fecha: consulta.pedida.fecha,
      hora: consulta.pedida.hora,
    };
  }
  // Preferir exacta si pidieron confirmar esa; si no, propuesta
  const slot =
    opts.forzar_propuesta ||
    (consulta.exacta_ok ? consulta.exacta : null) ||
    consulta.propuesta;
  return {
    ok: true,
    fuente: consulta.fuente,
    fecha: slot.fecha,
    hora: slot.hora,
    chofer: slot.chofer,
    telefono_chofer: slot.telefono_chofer,
    tractor: slot.tractor,
    semi: slot.semi,
    tipo_unidad: slot.tipo_unidad,
    capacidad_t: slot.capacidad_t,
    tipos_carga: slot.tipos_carga,
  };
}
