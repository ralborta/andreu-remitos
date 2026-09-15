/**
 * Sugerencias de contexto de viaje a partir de remitos del chofer
 * y hojas de ruta (Andreu) para anclar la rendición.
 * El nº viaje Delfos NO se inventa: se sugiere y el operador confirma.
 */
import * as remitoStore from "../backend/src/db/file-store.mjs";
import * as hojaStore from "../backend/src/db/hoja-ruta-store.mjs";

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function dayKey(isoOrDate) {
  if (!isoOrDate) return null;
  const s = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function remitoResumen(r) {
  const d = r.datos ?? {};
  const nro =
    d.nro_remito ||
    d.nro_guia ||
    d.numero_remito ||
    d.nro_documento ||
    null;
  const patente =
    d.patente ||
    d.patente_tractor ||
    d.dominio ||
    r.patente ||
    null;
  const fecha =
    dayKey(d.fecha_guia || d.fecha || d.fecha_remito || r.created_at) || null;
  const viajeDoc =
    d.nro_viaje_delfos ||
    d.nro_viaje ||
    d.numero_viaje ||
    d.viaje ||
    null;

  return {
    tipo: "remito",
    remitoId: r.id,
    nroRemito: nro ? String(nro).trim() : null,
    patente: patente ? String(patente).trim() : null,
    fecha,
    choferNombre: r.chofer_nombre || d.chofer || null,
    tenant: r.tenant || null,
    viajeDocumento: viajeDoc ? String(viajeDoc).trim() : null,
    nroViajeDelfos: null,
    createdAt: r.created_at || null,
  };
}

/**
 * @returns {{ sugerencias: object[], hojas: object[], nota: string }}
 */
export async function sugerirContextoViajeDesdeRemitos({
  telefono,
  fechaComprobante,
  limit = 12,
} = {}) {
  const phone = digits(telefono);
  if (!phone) {
    return {
      sugerencias: [],
      hojas: [],
      nota: "Sin teléfono de chofer no se pueden sugerir remitos ni hojas de ruta.",
    };
  }

  const hojas = await hojaStore.sugerirDesdeHojasRuta({ telefono: phone, limit: 5 });

  const all = await remitoStore.listRemitos({ limit: 400, includeOcr: false });
  const delChofer = all.filter((r) => {
    const t = digits(r.telefono_chofer);
    return t && (t === phone || t.endsWith(phone.slice(-10)) || phone.endsWith(t.slice(-10)));
  });

  const targetDay = dayKey(fechaComprobante);
  const scored = delChofer.map((r) => {
    const s = remitoResumen(r);
    let score = 0;
    if (targetDay && s.fecha === targetDay) score += 10;
    else if (targetDay && s.fecha) {
      const a = new Date(`${targetDay}T12:00:00`).getTime();
      const b = new Date(`${s.fecha}T12:00:00`).getTime();
      const diffDays = Math.abs(a - b) / 86400000;
      if (diffDays <= 3) score += 6;
      else if (diffDays <= 7) score += 3;
    }
    if (s.viajeDocumento) score += 2;
    if (s.nroRemito) score += 1;
    return { ...s, score };
  });

  scored.sort((a, b) => b.score - a.score || String(b.createdAt).localeCompare(String(a.createdAt)));

  const desdeHojas = hojas.map((h, i) => ({
    tipo: "hoja_ruta",
    remitoId: h.hojaId,
    nroRemito: h.codigo,
    patente: h.patente,
    fecha: h.fechaSalida || h.fechaLlegada,
    choferNombre: h.choferNombre,
    tenant: null,
    viajeDocumento: null,
    nroViajeDelfos: h.nroViajeDelfos,
    anticipoMonto: h.anticipoMonto,
    createdAt: h.createdAt,
    score: 100 - i,
  }));

  return {
    sugerencias: [...desdeHojas, ...scored.slice(0, limit)],
    hojas,
    nota:
      "Priorizá la *hoja de ruta* si hay Nº viaje leído. Remitos son ancla (chofer/fecha/patente). El Nº Delfos siempre se confirma a mano.",
  };
}
