/**
 * Unificación de identidad entre flota Viajes y Parámetros (master-data).
 *
 * Mapping (SIN migración destructiva):
 * - Identidad compartida (parametros.json / master-data):
 *     chofer:  nombre, telefono (+ documento)
 *     unidad:  patente (= tractor Viajes), semi_patente (= semi), tipo tractor|acoplado
 * - Solo Viajes (viajes-flota-maestros.json):
 *     días, horarios, excepciones, licencia, tipos_carga, capacidad_t, tipo de unidad operativa
 *
 * Match: chofer por teléfono normalizado; unidad/camión por patente (tractor).
 * Al crear/editar en Viajes → upsert identidad en master.
 * Al listar Viajes → enriquecer con master si hay match.
 * Al crear en Parámetros → upsert por teléfono/patente (no duplicar).
 */
import {
  createItem,
  findChoferByPhone,
  listCollection,
  normalizePatente,
  normalizePhone,
  updateItem,
} from "./master-data-store.mjs";
import {
  actualizarCamionViajes,
  actualizarChoferViajes,
  crearCamionViajes,
  crearChoferViajes,
  listCamionesViajes,
  listChoferesViajes,
} from "./viajes-flota-store.mjs";

const DEFAULT_TENANT = () =>
  String(process.env.FLOTA_IDENTIDAD_TENANT || "tsb").toLowerCase();

export function findUnidadByPatente(unidades, patente, { tipo } = {}) {
  const p = normalizePatente(patente);
  if (!p) return null;
  return (
    unidades.find((u) => {
      if (tipo && u.tipo !== tipo) return false;
      return normalizePatente(u.patente) === p;
    }) ?? null
  );
}

/**
 * Upsert identidad de chofer en master-data por teléfono.
 * @param {{ nombre?: string, telefono?: string, tenant?: string, documento?: string, activo?: boolean, soloTenant?: boolean }} data
 */
export async function upsertChoferIdentidad(data = {}) {
  const telefono = normalizePhone(data.telefono);
  const nombre = String(data.nombre ?? "").trim();
  const tenantPreferred = data.tenant ? String(data.tenant).toLowerCase() : null;
  const soloTenant = Boolean(data.soloTenant);

  // Teléfono = clave de identidad; sin él no sincronizamos (evita duplicados por nombre).
  if (!telefono) {
    return null;
  }

  const scoped = tenantPreferred
    ? await listCollection("choferes", { tenant: tenantPreferred })
    : await listCollection("choferes");
  let existing = findChoferByPhone(scoped, telefono);

  // Viajes (sin soloTenant): si no hay match en tenant preferido, buscar en todos
  if (!existing && telefono && tenantPreferred && !soloTenant) {
    existing = findChoferByPhone(await listCollection("choferes"), telefono);
  }

  const documento = data.documento != null ? normalizePhone(data.documento) || telefono : telefono;
  const patch = {
    ...(nombre ? { nombre } : {}),
    telefono,
    documento,
    ...(data.activo !== undefined ? { activo: Boolean(data.activo) } : {}),
  };

  if (existing) {
    return updateItem("choferes", existing.id, patch);
  }

  if (!nombre) {
    throw Object.assign(new Error("nombre requerido para crear chofer en master"), {
      statusCode: 400,
    });
  }

  return createItem("choferes", {
    tenant: tenantPreferred || DEFAULT_TENANT(),
    nombre,
    telefono,
    documento,
    activo: data.activo !== false,
  });
}

/**
 * Upsert identidad de unidad (tractor) en master-data por patente.
 * @param {{ patente?: string, tractor?: string, semi?: string, semi_patente?: string, tenant?: string, tipo?: string, activo?: boolean, unidad_interna?: string, soloTenant?: boolean }} data
 */
export async function upsertUnidadIdentidad(data = {}) {
  const patente = normalizePatente(data.patente ?? data.tractor);
  const tenantPreferred = data.tenant ? String(data.tenant).toLowerCase() : null;
  const soloTenant = Boolean(data.soloTenant);
  const tipo = data.tipo === "acoplado" ? "acoplado" : "tractor";
  const semiRaw = data.semi_patente ?? data.semi;
  const semi_patente =
    tipo === "acoplado"
      ? null
      : semiRaw
        ? normalizePatente(semiRaw)
        : semiRaw === null || semiRaw === ""
          ? null
          : undefined;

  if (!patente) {
    throw Object.assign(new Error("Falta patente para identidad de unidad"), { statusCode: 400 });
  }

  const scoped = tenantPreferred
    ? await listCollection("unidades", { tenant: tenantPreferred })
    : await listCollection("unidades");
  let existing = findUnidadByPatente(scoped, patente, { tipo });

  if (!existing && tenantPreferred && !soloTenant) {
    existing = findUnidadByPatente(await listCollection("unidades"), patente, { tipo });
  }

  const patch = {
    patente,
    tipo,
    ...(semi_patente !== undefined ? { semi_patente } : {}),
    ...(data.unidad_interna !== undefined ? { unidad_interna: data.unidad_interna } : {}),
    ...(data.activo !== undefined ? { activo: Boolean(data.activo) } : {}),
  };

  if (existing) {
    return updateItem("unidades", existing.id, patch);
  }

  return createItem("unidades", {
    tenant: tenantPreferred || DEFAULT_TENANT(),
    tipo,
    patente,
    semi_patente: semi_patente ?? null,
    unidad_interna: data.unidad_interna ?? null,
    activo: data.activo !== false,
  });
}

