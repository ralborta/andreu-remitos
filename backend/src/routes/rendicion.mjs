import * as XLSX from "xlsx";
import * as rendicionStore from "../db/rendicion-store.mjs";
import {
  GASTO_ESTADO_LABEL,
  GASTO_ESTADOS,
  labelCategoria,
  labelEstadoGasto,
  moneyAR,
  RENDICION_CATEGORIA_LABEL,
  RENDICION_CATEGORIAS,
} from "../../../lib/rendicion.mjs";
import {
  buildPlanillaRendicion,
  filasAoaRendicion,
} from "../../../lib/rendicion-export.mjs";
import { mensajeDecisionGasto } from "../../../lib/rendicion-wa.mjs";
import { getRendicionRules } from "../../../lib/rendicion-rules.mjs";
import { sugerirContextoViajeDesdeRemitos } from "../../../lib/rendicion-viaje-suggest.mjs";
import { sendWhatsAppMessage } from "../../../lib/builderbot-send.mjs";
import * as convStore from "../db/conversations-store.mjs";

function mapGasto(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    estado: row.estado,
    estadoLabel: labelEstadoGasto(row.estado),
    categoria: row.categoria,
    categoriaLabel: labelCategoria(row.categoria),
    monto: row.monto,
    montoLabel: row.monto != null ? moneyAR(row.monto) : "—",
    moneda: row.moneda,
    proveedor: row.proveedor,
    fechaComprobante: row.fecha_comprobante,
    descripcion: row.descripcion,
    viajeRef: row.viaje_ref,
    nroViajeDelfos: row.nro_viaje_delfos || null,
    viajeDocumento: row.viaje_documento || null,
    remitoRef: row.remito_ref || null,
    remitoId: row.remito_id || null,
    patente: row.patente || null,
    puntoVenta: row.punto_venta || null,
    nroT: row.nro_t || null,
    ivaPct: row.iva_pct ?? null,
    rae: Boolean(row.rae),
    montoRae: row.monto_rae ?? null,
    cuitProveedor: row.cuit_proveedor || null,
    telefono: row.telefono,
    choferNombre: row.chofer_nombre,
    imagenUrl: row.imagen_url,
    notaChofer: row.nota_chofer,
    textoOcr: row.texto_ocr || null,
    notaAprobacion: row.nota_aprobacion,
    aprobadoPor: row.aprobado_por,
    historial: row.historial ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function rendicionRoutes(fastify) {
  fastify.get("/meta", async () => {
    const rules = getRendicionRules();
    return {
      categorias: RENDICION_CATEGORIAS.map((c) => ({
        id: c,
        label: RENDICION_CATEGORIA_LABEL[c],
      })),
      estados: GASTO_ESTADOS.map((e) => ({ id: e, label: GASTO_ESTADO_LABEL[e] })),
      nota: "Gastos menores sujetos a verificación humana",
      rules: {
        productId: rules.productId,
        requireNroViajeDelfosOnApprove: rules.requireNroViajeDelfosOnApprove,
        suggestViajeFromRemitos: rules.suggestViajeFromRemitos,
        labelNroViaje: rules.labelNroViaje,
        hintNroViaje: rules.hintNroViaje,
      },
    };
  });

  fastify.get("/resumen", async () => rendicionStore.resumenGastos());

  fastify.get("/", async (request) => {
    const { limit, estado, telefono, q, desde, hasta } = request.query ?? {};
    const rows = await rendicionStore.listGastos({
      limit: limit ? parseInt(limit, 10) : 100,
      estado: estado || undefined,
      telefono: telefono || undefined,
      q: q || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    });
    return rows.map(mapGasto);
  });

  /** Export Excel — registrar antes de /:id */
  fastify.get("/export", async (request, reply) => {
    const q = request.query ?? {};
    const formato = q.formato === "erp" ? "erp" : "mesa";
    const rows = await rendicionStore.listGastos({
      limit: q.limit ? parseInt(q.limit, 10) : 5000,
      estado: q.estado || undefined,
      telefono: q.telefono || undefined,
      q: q.q || undefined,
      desde: q.desde || undefined,
      hasta: q.hasta || undefined,
    });
    const data = buildPlanillaRendicion(rows, { formato });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(filasAoaRendicion(data.filas, data.columnas));
    const sheetName = formato === "erp" ? "Rendicion_ERP" : "Rendiciones";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const day = new Date().toISOString().slice(0, 10);
    const tag = q.estado ? `_${q.estado}` : "_todos";
    const fname = `Rendiciones_${formato}${tag}_${day}.xlsx`;
    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .header("Content-Disposition", `attachment; filename="${fname}"`)
      .send(buf);
  });

  /**
   * Envío semi-fake al ERP (demo).
   * No llama a un ERP real: arma el payload, simula latencia y responde OK con job id.
   */
  fastify.post("/enviar-erp", async (request) => {
    const body = request.body ?? {};
    const estado = body.estado || "aprobado";
    const rows = await rendicionStore.listGastos({
      limit: body.limit ? parseInt(body.limit, 10) : 5000,
      estado,
      q: body.q || undefined,
      desde: body.desde || undefined,
      hasta: body.hasta || undefined,
    });
    const data = buildPlanillaRendicion(rows, { formato: "erp" });
    const jobId = `ERP-RND-${Date.now().toString(36).toUpperCase()}`;
    const montoTotal = rows.reduce((a, r) => a + (Number(r.monto) || 0), 0);
    // Simula “handshake” con el ERP
    await new Promise((r) => setTimeout(r, 650));
    return {
      ok: true,
      modo: "demo",
      mensaje:
        rows.length === 0
          ? "No hay gastos para enviar con ese filtro."
          : `Simulación OK: ${rows.length} gasto(s) listos para el ERP (no se envió a un sistema real).`,
      jobId,
      enviados: rows.length,
      montoTotal,
      endpointSimulado: "https://erp.demo.local/api/v1/gastos/import",
      preview: data.filas.slice(0, 5).map((f) => ({
        codigo: f.codigo,
        fecha: f.fecha_iso,
        chofer: f.chofer,
        categoria: f.categoria_id,
        monto: f.monto_num,
        estado: f.estado_id,
      })),
      generadoEn: new Date().toISOString(),
    };
  });

  /** Sugerencias desde remitos del chofer (ancla; nº Delfos se confirma aparte). */
  fastify.get("/sugerencias-viaje", async (request) => {
    const q = request.query ?? {};
    return sugerirContextoViajeDesdeRemitos({
      telefono: q.telefono,
      fechaComprobante: q.fecha || q.fecha_comprobante,
      limit: q.limit ? parseInt(q.limit, 10) : 12,
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const row = await rendicionStore.getGasto(request.params.id);
    if (!row) return reply.code(404).send({ error: "Gasto no encontrado" });
    return mapGasto(row);
  });

  fastify.post("/", async (request, reply) => {
    try {
      const row = await rendicionStore.crearGasto(request.body ?? {});
      return reply.code(201).send(mapGasto(row));
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });

  fastify.patch("/:id", async (request, reply) => {
    try {
      const body = request.body ?? {};
      const row = await rendicionStore.actualizarGasto(request.params.id, {
        ...body,
        historial_push: body.nro_viaje_delfos
          ? `${new Date().toISOString()} · Nº viaje Delfos → ${String(body.nro_viaje_delfos).trim()}`
          : undefined,
      });
      if (!row) return reply.code(404).send({ error: "Gasto no encontrado" });
      return mapGasto(row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });

  fastify.post("/:id/decidir", async (request, reply) => {
    const {
      estado,
      nota,
      aprobado_por,
      notificar = true,
      nro_viaje_delfos,
      remito_ref,
    } = request.body ?? {};
    try {
      const row = await rendicionStore.decidirGasto(request.params.id, {
        estado,
        nota,
        aprobado_por,
        nro_viaje_delfos,
        remito_ref,
      });
      if (!row) return reply.code(404).send({ error: "Gasto no encontrado" });

      if (notificar !== false && row.telefono) {
        const msg = mensajeDecisionGasto(row);
        if (msg) {
          await sendWhatsAppMessage({ number: row.telefono, message: msg }).catch(() => {});
          await convStore
            .appendMensaje(
              row.telefono,
              { texto: msg, tipo: "text", gasto_id: row.id },
              { dir: "out", from: "bot", agente: "rendicion" },
            )
            .catch(() => {});
        }
      }

      return mapGasto(row);
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
