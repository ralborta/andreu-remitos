/**
 * Pack Commander — joins determinísticos viaje ↔ otros dominios.
 * No interpreta lenguaje: solo matchea IDs/refs reales de stores.
 */
import * as viajesStore from "../../../db/viajes-store.mjs";
import * as incidenciasStore from "../../../db/incidencias-store.mjs";
import * as podStore from "../../../db/pod-store.mjs";
import { listarColaEta } from "../../eta-agent.mjs";
import { POD_ESTADOS_DIALOG } from "../../../../../lib/pod.mjs";
import { INCIDENCIA_TIPOS } from "../../../../../lib/incidencias.mjs";
import { registerCapability } from "../capability-registry.mjs";
import { TZ, todayKey, workingDomainIds } from "./_shared.mjs";

const ACTIVOS = new Set(["solicitado", "confirmado", "asignado", "en_curso"]);
const INC_ABIERTAS = new Set(["esperando_causa", "nueva", "en_gestion"]);
const POD_PENDIENTE = new Set(["pendiente", "esperando_receptor", "esperando_foto"]);

const REL = Object.freeze({
  incidencias: {
    field: "viaje_ref",
    available: true,
    description: "incidencia.viaje_ref ↔ viaje.codigo|id",
  },
  eta: {
    field: "viaje",
    available: true,
    description: "item cola ETA.viaje ↔ viaje.codigo|id (origen destino/incidencia)",
  },
  pod: {
    field: "viaje_ref",
    available: true,
    description: "pod.viaje_ref ↔ viaje.codigo|id",
  },
  remitos: {
    field: null,
    available: false,
    reason: "remitos_sin_viaje_ref_persistido",
    description: "file-store de remitos no guarda referencia verificable a viaje",
  },
});

function keysOfViaje(v) {
  return new Set([String(v.id), String(v.codigo || "")].filter(Boolean));
}

function matchRef(ref, viaje) {
  if (ref == null || ref === "" || ref === "—") return false;
  const n = String(ref);
  return keysOfViaje(viaje).has(n);
}

function compactViaje(v) {
  return {
    id: v.id,
    codigo: v.codigo || v.id,
    estado: v.estado,
    destino: v.destino || null,
    chofer: v.chofer || null,
  };
}

