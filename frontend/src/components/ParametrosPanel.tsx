"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Database, Plus, Trash2 } from "lucide-react";
import {
  createChofer,
  createDistancia,
  createLocalidad,
  createUnidad,
  deleteChofer,
  deleteDistancia,
  deleteLocalidad,
  deleteUnidad,
  listChoferes,
  listDistancias,
  listLocalidades,
  listUnidades,
} from "@/lib/api";
import type {
  Chofer,
  Distancia,
  Localidad,
  ParametroTab,
  TenantSlug,
  Unidad,
} from "@/lib/parametros-types";
import { tenantLabel } from "@/lib/remitos-ui";
import { Card, PageHeader, Pill, SectionTitle } from "./ui";
import { DataTable, type Column } from "./DataTable";

const TABS: { id: ParametroTab; label: string }[] = [
  { id: "choferes", label: "Choferes" },
  { id: "unidades", label: "Tractores y semis" },
  { id: "localidades", label: "Localidades" },
  { id: "distancias", label: "Distancias" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

export function ParametrosPanel() {
  const [tenant, setTenant] = useState<TenantSlug>("tsb");
  const [tab, setTab] = useState<ParametroTab>("choferes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [distancias, setDistancias] = useState<Distancia[]>([]);

  const [choferForm, setChoferForm] = useState({ nombre: "", telefono: "", documento: "" });
  const [unidadForm, setUnidadForm] = useState<{ tipo: "tractor" | "acoplado"; patente: string; unidad_interna: string }>({
    tipo: "tractor",
    patente: "",
    unidad_interna: "",
  });
  const [locForm, setLocForm] = useState<{ nombre: string; codigo: string; tipo: "origen" | "destino" | "ambos" }>({
    nombre: "",
    codigo: "",
    tipo: "ambos",
  });
  const [distForm, setDistForm] = useState({ origen_id: "", destino_id: "", km: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, u, l, d] = await Promise.all([
        listChoferes(tenant),
        listUnidades(tenant),
        listLocalidades(tenant),
        listDistancias(tenant),
      ]);
      setChoferes(c);
      setUnidades(u);
      setLocalidades(l);
      setDistancias(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAddChofer(e: React.FormEvent) {
    e.preventDefault();
    if (!choferForm.nombre.trim()) return;
    try {
      await createChofer({
        tenant,
        nombre: choferForm.nombre.trim(),
        telefono: choferForm.telefono.trim() || null,
        documento: choferForm.documento.trim() || null,
        activo: true,
      });
      setChoferForm({ nombre: "", telefono: "", documento: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function onAddUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadForm.patente.trim()) return;
    await createUnidad({
      tenant,
      tipo: unidadForm.tipo,
      patente: unidadForm.patente.trim(),
      unidad_interna: unidadForm.unidad_interna.trim() || null,
      activo: true,
    });
    setUnidadForm({ tipo: "tractor", patente: "", unidad_interna: "" });
    load();
  }

  async function onAddLocalidad(e: React.FormEvent) {
    e.preventDefault();
    if (!locForm.nombre.trim()) return;
    await createLocalidad({
      tenant,
      nombre: locForm.nombre.trim(),
      codigo: locForm.codigo.trim() || null,
      tipo: locForm.tipo,
      activo: true,
    });
    setLocForm({ nombre: "", codigo: "", tipo: "ambos" });
    load();
  }

  async function onAddDistancia(e: React.FormEvent) {
    e.preventDefault();
    if (!distForm.origen_id || !distForm.destino_id || !distForm.km) return;
    await createDistancia({
      tenant,
      origen_id: distForm.origen_id,
      destino_id: distForm.destino_id,
      km: Number(distForm.km),
      activo: true,
    });
    setDistForm({ origen_id: "", destino_id: "", km: "" });
    load();
  }

  const choferCols: Column<Chofer>[] = [
    { key: "nombre", header: "Nombre", render: (r) => <span className="font-medium text-white">{r.nombre}</span> },
    { key: "telefono", header: "Teléfono", className: "text-[var(--text-dim)] tabular-nums", render: (r) => r.telefono || "—" },
    { key: "documento", header: "DNI", className: "text-[var(--text-dim)]", render: (r) => r.documento || "—" },
    {
      key: "del",
      header: "",
      render: (r) => (
        <button type="button" onClick={() => deleteChofer(r.id).then(load)} className="text-[var(--text-faint)] hover:text-[var(--red)]">
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const unidadCols: Column<Unidad>[] = [
    {
      key: "tipo",
      header: "Tipo",
      render: (r) => (
        <Pill color={r.tipo === "tractor" ? "#38bdf8" : "#a78bfa"}>{r.tipo === "tractor" ? "Tractor" : "Semi"}</Pill>
      ),
    },
    { key: "patente", header: "Patente", render: (r) => <span className="font-medium text-white tabular-nums">{r.patente}</span> },
    { key: "unidad", header: "Nro interno", className: "text-[var(--text-dim)]", render: (r) => r.unidad_interna || "—" },
    {
      key: "del",
      header: "",
      render: (r) => (
        <button type="button" onClick={() => deleteUnidad(r.id).then(load)} className="text-[var(--text-faint)] hover:text-[var(--red)]">
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const locCols: Column<Localidad>[] = [
    { key: "nombre", header: "Nombre", render: (r) => <span className="font-medium text-white">{r.nombre}</span> },
    { key: "codigo", header: "Código", className: "text-[var(--text-dim)]", render: (r) => r.codigo || "—" },
    { key: "tipo", header: "Tipo", className: "text-[var(--text-dim)] capitalize", render: (r) => r.tipo },
    {
      key: "del",
      header: "",
      render: (r) => (
        <button type="button" onClick={() => deleteLocalidad(r.id).then(load)} className="text-[var(--text-faint)] hover:text-[var(--red)]">
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  const distCols: Column<Distancia>[] = [
    { key: "origen", header: "Origen", render: (r) => r.origen_nombre || "—" },
    { key: "destino", header: "Destino", render: (r) => r.destino_nombre || "—" },
    { key: "km", header: "Km", className: "tabular-nums text-white font-medium", render: (r) => r.km },
    {
      key: "del",
      header: "",
      render: (r) => (
        <button type="button" onClick={() => deleteDistancia(r.id).then(load)} className="text-[var(--text-faint)] hover:text-[var(--red)]">
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parámetros maestros"
        subtitle="Choferes, patentes, localidades y distancias — como el CRM viejo, por cliente TSB / Beraldi"
        icon={<Database size={24} />}
      />

      <div className="flex flex-wrap gap-2">
        {(["tsb", "beraldi"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTenant(t)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              tenant === t ? "bg-[var(--violet)] text-white" : "bg-white/5 text-[var(--text-dim)] hover:text-white",
            )}
          >
            {tenantLabel(t)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "rounded-t-lg px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-inset ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      {tab === "choferes" && (
        <Card>
          <SectionTitle>Choferes · {tenantLabel(tenant)}</SectionTitle>
          <form onSubmit={onAddChofer} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input className={inputCls} placeholder="Nombre completo" value={choferForm.nombre} onChange={(e) => setChoferForm((f) => ({ ...f, nombre: e.target.value }))} required />
            <input className={inputCls} placeholder="Teléfono WhatsApp" value={choferForm.telefono} onChange={(e) => setChoferForm((f) => ({ ...f, telefono: e.target.value }))} />
            <input className={inputCls} placeholder="DNI (opcional)" value={choferForm.documento} onChange={(e) => setChoferForm((f) => ({ ...f, documento: e.target.value }))} />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Agregar
            </button>
          </form>
          {loading ? <p className="text-sm text-[var(--text-dim)]">Cargando…</p> : <DataTable columns={choferCols} rows={choferes} minWidth={640} />}
          {!loading && choferes.length === 0 && (
            <p className="mt-2 text-sm text-[var(--text-dim)]">Sin choferes. El teléfono vincula WhatsApp al chofer al mandar remitos.</p>
          )}
        </Card>
      )}

      {tab === "unidades" && (
        <Card>
          <SectionTitle>Tractores y semis · {tenantLabel(tenant)}</SectionTitle>
          <form onSubmit={onAddUnidad} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select className={inputCls} value={unidadForm.tipo} onChange={(e) => setUnidadForm((f) => ({ ...f, tipo: e.target.value as "tractor" | "acoplado" }))}>
              <option value="tractor">Tractor / chasis</option>
              <option value="acoplado">Semi / acoplado</option>
            </select>
            <input className={inputCls} placeholder="Patente AH 860 KF" value={unidadForm.patente} onChange={(e) => setUnidadForm((f) => ({ ...f, patente: e.target.value }))} required />
            <input className={inputCls} placeholder="Nro interno (opcional)" value={unidadForm.unidad_interna} onChange={(e) => setUnidadForm((f) => ({ ...f, unidad_interna: e.target.value }))} />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Agregar
            </button>
          </form>
          {loading ? <p className="text-sm text-[var(--text-dim)]">Cargando…</p> : <DataTable columns={unidadCols} rows={unidades} minWidth={520} />}
        </Card>
      )}

      {tab === "localidades" && (
        <Card>
          <SectionTitle>Localidades · {tenantLabel(tenant)}</SectionTitle>
          <form onSubmit={onAddLocalidad} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input className={inputCls} placeholder="Nombre (ej. Cimsa, La Plata)" value={locForm.nombre} onChange={(e) => setLocForm((f) => ({ ...f, nombre: e.target.value }))} required />
            <input className={inputCls} placeholder="Código locación" value={locForm.codigo} onChange={(e) => setLocForm((f) => ({ ...f, codigo: e.target.value }))} />
            <select className={inputCls} value={locForm.tipo} onChange={(e) => setLocForm((f) => ({ ...f, tipo: e.target.value as typeof locForm.tipo }))}>
              <option value="ambos">Origen y destino</option>
              <option value="origen">Solo origen</option>
              <option value="destino">Solo destino</option>
            </select>
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Agregar
            </button>
          </form>
          {loading ? <p className="text-sm text-[var(--text-dim)]">Cargando…</p> : <DataTable columns={locCols} rows={localidades} minWidth={520} />}
        </Card>
      )}

      {tab === "distancias" && (
        <Card>
          <SectionTitle>Distancias · {tenantLabel(tenant)}</SectionTitle>
          <p className="mb-3 text-xs text-[var(--text-dim)]">Primero cargá localidades. Usado para validar km en Beraldi.</p>
          <form onSubmit={onAddDistancia} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select className={inputCls} value={distForm.origen_id} onChange={(e) => setDistForm((f) => ({ ...f, origen_id: e.target.value }))} required>
              <option value="">Origen…</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
            <select className={inputCls} value={distForm.destino_id} onChange={(e) => setDistForm((f) => ({ ...f, destino_id: e.target.value }))} required>
              <option value="">Destino…</option>
              {localidades.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
            <input className={inputCls} type="number" min={0} placeholder="Km" value={distForm.km} onChange={(e) => setDistForm((f) => ({ ...f, km: e.target.value }))} required />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Agregar
            </button>
          </form>
          {loading ? <p className="text-sm text-[var(--text-dim)]">Cargando…</p> : <DataTable columns={distCols} rows={distancias} minWidth={480} />}
        </Card>
      )}
    </div>
  );
}
