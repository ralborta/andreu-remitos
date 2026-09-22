/**
 * Store de gastos / rendición (SOL + Andreu).
 * Archivo: DATA_DIR/rendicion-gastos.json
 *
 * Reglas Andreu (nº viaje Delfos al aprobar) vía lib/rendicion-rules.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizePhone } from "../../../lib/builderbot-webhook.mjs";
import {
  GASTO_ESTADOS,
  RENDICION_CATEGORIAS,
} from "../../../lib/rendicion.mjs";
import { getRendicionRules } from "../../../lib/rendicion-rules.mjs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "rendicion-gastos.json");

function readAll() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function nextCodigo(rows) {
  const n = rows.length + 1;
  return `RG-${String(n).padStart(4, "0")}`;
}

function parseBound(iso, endOfDay = false) {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`)
    : new Date(s);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function normStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function matchesQuery(row, q) {
  const needle = String(q || "")
    .toLowerCase()
    .trim();
  if (!needle) return true;
  const hay = [
    row.codigo,
    row.chofer_nombre,
    row.telefono,
    row.viaje_ref,
    row.nro_viaje_delfos,
    row.viaje_documento,
    row.proveedor,
    row.descripcion,
    row.nota_chofer,
    row.texto_ocr,
    row.patente,
    row.remito_ref,
    row.nro_remito,
    row.punto_venta,
    row.nro_t,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export async function listGastos({
  limit = 100,
  estado,
  telefono,
  q,
  desde,
  hasta,
} = {}) {
  let rows = readAll();
  if (estado) rows = rows.filter((r) => r.estado === estado);
  if (telefono) {
    const p = sanitizePhone(telefono);
    rows = rows.filter((r) => r.telefono === p);
  }
  if (q) rows = rows.filter((r) => matchesQuery(r, q));
  const fromTs = parseBound(desde, false);
  const toTs = parseBound(hasta, true);
  if (fromTs != null) {
    rows = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return Number.isFinite(t) && t >= fromTs;
    });
  }
  if (toTs != null) {
    rows = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return Number.isFinite(t) && t <= toTs;
    });
  }
  return rows.slice(0, limit);
}

export async function getGasto(id) {
  return readAll().find((r) => r.id === id) ?? null;
}

/** Clave de dedupe: nº ticket + (CUIT|proveedor) + monto + fecha. */
export function claveDuplicadoGasto(g = {}) {
  const nro = String(g.nro_t || "").replace(/\D/g, "");
  const cuit = String(g.cuit_proveedor || "").replace(/\D/g, "");
  const monto =
    g.monto != null && Number.isFinite(Number(g.monto))
      ? Number(g.monto).toFixed(2)
      : "";
  const fecha = String(g.fecha_comprobante || "").slice(0, 10);
  const proveedor = String(g.proveedor || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if (nro && (cuit.length >= 8 || proveedor) && monto !== "") {
    return `nro:${nro}|id:${cuit || proveedor}|m:${monto}|f:${fecha}`;
  }
  if (nro && monto !== "") return `nro:${nro}|m:${monto}|f:${fecha}`;
  if (cuit.length >= 8 && monto !== "" && fecha) {
    return `cuit:${cuit}|m:${monto}|f:${fecha}`;
  }
  return null;
}

/**
 * Busca gasto ya cargado (mismo chofer; prioriza mismo viaje Delfos).
 * No considera rechazados.
 */
export async function buscarDuplicadoGasto({
  telefono,
  nro_viaje_delfos,
  nro_t,
  cuit_proveedor,
  monto,
  fecha_comprobante,
  proveedor,
} = {}) {
  const clave = claveDuplicadoGasto({
    nro_t,
    cuit_proveedor,
    monto,
    fecha_comprobante,
    proveedor,
  });
  if (!clave) return null;
  const phone = sanitizePhone(telefono);
  const nroViaje = normStr(nro_viaje_delfos);
  const rows = readAll().filter((r) => {
    if (r.estado === "rechazado") return false;
    if (phone && r.telefono !== phone) return false;
    if (
      nroViaje &&
      r.nro_viaje_delfos &&
      String(r.nro_viaje_delfos).trim() !== nroViaje
    ) {
      return false;
    }
    return claveDuplicadoGasto(r) === clave;
  });
  return rows[0] || null;
}

export async function crearGasto(body = {}) {
  const rows = readAll();
  const now = new Date().toISOString();
  const phone = sanitizePhone(body.telefono);
  let categoria = String(body.categoria || "otro").toLowerCase().trim();
  if (!RENDICION_CATEGORIAS.includes(categoria)) categoria = "otro";
  let estado = String(body.estado || "pendiente_aprobacion");
  if (!GASTO_ESTADOS.includes(estado)) estado = "pendiente_aprobacion";

  const row = {
    id: `RG-${randomUUID().slice(0, 8).toUpperCase()}`,
    codigo: nextCodigo(rows),
    estado,
    categoria,
    monto: body.monto != null && Number.isFinite(Number(body.monto)) ? Number(body.monto) : null,
    moneda: body.moneda || "ARS",
    /** Moneda del ticket original (ej. CLP). null = mismo que moneda. */
    moneda_origen: normStr(body.moneda_origen),
    monto_origen:
      body.monto_origen != null && Number.isFinite(Number(body.monto_origen))
        ? Number(body.monto_origen)
        : null,
    tc_clp_ars:
      body.tc_clp_ars != null && Number.isFinite(Number(body.tc_clp_ars))
        ? Number(body.tc_clp_ars)
        : null,
    tc_fecha: body.tc_fecha || null,
    tc_fuente: normStr(body.tc_fuente),
    proveedor: normStr(body.proveedor),
    fecha_comprobante: body.fecha_comprobante || null,
    descripcion: normStr(body.descripcion),
    /** Referencia libre / legacy SOL */
    viaje_ref: normStr(body.viaje_ref),
    /**
     * Nº viaje Delfos confirmado por mesa (Andreu).
     * Distinto de cualquier número leído en el comprobante.
     */
    nro_viaje_delfos: normStr(body.nro_viaje_delfos),
    /** Número de viaje que apareció en OCR/documento (puede NO ser Delfos). */
    viaje_documento: normStr(body.viaje_documento),
    remito_ref: normStr(body.remito_ref || body.nro_remito || body.remito),
    remito_id: normStr(body.remito_id),
    patente: normStr(body.patente),
    punto_venta: normStr(body.punto_venta || body.pv),
    nro_t: normStr(body.nro_t),
    iva_pct:
      body.iva_pct != null && Number.isFinite(Number(body.iva_pct))
        ? Number(body.iva_pct)
        : null,
    rae: Boolean(body.rae),
    monto_rae:
      body.monto_rae != null && Number.isFinite(Number(body.monto_rae))
        ? Number(body.monto_rae)
        : null,
    cuit_proveedor: normStr(body.cuit_proveedor),
    telefono: phone || null,
    chofer_nombre: body.chofer_nombre || body.nombre || null,
    imagen_url: body.imagen_url || null,
    nota_chofer: body.nota_chofer || null,
    texto_ocr: body.texto_ocr ? String(body.texto_ocr).slice(0, 12000) : null,
    nota_aprobacion: null,
    aprobado_por: null,
    historial: [`${now} · Creado (${estado})`],
    created_at: now,
    updated_at: now,
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

const PATCH_KEYS = [
  "categoria",
  "monto",
  "moneda",
  "moneda_origen",
  "monto_origen",
  "tc_clp_ars",
  "tc_fecha",
  "tc_fuente",
  "proveedor",
  "fecha_comprobante",
  "descripcion",
  "viaje_ref",
  "nro_viaje_delfos",
  "viaje_documento",
  "remito_ref",
  "remito_id",
  "patente",
  "punto_venta",
  "nro_t",
  "iva_pct",
  "rae",
  "monto_rae",
  "cuit_proveedor",
  "chofer_nombre",
  "imagen_url",
  "nota_chofer",
  "texto_ocr",
  "nota_aprobacion",
  "aprobado_por",
];

export async function actualizarGasto(id, patch = {}) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = rows[i];
  const now = new Date().toISOString();

  for (const k of PATCH_KEYS) {
    if (patch[k] !== undefined) {
      if (
        k === "proveedor" ||
        k === "descripcion" ||
        k === "viaje_ref" ||
        k === "nro_viaje_delfos" ||
        k === "viaje_documento" ||
        k === "remito_ref" ||
        k === "remito_id" ||
        k === "patente" ||
        k === "punto_venta" ||
        k === "nro_t" ||
        k === "cuit_proveedor" ||
        k === "moneda_origen" ||
        k === "tc_fuente"
      ) {
        row[k] = normStr(patch[k]);
      } else if (k === "rae") {
        row[k] = Boolean(patch[k]);
      } else {
        row[k] = patch[k];
      }
    }
  }
  if (patch.texto_ocr !== undefined && patch.texto_ocr != null) {
    row.texto_ocr = String(patch.texto_ocr).slice(0, 12000);
  }
  if (patch.monto != null) row.monto = Number(patch.monto);
  if (patch.monto_origen != null) row.monto_origen = Number(patch.monto_origen);
  if (patch.tc_clp_ars != null) row.tc_clp_ars = Number(patch.tc_clp_ars);
  if (patch.iva_pct != null) row.iva_pct = Number(patch.iva_pct);
  if (patch.monto_rae != null) row.monto_rae = Number(patch.monto_rae);
  if (patch.categoria && RENDICION_CATEGORIAS.includes(patch.categoria)) {
    row.categoria = patch.categoria;
  }
  if (patch.estado && GASTO_ESTADOS.includes(patch.estado)) {
    row.estado = patch.estado;
  }

  // Recalcular ARS si cambió TC o monto origen (ticket CLP)
  const tcChanged = patch.tc_clp_ars != null;
  const origenChanged = patch.monto_origen != null;
  const marcarClp =
    patch.moneda_origen !== undefined
      ? String(patch.moneda_origen || "").toUpperCase() === "CLP"
      : row.moneda_origen === "CLP";
  if (marcarClp && patch.moneda_origen !== undefined) {
    row.moneda_origen = "CLP";
  }
  if (
    (tcChanged || origenChanged || marcarClp) &&
    (row.moneda_origen === "CLP" || marcarClp) &&
    row.monto_origen != null &&
    row.tc_clp_ars != null &&
    Number(row.tc_clp_ars) > 0
  ) {
    const prev = row.monto;
    row.moneda_origen = "CLP";
    row.monto = Math.round(Number(row.monto_origen) * Number(row.tc_clp_ars) * 100) / 100;
    row.moneda = "ARS";
    if (patch.tc_fecha !== undefined) row.tc_fecha = patch.tc_fecha || null;
    else if (tcChanged) row.tc_fecha = now;
    if (patch.tc_fuente !== undefined) row.tc_fuente = normStr(patch.tc_fuente) || row.tc_fuente;
    else if (tcChanged && !row.tc_fuente) row.tc_fuente = "manual";
    if (!patch.historial_push) {
      patch.historial_push = `${now} · TC CLP→ARS ${row.tc_clp_ars} · ${prev} → ${row.monto} ARS`;
    }
  }

  if (patch.historial_push) {
    row.historial = [...(row.historial ?? []), patch.historial_push];
  }
  row.updated_at = now;
  writeAll(rows);
  return row;
}

export async function decidirGasto(
  id,
  { estado, nota, aprobado_por, nro_viaje_delfos, remito_ref } = {},
) {
  if (!["aprobado", "rechazado"].includes(estado)) {
    throw Object.assign(new Error("Estado inválido (aprobado|rechazado)"), { statusCode: 400 });
  }
  const notaNorm = typeof nota === "string" ? nota.trim() : "";
  if (estado === "rechazado" && !notaNorm) {
    throw Object.assign(new Error("El rechazo requiere un comentario"), { statusCode: 400 });
  }

  const actual = await getGasto(id);
  if (!actual) return null;

  const rules = getRendicionRules();
  let nroDelfos = normStr(nro_viaje_delfos) || normStr(actual.nro_viaje_delfos);

  if (estado === "aprobado" && rules.requireNroViajeDelfosOnApprove) {
    if (!nroDelfos) {
      throw Object.assign(
        new Error(
          "Andreu: para aprobar debés confirmar el Nº viaje Delfos (no uses otros números del documento).",
        ),
        { statusCode: 400 },
      );
    }
  }

  const patch = {
    estado,
    nota_aprobacion: notaNorm || null,
    aprobado_por: aprobado_por || "backoffice",
    historial_push: `${new Date().toISOString()} · ${estado}${
      nroDelfos ? ` · viaje Delfos ${nroDelfos}` : ""
    }${notaNorm ? `: ${notaNorm}` : ""}`,
  };
  if (nro_viaje_delfos !== undefined) patch.nro_viaje_delfos = nroDelfos;
  if (remito_ref !== undefined) patch.remito_ref = normStr(remito_ref);

  return actualizarGasto(id, patch);
}

export async function resumenGastos() {
  const rows = readAll();
  const sum = (est) =>
    rows.filter((r) => r.estado === est).reduce((a, r) => a + (Number(r.monto) || 0), 0);
  return {
    total: rows.length,
    pendientes: rows.filter((r) => r.estado === "pendiente_aprobacion").length,
    aprobados: rows.filter((r) => r.estado === "aprobado").length,
    rechazados: rows.filter((r) => r.estado === "rechazado").length,
    monto_pendiente: sum("pendiente_aprobacion"),
    monto_aprobado: sum("aprobado"),
  };
}
