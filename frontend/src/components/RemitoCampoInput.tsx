"use client";

import clsx from "clsx";
import type { RemitoMaestros } from "@/hooks/useRemitoMaestros";
import { maestroTipoCampo } from "@/lib/remito-maestros";
import type { Localidad } from "@/lib/parametros-types";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function filtrarLocalidades(localidades: Localidad[], modo: "origen" | "destino") {
  return localidades.filter((l) => {
    if (modo === "origen") return l.tipo === "origen" || l.tipo === "ambos";
    return l.tipo === "destino" || l.tipo === "ambos";
  });
}

function opcionExtra(value: string, options: { value: string; label: string }[]) {
  const v = value.trim();
  if (!v) return null;
  if (options.some((o) => o.value === v)) return null;
  return { value: v, label: `${v} (valor actual)` };
}

export function RemitoCampoInput({
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

  let options: { value: string; label: string }[] = [];

  if (tipo === "chofer") {
    options = maestros.choferes.map((c) => ({ value: c.nombre, label: c.nombre }));
  } else if (tipo === "tractor") {
    options = maestros.tractores.map((u) => ({
      value: u.patente,
      label: u.unidad_interna ? `${u.patente} · ${u.unidad_interna}` : u.patente,
    }));
  } else if (tipo === "acoplado") {
    options = maestros.semis.map((u) => ({
      value: u.patente,
      label: u.unidad_interna ? `${u.patente} · ${u.unidad_interna}` : u.patente,
    }));
  } else if (tipo === "origen" || tipo === "destino") {
    options = filtrarLocalidades(maestros.localidades, tipo).map((l) => ({
      value: l.nombre,
      label: l.codigo ? `${l.nombre} (${l.codigo})` : l.nombre,
    }));
  }

  const extra = opcionExtra(value, options);

  return (
    <select
      className={clsx(inputCls, className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Seleccionar —</option>
      {extra && <option value={extra.value}>{extra.label}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
