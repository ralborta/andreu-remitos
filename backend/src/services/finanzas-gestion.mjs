import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import {
  appendPasoFactura,
  ensureSeedFacturasCobrar,
  findFacturaCobrarDuplicada,
  finanzasFacturaId,
  getFacturaInterna,
  insertFactura,
  listFacturas,
  updateFactura,
} from "../db/finanzas-facturas-store.mjs";
import {
  ensureSeedCobrosDemo,
  findCobroByExternalRef,
  finanzasCobroId,
  getCobro,
  insertCobro,
  listCobros,
  updateCobro,
} from "../db/finanzas-cobros-store.mjs";

function paso(agente, label, extra = {}) {
  return { at: new Date().toISOString(), agente, label, ...extra };
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v);
}

function saldoDe(f) {
  return Math.max(0, Number(f.monto || 0) - Number(f.monto_aplicado || 0));
}

function estadoCobrar(f) {
  const saldo = saldoDe(f);
  if (saldo <= 0.009) return "saldada";
  if (Number(f.monto_aplicado || 0) > 0) return "parcial";
  return "abierta";
}

export async function ensureFinanzasDemo() {
  await ensureSeedFacturasCobrar();
  await ensureSeedCobrosDemo();
}

export async function resumenFinanzas() {
  await ensureFinanzasDemo();
  const todas = await listFacturas({ limit: 500 });
  const pagar = todas.filter((f) => f.tipo === "pagar");
  const cobrar = todas.filter((f) => f.tipo === "cobrar");
  const cobros = await listCobros({ limit: 500 });
  const cartera = cobrar.reduce((s, f) => s + saldoDe(f), 0);
  const aplicados = cobros.filter((c) => c.estado === "aplicado");
  const pendientes = cobros.filter((c) => c.estado !== "aplicado");
  const cobrado = aplicados.reduce((s, c) => s + Number(c.monto || 0), 0);
  const pendienteConciliar = pendientes.reduce((s, c) => s + Number(c.monto || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const vencidas = cobrar.filter((f) => saldoDe(f) > 0 && f.fecha_vto && f.fecha_vto < today).length;
  const denom = cobrado + cartera;
  return {
    facturas_pagar: pagar.length,
    facturas_cobrar: cobrar.length,
    cartera_abierta: cartera,
    cobrado,
    pendiente_conciliar: pendienteConciliar,
    vencidas,
    eficiencia: denom > 0 ? Math.round((cobrado / denom) * 100) : 0,
    cobradas: cobrar.filter((f) => estadoCobrar(f) === "saldada").length,
    cobros_pendientes: pendientes.length,
    cobros_aplicados: aplicados.length,
  };
}

export async function ingestarFacturaSistema(body = {}) {
  await ensureFinanzasDemo();
  const numero = String(body.numero || "").trim();
  if (!numero) throw new Error("Falta numero");
  const dup = await findFacturaCobrarDuplicada({ numero });
  if (dup) throw new Error(`Ya existe la factura a cobrar ${dup.numero} (${dup.id})`);
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido");
  const row = {
    id: finanzasFacturaId(),
    tipo: "cobrar",
    origen: "sistema",
    estado: "abierta",
    tipo_comprobante: body.tipo_comprobante || "A",
    punto_venta: body.punto_venta || null,
    numero,
    fecha: body.fecha || null,
    fecha_vto: body.fecha_vto || null,
    cuit_emisor: body.cuit || body.cuit_emisor || null,
    razon_social: body.razon_social || body.cliente || null,
    cuit_receptor: body.cuit_receptor || null,
    telefono: body.telefono || null,
    email: body.email || null,
    monto,
    monto_aplicado: 0,
    moneda: body.moneda || "ARS",
    cae: body.cae || null,
    confianza: 1,
    pasos: [paso("facturas", "Emitida por sistema")],
  };
  return insertFactura(row);
}

function matchFacturaParaCobro(facturas, body) {
  const nro = String(body.numero_factura || body.numero || "").replace(/\s/g, "").toLowerCase();
  if (nro) {
    const byNro = facturas.find(
      (f) => String(f.numero || "").replace(/\s/g, "").toLowerCase() === nro,
    );
    if (byNro) return byNro;
  }
  const cuit = String(body.cuit || "").replace(/\D/g, "");
  const monto = Number(body.monto);
  if (cuit && Number.isFinite(monto)) {
    const hits = facturas.filter(
      (f) => String(f.cuit_emisor || "").replace(/\D/g, "") === cuit && Math.abs(saldoDe(f) - monto) < 0.5,
    );
    if (hits.length === 1) return hits[0];
  }
  return null;
}

export async function registrarCobroPasarela(body = {}, { log } = {}) {
  await ensureFinanzasDemo();
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido");
  const external = String(body.external_ref || body.id || "").trim() || `pasarela-${Date.now()}`;
  const existing = await findCobroByExternalRef(external);
  if (existing) return existing;

  const cobrar = (await listFacturas({ tipo: "cobrar", limit: 500 })).filter((f) => saldoDe(f) > 0);
  const match = matchFacturaParaCobro(cobrar, body);
  const cobro = await insertCobro({
    id: finanzasCobroId(),
    origen: "pasarela",
    estado: match ? "aplicado" : "pendiente",
    monto,
    moneda: body.moneda || "ARS",
    external_ref: external,
    cuit: body.cuit || null,
    factura_id: match?.id || null,
    factura_numero: match?.numero || body.numero_factura || null,
    settled_at: body.settled_at || new Date().toISOString(),
    metadata: body.metadata || null,
  });

  if (match) {
    await aplicarCobroAFactura(cobro.id, match.id, { log, yaInsertado: cobro });
    return getCobro(cobro.id);
  }
  return cobro;
}

async function aplicarCobroAFactura(cobroId, facturaId, { yaInsertado } = {}) {
  const cobro = yaInsertado || (await getCobro(cobroId));
  const fac = await getFacturaInterna(facturaId);
  if (!cobro) throw new Error("Cobro no encontrado");
  if (!fac || fac.tipo !== "cobrar") throw new Error("La conciliación solo aplica a facturas a cobrar");
  if (cobro.estado === "aplicado" && cobro.factura_id && cobro.factura_id !== facturaId) {
    throw new Error("Ese cobro ya está imputado a otra factura");
  }

  const aplicado = Number(fac.monto_aplicado || 0) + Number(cobro.monto || 0);
  const next = { monto_aplicado: aplicado };
  next.estado = estadoCobrar({ ...fac, monto_aplicado: aplicado });
  const label =
    next.estado === "saldada"
      ? `Cobro ${money(cobro.monto)} conciliado — factura saldada`
      : `Cobro ${money(cobro.monto)} imputado (parcial)`;
  next.pasos = [...(fac.pasos || []), paso("conciliacion", label, { cobro_id: cobro.id })];
  await updateFactura(facturaId, next);
  return updateCobro(cobroId, {
    estado: "aplicado",
    factura_id: facturaId,
    factura_numero: fac.numero,
  });
}

export async function conciliarCobro(cobroId, facturaId) {
  await ensureFinanzasDemo();
  return aplicarCobroAFactura(cobroId, facturaId);
}

export async function listarCobrosFinanzas(query) {
  await ensureFinanzasDemo();
  return listCobros(query);
}

function mensajeDefault(fac) {
  const vto = fac.fecha_vto || "sin vencimiento";
  return (
    `Hola ${fac.razon_social || ""}, te escribo de SOL por la factura ${fac.numero}. ` +
    `Saldo ${money(saldoDe(fac))}, vencimiento ${vto}. ¿Me confirmás el pago o una fecha?`
  );
}

export async function comunicarFactura(id, { canal = "whatsapp", mensaje } = {}) {
  await ensureFinanzasDemo();
  const fac = await getFacturaInterna(id);
  if (!fac || fac.tipo !== "cobrar") throw new Error("Solo se contacta sobre facturas a cobrar");
  if (estadoCobrar(fac) === "saldada") throw new Error("Esa factura ya está saldada");
  const text = String(mensaje || "").trim() || mensajeDefault(fac);
  const ch = canal === "email" ? "email" : "whatsapp";
  let envio = { ok: false };

  if (ch === "whatsapp") {
    const phone = String(fac.telefono || "").replace(/\D/g, "");
    if (phone.length < 9) {
      envio = { ok: false, canal: "whatsapp", error: "sin teléfono de cliente" };
    } else {
      try {
        await sendWhatsAppMessage({ number: phone, message: text });
        envio = { ok: true, canal: "whatsapp", telefono: phone };
      } catch (err) {
        envio = { ok: false, canal: "whatsapp", error: err.message };
      }
    }
  } else {
    envio = { ok: false, canal: "email", error: "Email todavía no está conectado" };
  }

  const label = envio.ok
    ? `Contacto por ${ch}: ${text.slice(0, 80)}`
    : `Intento de contacto por ${ch} (no salió): ${envio.error || "error"}`;
  const row = await appendPasoFactura(id, paso("comunicacion", label, { canal: ch, ok: envio.ok }));
  return { factura: row, envio, mensaje: text };
}
