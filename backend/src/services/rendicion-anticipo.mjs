/**
 * Conciliación anticipo (hoja de ruta) vs gastos rendidos, por Nº viaje Delfos.
 */
import * as hojaStore from "../db/hoja-ruta-store.mjs";
import * as rendicionStore from "../db/rendicion-store.mjs";
import { moneyAR } from "../../../lib/rendicion.mjs";

function normViaje(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function sumMonto(rows) {
  return rows.reduce((a, r) => a + (Number(r.monto) || 0), 0);
}

/**
 * @returns {Promise<object[]>}
 */
export async function resumenAnticipoPorViaje({ limit = 100 } = {}) {
  const hojas = await hojaStore.listHojasRuta({ limit: 500 });
  const gastos = await rendicionStore.listGastos({ limit: 5000 });

  const viajes = new Set();
  for (const h of hojas) {
    const v = normViaje(h.nro_viaje_delfos);
    if (v) viajes.add(v);
  }
  for (const g of gastos) {
    const v = normViaje(g.nro_viaje_delfos);
    if (v) viajes.add(v);
  }

  const out = [];
  for (const viaje of viajes) {
    // hojas newest-first
    const hojasViaje = hojas.filter((h) => normViaje(h.nro_viaje_delfos) === viaje);
    const top = hojasViaje[0] || null;
    const delViaje = gastos.filter((g) => normViaje(g.nro_viaje_delfos) === viaje);
    const pendientes = delViaje.filter((g) => g.estado === "pendiente_aprobacion");
    const aprobados = delViaje.filter((g) => g.estado === "aprobado");
    const rechazados = delViaje.filter((g) => g.estado === "rechazado");

    const anticipo =
      top?.anticipo_monto != null && Number.isFinite(Number(top.anticipo_monto))
        ? Number(top.anticipo_monto)
        : 0;
    const montoPendiente = sumMonto(pendientes);
    const montoAprobado = sumMonto(aprobados);
    const montoRendido = montoPendiente + montoAprobado;
    const saldoVsAprobado = anticipo - montoAprobado;
    const saldoVsRendido = anticipo - montoRendido;

    const chofer =
      top?.chofer_nombre ||
      delViaje.find((g) => g.chofer_nombre)?.chofer_nombre ||
      null;
    const telefono =
      top?.telefono || delViaje.find((g) => g.telefono)?.telefono || null;

    out.push({
      nroViajeDelfos: viaje,
      choferNombre: chofer,
      telefono,
      patente: top?.patente || null,
      hojaId: top?.id || null,
      hojaCodigo: top?.codigo || null,
      anticipoMonto: anticipo,
      anticipoLabel: moneyAR(anticipo),
      cantidadGastos: delViaje.length,
      cantidadPendientes: pendientes.length,
      cantidadAprobados: aprobados.length,
      cantidadRechazados: rechazados.length,
      montoPendiente,
      montoPendienteLabel: moneyAR(montoPendiente),
      montoAprobado,
      montoAprobadoLabel: moneyAR(montoAprobado),
      montoRendido,
      montoRendidoLabel: moneyAR(montoRendido),
      saldoVsAprobado,
      saldoVsAprobadoLabel: moneyAR(saldoVsAprobado),
      saldoVsRendido,
      saldoVsRendidoLabel: moneyAR(saldoVsRendido),
    });
  }

  out.sort((a, b) => String(b.nroViajeDelfos).localeCompare(String(a.nroViajeDelfos)));
  return out.slice(0, limit);
}