export function registerCommanderCapabilities() {
  registerCapability({
    name: "commander.relacionar_viajes",
    agentId: "commander",
    domain: "commander",
    description:
      "Join determinístico viaje↔incidencias|eta|pod|remitos por refs reales (viaje_ref/viaje). " +
      "Usar para 'qué viajes tienen incidencias/demora/POD', conteos por viaje, follow-ups cross-domain. " +
      "Si remitos u otra relación no existe en datos: relationAvailable=false (no inferir).",
    argsSchema: {
      type: "object",
      properties: {
        con: { type: "string", enum: ["incidencias", "eta", "pod", "remitos"] },
        activos: { type: "boolean" },
        viajeIds: { type: "array", items: { type: "string" } },
        viajeCodigos: { type: "array", items: { type: "string" } },
        workingSetOnly: { type: "boolean" },
        soloConRelacion: { type: "boolean" },
        incidenciaAbiertas: { type: "boolean" },
        incidenciaTipo: { type: "string", enum: [...INCIDENCIA_TIPOS] },
        podPendiente: { type: "boolean" },
        soloDemorasEta: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["con"],
      additionalProperties: false,
    },
    resultSchema: { type: "object" },
    requiredPermissions: ["desk:read"],
    timeoutMs: 12000,
    readOnly: true,
    async execute(args, ctx) {
      const con = args.con;
      const meta = REL[con];
      const limit = args.limit ?? 30;
      const today = todayKey();

      if (!meta?.available) {
        return {
          today,
          timezone: TZ,
          asOf: new Date().toISOString(),
          con,
          relationAvailable: false,
          relationField: null,
          reason: meta?.reason || "relacion_no_disponible",
          description: meta?.description || null,
          pairs: [],
          viajesSinRelacion: [],
          relatedOrphans: 0,
          entityType: "viajes",
          entityIds: [],
          relations: [],
          dataSource: "real",
          groundedNote:
            "No hay referencia verificable en los stores para relacionar viaje↔" +
            con +
            ". No se puede afirmar vínculo.",
        };
      }

      let viajes = (await viajesStore.listViajes({ limit: 500 })).map((r) => ({
        id: r.id,
        codigo: r.codigo || r.id,
        estado: r.estado,
        destino: r.destino || null,
        chofer: r.chofer || null,
      }));

      if (args.workingSetOnly) {
        const ids = new Set([
          ...workingDomainIds(ctx, "viajes"),
          ...workingDomainIds(ctx, "commander"),
        ]);
        if (ids.size) {
          viajes = viajes.filter((v) => ids.has(v.id) || ids.has(v.codigo));
        }
      }
      if (Array.isArray(args.viajeIds) && args.viajeIds.length) {
        const want = new Set(args.viajeIds.map(String));
        viajes = viajes.filter((v) => want.has(v.id) || want.has(v.codigo));
      }
      if (Array.isArray(args.viajeCodigos) && args.viajeCodigos.length) {
        const want = new Set(args.viajeCodigos.map(String));
        viajes = viajes.filter((v) => want.has(v.codigo) || want.has(v.id));
      }
      if (args.activos === true) viajes = viajes.filter((v) => ACTIVOS.has(v.estado));

      let related = [];
      if (con === "incidencias") {
        related = (await incidenciasStore.listIncidencias({ limit: 400 })).map((r) => ({
          id: r.id,
          codigo: r.codigo || r.id,
          estado: r.estado,
          tipo: r.tipo || null,
          viajeRef: r.viaje_ref || null,
          causa: r.causa || null,
        }));
        if (args.incidenciaAbiertas === true) {
          related = related.filter((r) => INC_ABIERTAS.has(r.estado));
        }
        if (args.incidenciaTipo) {
          related = related.filter((r) => r.tipo === args.incidenciaTipo);
        }
      } else if (con === "eta") {
        related = (await listarColaEta({ limit: 200 })).map((r) => ({
          id: r.id,
          codigo: r.codigoIncidencia || r.id,
          estado: r.estado,
          tipo: r.fuente === "incidencia" ? "demora" : r.fuente,
          viajeRef: r.viaje && r.viaje !== "—" ? r.viaje : null,
          causa: r.causa || null,
          etaMinutos: r.etaMinutos ?? null,
          fuente: r.fuente,
        }));
        if (args.soloDemorasEta === true) {
          related = related.filter((r) => r.fuente === "incidencia");
        }
      } else if (con === "pod") {
        related = (await podStore.listPods({ limit: 300 })).map((r) => ({
          id: r.id,
          codigo: r.codigo || r.id,
          estado: r.estado,
          tipo: null,
          viajeRef: r.viaje_ref || null,
          causa: null,
        }));
        if (args.podPendiente === true) {
          related = related.filter(
            (r) => POD_PENDIENTE.has(r.estado) || POD_ESTADOS_DIALOG.has(r.estado),
          );
        }
      }

      const orphans = related.filter((r) => !r.viajeRef).length;
      const pairs = [];
      const sinRelacion = [];

      for (const v of viajes) {
        const linked = related.filter((r) => matchRef(r.viajeRef, v));
        if (!linked.length) {
          sinRelacion.push({
            viajeId: v.id,
            viajeCodigo: v.codigo,
            reason: "sin_referencia_verificable",
          });
          if (args.soloConRelacion === true) continue;
          pairs.push({
            viaje: compactViaje(v),
            relatedCount: 0,
            relatedIds: [],
            related: [],
            verified: true,
            hasRelation: false,
          });
          continue;
        }
        const slice = linked.slice(0, 20);
        pairs.push({
          viaje: compactViaje(v),
          relatedCount: linked.length,
          relatedIds: slice.map((x) => x.id),
          related: slice.map((x) => ({
            id: x.id,
            codigo: x.codigo,
            estado: x.estado,
            tipo: x.tipo,
            causa: x.causa,
            etaMinutos: x.etaMinutos ?? null,
          })),
          verified: true,
          hasRelation: true,
        });
      }

      let outPairs = pairs;
      if (args.soloConRelacion === true) {
        outPairs = pairs.filter((p) => p.hasRelation);
      }
      outPairs = outPairs.slice(0, limit);

      const entityIds = outPairs.map((p) => p.viaje.id);
      const relations = outPairs
        .filter((p) => p.hasRelation)
        .map((p) => ({
          fromDomain: "viajes",
          toDomain: con,
          field: meta.field,
          fromId: p.viaje.id,
          fromCodigo: p.viaje.codigo,
          toIds: p.relatedIds,
          relatedCount: p.relatedCount,
          verified: true,
        }));

      return {
        today,
        timezone: TZ,
        asOf: new Date().toISOString(),
        con,
        relationAvailable: true,
        relationField: meta.field,
        description: meta.description,
        filters: {
          activos: args.activos === true,
          soloConRelacion: args.soloConRelacion === true,
          incidenciaAbiertas: args.incidenciaAbiertas === true,
          incidenciaTipo: args.incidenciaTipo || null,
          podPendiente: args.podPendiente === true,
          soloDemorasEta: args.soloDemorasEta === true,
          workingSetOnly: args.workingSetOnly === true,
          limit,
        },
        pairs: outPairs,
        viajesSinRelacion: sinRelacion.slice(0, 40),
        relatedOrphans: orphans,
        entityType: "viajes",
        entityIds,
        relations,
        dataSource: "real",
        groundedNote:
          "Relaciones calculadas solo por igualdad de refs en store. Sin match ⇒ no hay vínculo verificable.",
      };
    },
  });
}