function enrichChofer(flotaRow, masterByPhone) {
  const tel = normalizePhone(flotaRow.telefono);
  const master = tel ? masterByPhone.get(tel) : null;
  if (!master) {
    return { ...flotaRow, master_id: null, identidad_fuente: "viajes" };
  }
  return {
    ...flotaRow,
    nombre: master.nombre || flotaRow.nombre,
    telefono: normalizePhone(master.telefono) || flotaRow.telefono,
    master_id: master.id,
    master_tenant: master.tenant ?? null,
    identidad_fuente: "master+viajes",
  };
}

function enrichCamion(flotaRow, masterByPatente) {
  const patente = normalizePatente(flotaRow.tractor);
  const master = patente ? masterByPatente.get(patente) : null;
  if (!master) {
    return { ...flotaRow, master_id: null, identidad_fuente: "viajes" };
  }
  return {
    ...flotaRow,
    tractor: normalizePatente(master.patente) || flotaRow.tractor,
    semi:
      master.semi_patente != null && master.semi_patente !== ""
        ? normalizePatente(master.semi_patente)
        : flotaRow.semi,
    master_id: master.id,
    master_tenant: master.tenant ?? null,
    unidad_interna: master.unidad_interna ?? null,
    identidad_fuente: "master+viajes",
  };
}

/** Lista choferes Viajes enriquecidos con identidad master (si hay match por teléfono). */
export async function listChoferesFlotaEnriquecidos() {
  const flota = listChoferesViajes();
  const masters = await listCollection("choferes");
  const byPhone = new Map();
  for (const m of masters) {
    const tel = normalizePhone(m.telefono) || normalizePhone(m.documento);
    if (tel && !byPhone.has(tel)) byPhone.set(tel, m);
  }
  return flota.map((c) => enrichChofer(c, byPhone));
}

/** Lista camiones Viajes enriquecidos con identidad master (si hay match por patente). */
export async function listCamionesFlotaEnriquecidos() {
  const flota = listCamionesViajes();
  const masters = await listCollection("unidades");
  const byPatente = new Map();
  for (const m of masters) {
    if (m.tipo && m.tipo !== "tractor") continue;
    const p = normalizePatente(m.patente);
    if (p && !byPatente.has(p)) byPatente.set(p, m);
  }
  return flota.map((c) => enrichCamion(c, byPatente));
}

/** Crear chofer en flota Viajes + upsert identidad en master. */
export async function crearChoferFlotaConSync(body = {}) {
  const row = crearChoferViajes(body);
  await upsertChoferIdentidad({
    nombre: row.nombre,
    telefono: row.telefono,
    activo: row.activo,
    tenant: body.tenant,
  });
  return row;
}

/** Actualizar chofer flota + sincronizar identidad. */
export async function actualizarChoferFlotaConSync(id, patch = {}) {
  const row = actualizarChoferViajes(id, patch);
  if (!row) return null;
  await upsertChoferIdentidad({
    nombre: row.nombre,
    telefono: row.telefono,
    activo: row.activo,
    tenant: patch.tenant,
  });
  return row;
}

/** Crear camión en flota Viajes + upsert identidad unidad en master. */
export async function crearCamionFlotaConSync(body = {}) {
  const row = crearCamionViajes(body);
  await upsertUnidadIdentidad({
    patente: row.tractor,
    semi: row.semi,
    tipo: "tractor",
    activo: row.activo,
    tenant: body.tenant,
  });
  return row;
}

/** Actualizar camión flota + sincronizar identidad. */
export async function actualizarCamionFlotaConSync(id, patch = {}) {
  const row = actualizarCamionViajes(id, patch);
  if (!row) return null;
  await upsertUnidadIdentidad({
    patente: row.tractor,
    semi: row.semi,
    tipo: "tractor",
    activo: row.activo,
    tenant: patch.tenant,
  });
  return row;
}

/**
 * Crear chofer en Parámetros sin duplicar por teléfono (mismo tenant).
 * Si ya existe, actualiza identidad; no toca horarios de flota Viajes.
 */
export async function createChoferParametrosSinDuplicar(body = {}) {
  return upsertChoferIdentidad({
    nombre: body.nombre,
    telefono: body.telefono,
    documento: body.documento,
    tenant: body.tenant,
    activo: body.activo,
    soloTenant: true,
  });
}

/**
 * Crear unidad en Parámetros sin duplicar por patente (mismo tenant + tipo).
 * Si ya existe, actualiza; no toca horarios de flota Viajes.
 */
export async function createUnidadParametrosSinDuplicar(body = {}) {
  return upsertUnidadIdentidad({
    patente: body.patente,
    semi_patente: body.semi_patente,
    tipo: body.tipo,
    tenant: body.tenant,
    activo: body.activo,
    unidad_interna: body.unidad_interna,
    soloTenant: true,
  });
}
