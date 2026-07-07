"use client";

import { useEffect, useState } from "react";
import { listChoferes, listLocalidades, listUnidades } from "@/lib/api";
import type { Chofer, Localidad, Unidad } from "@/lib/parametros-types";
import type { Tenant } from "@/lib/types";
import { getMaestrosCache, setMaestrosCache } from "./maestros-cache";

export type RemitoMaestros = {
  loading: boolean;
  error: string | null;
  choferes: Chofer[];
  tractores: Unidad[];
  semis: Unidad[];
  localidades: Localidad[];
};

const empty: RemitoMaestros = {
  loading: true,
  error: null,
  choferes: [],
  tractores: [],
  semis: [],
  localidades: [],
};

function sortMaestros(
  choferes: Chofer[],
  tractores: Unidad[],
  semis: Unidad[],
  localidades: Localidad[],
): RemitoMaestros {
  const activo = <T extends { activo?: boolean }>(rows: T[]) => rows.filter((r) => r.activo !== false);
  return {
    loading: false,
    error: null,
    choferes: activo(choferes).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    tractores: activo(tractores).sort((a, b) => a.patente.localeCompare(b.patente, "es")),
    semis: activo(semis).sort((a, b) => a.patente.localeCompare(b.patente, "es")),
    localidades: activo(localidades).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

export function useRemitoMaestros(tenant: Tenant | string) {
  const cached = getMaestrosCache(tenant);
  const [data, setData] = useState<RemitoMaestros>(() =>
    cached && !cached.loading ? cached : empty,
  );

  useEffect(() => {
    const hit = getMaestrosCache(tenant);
    if (hit && !hit.loading && !hit.error) {
      setData(hit);
      return;
    }

    let cancelled = false;
    setData((d) => ({ ...d, loading: true, error: null }));

    Promise.all([
      listChoferes(tenant),
      listUnidades(tenant, "tractor"),
      listUnidades(tenant, "acoplado"),
      listLocalidades(tenant),
    ])
      .then(([choferes, tractores, semis, localidades]) => {
        if (cancelled) return;
        const next = sortMaestros(choferes, tractores, semis, localidades);
        setMaestrosCache(tenant, next);
        setData(next);
      })
      .catch((err) => {
        if (cancelled) return;
        const failed: RemitoMaestros = {
          ...empty,
          loading: false,
          error: err instanceof Error ? err.message : "Error al cargar parámetros",
        };
        setData(failed);
      });

    return () => {
      cancelled = true;
    };
  }, [tenant]);

  return data;
}
