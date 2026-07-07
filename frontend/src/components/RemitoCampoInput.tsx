"use client";

import { memo, useMemo } from "react";
import clsx from "clsx";
import type { RemitoMaestros } from "@/hooks/useRemitoMaestros";
import { maestroTipoCampo } from "@/lib/remito-maestros";
import type { Localidad } from "@/lib/parametros-types";
import { SearchableSelect } from "./SearchableSelect";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function filtrarLocalidades(localidades: Localidad[], modo: "origen" | "destino") {
  return localidades.filter((l) => {
    if (modo === "origen") return l.tipo === "origen" || l.tipo === "ambos";
    return l.tipo === "destino" || l.tipo === "ambos";
  });
}

function buildOptions(tipo: string, maestros: RemitoMaestros) {
  if (tipo === "chofer") {
    return {
      options: maestros.choferes.map((c) => ({
        value: c.nombre,
        label: c.telefono ? `${c.nombre} · ${c.telefono}` : c.nombre,
      })),
      placeholder: "Buscar chofer…",
    };
  }
  if (tipo === "tractor") {
    return {
      options: maestros.tractores.map((u) => ({
        value: u.patente,
        label: u.unidad_interna ? `${u.patente} · ${u.unidad_interna}` : u.patente,
      })),
      placeholder: "Buscar tractor / chasis…",
    };
  }
  if (tipo === "acoplado") {
    return {
      options: maestros.semis.map((u) => ({
        value: u.patente,
        label: u.unidad_interna ? `${u.patente} · ${u.unidad_interna}` : u.patente,
      })),
      placeholder: "Buscar semi / remolque…",
    };
  }
  if (tipo === "origen" || tipo === "destino") {
    return {
      options: filtrarLocalidades(maestros.localidades, tipo).map((l) => ({
        value: l.nombre,
        label: l.codigo ? `${l.nombre} (${l.codigo})` : l.nombre,
      })),
      placeholder: tipo === "origen" ? "Buscar origen…" : "Buscar destino…",
    };
  }
  return { options: [], placeholder: "Buscar…" };
}

export const RemitoCampoInput = memo(function RemitoCampoInput({
  campo,
  value,
  onChange,
  maestros,
  className,
}: {
  campo: string;
  value: string;
  onChange: (value: string) => void;
  maestros: RemitoMaestros;
  className?: string;
}) {
  const tipo = maestroTipoCampo(campo);
  const { options, placeholder } = useMemo(
    () => (tipo ? buildOptions(tipo, maestros) : { options: [], placeholder: "Buscar…" }),
    [tipo, maestros.choferes, maestros.tractores, maestros.semis, maestros.localidades],
  );

  if (!tipo) {
    return (
      <input
        className={clsx(inputCls, className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (maestros.loading) {
    return (
      <select className={clsx(inputCls, className, "opacity-60")} disabled>
        <option>Cargando…</option>
      </select>
    );
  }

  if (maestros.error) {
    return (
      <div>
        <input
          className={clsx(inputCls, className)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="mt-0.5 text-[10px] text-[var(--amber)]">Maestros: {maestros.error}</p>
      </div>
    );
  }

  return (
    <SearchableSelect
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
    />
  );
});
