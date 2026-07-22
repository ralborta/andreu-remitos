import * as XLSX from "xlsx";
import { buildPlanillaTsb, filasAoa } from "../../../lib/planilla-tsb.mjs";
import { buildPlanillaBeraldi } from "../../../lib/planilla-beraldi.mjs";
import { buildPlanillaCorina, columnasCorina } from "../../../lib/planilla-corina.mjs";

function parseQuery(q) {
  return {
    formato: q.formato === "proforma" ? "proforma" : "delfos",
    tipoViaje: q.tipoViaje || "ARENA",
    producto: q.producto || "Sin Definir",
    estados: q.estados || "confirmado,pendiente_revision",
    desde: q.desde || undefined,
    hasta: q.hasta || undefined,
    limit: q.limit ? parseInt(q.limit, 10) : 5000,
  };
}

async function exportPlanilla(reply, data, { formato, label }) {
  const wb = XLSX.utils.book_new();

  if (formato === "proforma" && data.hojas) {
    const wsDiaria = XLSX.utils.aoa_to_sheet(
      filasAoa(data.hojas.diaria.filas, data.hojas.diaria.columnas),
    );
    const wsProforma = XLSX.utils.aoa_to_sheet(
      filasAoa(data.hojas.proforma.filas, data.hojas.proforma.columnas),
    );
    XLSX.utils.book_append_sheet(wb, wsDiaria, "Planilla Diaria");
    XLSX.utils.book_append_sheet(wb, wsProforma, "Proforma");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fname = `Proforma_${label}_${data.tipo_viaje}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fname}"`)
      .send(buf);
  }

  const sheetName = formato === "proforma" ? "Proforma" : `Planilla ${label}`;
  const ws = XLSX.utils.aoa_to_sheet(filasAoa(data.filas, data.columnas));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const prefix = formato === "proforma" ? "Proforma" : "Planilla";
  const fname = `${prefix}_${label}_${data.tipo_viaje}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("Content-Disposition", `attachment; filename="${fname}"`)
    .send(buf);
}

function parseQueryCorina(q) {
  const fmt = q.formato === "importacion" || q.formato === "delfos" ? "importacion" : "local";
  return {
    formato: fmt,
    estados: q.estados || "confirmado,pendiente_revision",
    desde: q.desde || undefined,
    hasta: q.hasta || undefined,
    limit: q.limit ? parseInt(q.limit, 10) : 5000,
  };
}

export default async function planillasRoutes(fastify) {
  fastify.get("/tsb", async (request) => {
    return buildPlanillaTsb(parseQuery(request.query ?? {}));
  });

  fastify.get("/tsb/export", async (request, reply) => {
    const opts = parseQuery(request.query ?? {});
    const data = await buildPlanillaTsb(opts);
    return exportPlanilla(reply, data, { formato: opts.formato, label: "TSB" });
  });

  fastify.get("/beraldi", async (request) => {
    return buildPlanillaBeraldi(parseQuery(request.query ?? {}));
  });

  fastify.get("/beraldi/export", async (request, reply) => {
    const opts = parseQuery(request.query ?? {});
    const data = await buildPlanillaBeraldi(opts);
    return exportPlanilla(reply, data, { formato: opts.formato, label: "Beraldi" });
  });

  fastify.get("/corina", async (request) => {
    return buildPlanillaCorina(parseQueryCorina(request.query ?? {}));
  });

  fastify.get("/corina/export", async (request, reply) => {
    const opts = parseQueryCorina(request.query ?? {});
    const data = await buildPlanillaCorina(opts);
    const sheetName = opts.formato === "importacion" ? "Importacion Local" : "Planilla Local";
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(filasAoa(data.filas, columnasCorina(opts.formato)));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const prefix = opts.formato === "importacion" ? "Importacion" : "Planilla";
    const fname = `${prefix}_Corina_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fname}"`)
      .send(buf);
  });
}
