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
import { REMITO_TENANTS } from "@/lib/tenants";
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

  // Distancias solo existen en Beraldi (como el CRM viejo)
  useEffect(() => {
    if (tab === "distancias" && tenant !== "beraldi") {
      setTenant("beraldi");
    }
  }, [tab, tenant]);

  const lomaCampanaId =
    localidades.find((l) => l.nombre.toUpperCase().includes("LOMA CAMPANA"))?.id ?? "";

  const distanciasSorted = [...distancias].sort((a, b) => {
    const o = (a.origen_nombre ?? "").localeCompare(b.origen_nombre ?? "", "es");
    if (o !== 0) return o;
    return (a.destino_nombre ?? "").localeCompare(b.destino_nombre ?? "", "es");
  });

  function formatKm(km: number) {
    return Number(km).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function onAddChofer(e: React.FormEvent) {
    e.preventDefault();
    if (!choferForm.nombre.trim()) return;
    try {
      const phone = choferForm.documento.trim() || choferForm.telefono.trim() || null;
      await createChofer({
        tenant,
        nombre: choferForm.nombre.trim(),
        telefono: phone,
        documento: phone,
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
    const origen_id = distForm.origen_id || lomaCampanaId;
    if (!origen_id || !distForm.destino_id || distForm.km === "") return;
    await createDistancia({
      tenant: "beraldi",
      origen_id,
      destino_id: distForm.destino_id,
      km: Number(distForm.km),
      activo: true,
    });
    setDistForm({ origen_id: lomaCampanaId, destino_id: "", km: "" });
    load();
  }

  const choferCols: Column<Chofer>[] = [
    { key: "nombre", header: "Nombre", render: (r) => <span className="font-medium text-white">{r.nombre}</span> },
    {
      key: "documento",
      header: "Teléfono (DNI CRM)",
      className: "text-[var(--text-dim)] tabular-nums",
      render: (r) => r.documento || r.telefono || "—",
    },
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
    {
      key: "origen",
      header: "Origen",
      className: "max-w-[200px] font-medium text-white",
      render: (r) => r.origen_nombre || "—",
    },
    {
      key: "destino",
      header: "Destino",
      className: "max-w-[220px] text-[var(--text-dim)]",
      render: (r) => r.destino_nombre || "—",
    },
    {
      key: "km",
      header: "Distancia (km)",
      className: "tabular-nums text-right font-semibold text-[var(--green)] whitespace-nowrap",
      render: (r) => `${formatKm(r.km)} km`,
    },
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
        subtitle="Choferes, patentes, localidades y distancias — por cliente TSB / Beraldi / Corina"
        icon={<Database size={24} />}
      />

      <div className="flex flex-wrap gap-2">
        {REMITO_TENANTS.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setTenant(t.slug)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              tenant === t.slug ? "bg-[var(--violet)] text-white" : "bg-white/5 text-[var(--text-dim)] hover:text-white",
            )}
          >
            {tenantLabel(t.slug)}
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
          <form onSubmit={onAddChofer} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input className={inputCls} placeholder="Nombre completo" value={choferForm.nombre} onChange={(e) => setChoferForm((f) => ({ ...f, nombre: e.target.value }))} required />
            <input className={inputCls} placeholder="Teléfono WhatsApp (campo DNI CRM)" value={choferForm.documento} onChange={(e) => setChoferForm((f) => ({ ...f, documento: e.target.value }))} />
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
          <SectionTitle>Distancias · Beraldi</SectionTitle>
          <p className="mb-4 text-sm text-[var(--text-dim)]">
            Cada <strong className="text-white">destino</strong> tiene un km fijo desde su origen — igual que el CRM
            (ej. LOMA CAMPANA-YPF → TRON 24-CIMSA = 344,00 km). Usado en planillas Beraldi.
          </p>

          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : distanciasSorted.length > 0 ? (
            <DataTable columns={distCols} rows={distanciasSorted} minWidth={720} />
          ) : (
            <p className="text-sm text-[var(--text-dim)]">Sin distancias cargadas para Beraldi.</p>
          )}

          <details className="mt-6 rounded-lg border border-[var(--border)] bg-white/[0.02] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-dim)] hover:text-white">
              + Agregar ruta manualmente
            </summary>
            <form
              onSubmit={onAddDistancia}
              className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_120px_auto]"
            >
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Origen
                </span>
                <select
                  className={inputCls}
                  value={distForm.origen_id || lomaCampanaId}
                  onChange={(e) => setDistForm((f) => ({ ...f, origen_id: e.target.value }))}
                  required
                >
                  <option value="">Elegir origen…</option>
                  {localidades.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigo ? `${l.codigo} · ` : ""}
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Destino
                </span>
                <select
                  className={inputCls}
                  value={distForm.destino_id}
                  onChange={(e) => setDistForm((f) => ({ ...f, destino_id: e.target.value }))}
                  required
                >
                  <option value="">Elegir destino…</option>
                  {localidades.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.codigo ? `${l.codigo} · ` : ""}
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Km
                </span>
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="344.00"
                  value={distForm.km}
                  onChange={(e) => setDistForm((f) => ({ ...f, km: e.target.value }))}
                  required
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
                >
                  <Plus size={16} /> Agregar
                </button>
              </div>
            </form>
          </details>
        </Card>
      )}
    </div>
  );
}
