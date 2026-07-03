"use client";

import { useEffect, useState } from "react";
import { listChoferes, listLocalidades, listUnidades } from "@/lib/api";
import type { Chofer, Localidad, Unidad } from "@/lib/parametros-types";
import type { Tenant } from "@/lib/types";

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

export function useRemitoMaestros(tenant: Tenant | string) {
  const [data, setData] = useState<RemitoMaestros>(empty);

  useEffect(() => {
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
        const activo = <T extends { activo?: boolean }>(rows: T[]) =>
          rows.filter((r) => r.activo !== false);
        setData({
          loading: false,
          error: null,
          choferes: activo(choferes).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
          tractores: activo(tractores).sort((a, b) => a.patente.localeCompare(b.patente, "es")),
          semis: activo(semis).sort((a, b) => a.patente.localeCompare(b.patente, "es")),
          localidades: activo(localidades).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setData({
          ...empty,
          loading: false,
          error: err instanceof Error ? err.message : "Error al cargar parámetros",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tenant]);

  return data;
}
