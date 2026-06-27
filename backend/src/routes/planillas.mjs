import * as XLSX from "xlsx";
import { buildPlanillaTsb, filasAoa } from "../../../lib/planilla-tsb.mjs";

export default async function planillasRoutes(fastify) {
  fastify.get("/tsb", async (request) => {
    const q = request.query ?? {};
    return buildPlanillaTsb({
      tipoViaje: q.tipoViaje || "ARENA",
      producto: q.producto || "Sin Definir",
      estados: q.estados || "confirmado,pendiente_revision",
      desde: q.desde || undefined,
      hasta: q.hasta || undefined,
      limit: q.limit ? parseInt(q.limit, 10) : 200,
    });
  });

  fastify.get("/tsb/export", async (request, reply) => {
    const q = request.query ?? {};
    const sheetName = q.formato === "proforma" ? "Proforma" : "Planilla TSB";
    const data = await buildPlanillaTsb({
      tipoViaje: q.tipoViaje || "ARENA",
      producto: q.producto || "Sin Definir",
      estados: q.estados || "confirmado,pendiente_revision",
      desde: q.desde || undefined,
      hasta: q.hasta || undefined,
      limit: q.limit ? parseInt(q.limit, 10) : 200,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(filasAoa(data.filas));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fname =
      q.formato === "proforma"
        ? `Proforma_TSB_${data.tipo_viaje}_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Planilla_TSB_${data.tipo_viaje}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fname}"`)
      .send(buf);
  });
}
