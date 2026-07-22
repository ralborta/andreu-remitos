import * as XLSX from "xlsx";
import { buildPlanillaTsb, filasAoa } from "../../../lib/planilla-tsb.mjs";
import { buildPlanillaBeraldi } from "../../../lib/planilla-beraldi.mjs";
import { buildPlanillaCorina, columnasCorina } from "../../../lib/planilla-corina.mjs";
import { apiClientHasScope } from "../../../lib/api-keys.mjs";

const BUILDERS = {
  tsb: buildPlanillaTsb,
  beraldi: buildPlanillaBeraldi,
  corina: buildPlanillaCorina,
};

function parseOpts(tenant, q = {}) {
  if (tenant === "corina") {
    const fmt = q.formato === "importacion" || q.formato === "delfos" ? "importacion" : "local";
    return {
      formato: fmt,
      estados: q.estados || "confirmado,pendiente_revision",
      desde: q.desde || undefined,
      hasta: q.hasta || undefined,
      limit: q.limit ? parseInt(q.limit, 10) : 5000,
    };
  }
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

function assertTenantAccess(request, reply, tenant) {
  const client = request.apiClient;
  if (!client) {
    reply.code(401).send({
      error: "api_key_requerida",
      message: "Enviá la API key en el header X-Api-Key",
    });
    return false;
  }
  if (!apiClientHasScope(client, "planillas:read")) {
    reply.code(403).send({
      error: "sin_permiso",
      message: "La API key no tiene scope planillas:read",
    });
    return false;
  }
  if (client.tenant !== tenant) {
    reply.code(403).send({
      error: "tenant_no_autorizado",
      message: `Esta API key solo puede leer el tenant "${client.tenant}"`,
      tenant_permitido: client.tenant,
    });
    return false;
  }
  return true;
}

async function buildForTenant(tenant, opts) {
  const builder = BUILDERS[tenant];
  if (!builder) {
    const err = new Error(`Tenant no soportado: ${tenant}`);
    err.statusCode = 404;
    throw err;
  }
  return builder(opts);
}

async function sendExcel(reply, tenant, data, opts) {
  const wb = XLSX.utils.book_new();
  const label = tenant.toUpperCase();

  if (tenant === "corina") {
    const sheetName = opts.formato === "importacion" ? "Importacion Local" : "Planilla Local";
    const ws = XLSX.utils.aoa_to_sheet(filasAoa(data.filas, columnasCorina(opts.formato)));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const prefix = opts.formato === "importacion" ? "Importacion" : "Planilla";
    const fname = `${prefix}_Corina_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${fname}"`)
      .send(buf);
  }

  if (opts.formato === "proforma" && data.hojas) {
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

  const ws = XLSX.utils.aoa_to_sheet(filasAoa(data.filas, data.columnas));
  XLSX.utils.book_append_sheet(wb, ws, `Planilla ${label}`.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fname = `Planilla_${label}_${data.tipo_viaje || "local"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("Content-Disposition", `attachment; filename="${fname}"`)
    .send(buf);
}

export default async function apiV1PlanillasRoutes(fastify) {
  fastify.get("/planillas", async (request, reply) => {
    const client = request.apiClient;
    if (!client) {
      return reply.code(401).send({
        error: "api_key_requerida",
        message: "Enviá la API key en el header X-Api-Key",
      });
    }
    if (!apiClientHasScope(client, "planillas:read")) {
      return reply.code(403).send({ error: "sin_permiso" });
    }
    const tenant = client.tenant;
    const opts = parseOpts(tenant, request.query ?? {});
    const data = await buildForTenant(tenant, opts);
    return {
      api_version: "v1",
      client: { id: client.id, name: client.name, tenant: client.tenant },
      ...data,
    };
  });

  // Registrar /export antes de /:tenant para no capturar "export" como tenant.
  fastify.get("/planillas/export", async (request, reply) => {
    const client = request.apiClient;
    if (!client) {
      return reply.code(401).send({
        error: "api_key_requerida",
        message: "Enviá la API key en el header X-Api-Key",
      });
    }
    if (!apiClientHasScope(client, "planillas:read")) {
      return reply.code(403).send({ error: "sin_permiso" });
    }
    const tenant = client.tenant;
    const opts = parseOpts(tenant, request.query ?? {});
    const data = await buildForTenant(tenant, opts);
    return sendExcel(reply, tenant, data, opts);
  });

  fastify.get("/planillas/:tenant/export", async (request, reply) => {
    const tenant = String(request.params.tenant || "").toLowerCase();
    if (!assertTenantAccess(request, reply, tenant)) return;
    const opts = parseOpts(tenant, request.query ?? {});
    const data = await buildForTenant(tenant, opts);
    return sendExcel(reply, tenant, data, opts);
  });

  fastify.get("/planillas/:tenant", async (request, reply) => {
    const tenant = String(request.params.tenant || "").toLowerCase();
    if (!assertTenantAccess(request, reply, tenant)) return;
    const opts = parseOpts(tenant, request.query ?? {});
    const data = await buildForTenant(tenant, opts);
    return {
      api_version: "v1",
      client: {
        id: request.apiClient.id,
        name: request.apiClient.name,
        tenant: request.apiClient.tenant,
      },
      ...data,
    };
  });
}
