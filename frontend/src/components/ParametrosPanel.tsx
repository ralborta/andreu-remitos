"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Database, Plus, Search, Trash2, X } from "lucide-react";
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
  updateChofer,
  updateDistancia,
  updateLocalidad,
  updateUnidad,
} from "@/lib/api";
import { useConfirm } from "@/lib/confirm-context";
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
import { Card, PageHeader, SectionTitle } from "./ui";

const TABS: { id: ParametroTab; label: string }[] = [
  { id: "choferes", label: "Choferes" },
  { id: "unidades", label: "Tractores y semis" },
  { id: "localidades", label: "Localidades" },
  { id: "distancias", label: "Distancias" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

const rowInputCls =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function saveBtnCls(disabled: boolean, saved: boolean) {
  return clsx(
    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap",
    saved
      ? "bg-[var(--green)]/20 text-[var(--green)]"
      : disabled
        ? "cursor-not-allowed bg-white/5 text-[var(--text-faint)]"
        : "bg-[var(--violet)] text-white hover:bg-[var(--violet)]/90",
  );
}

function matchBusqueda(q: string, ...parts: (string | null | undefined | number)[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}

function ParamBuscar({
  value,
  onChange,
  placeholder,
  total,
  filtered,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  total: number;
  filtered: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(inputCls, "pl-9 pr-9")}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-faint)] hover:bg-white/10 hover:text-white"
            aria-label="Limpiar búsqueda"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <span className="text-xs text-[var(--text-faint)]">
        {value.trim() ? `${filtered} de ${total}` : `${total} registros`}
      </span>
    </div>
  );
}

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
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setBusqueda("");
  }, [tab, tenant]);

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

  const q = busqueda.trim();
  const choferesFiltrados = choferes.filter((r) =>
    matchBusqueda(q, r.nombre, r.telefono, r.documento),
  );
  const unidadesFiltradas = unidades.filter((r) =>
    matchBusqueda(q, r.patente, r.unidad_interna, r.tipo === "tractor" ? "tractor chasis" : "semi acoplado"),
  );
  const localidadesFiltradas = localidades.filter((r) =>
    matchBusqueda(q, r.nombre, r.codigo, r.tipo),
  );
  const distanciasFiltradas = distanciasSorted.filter((r) =>
    matchBusqueda(q, r.origen_nombre, r.destino_nombre, r.km),
  );

  function setErr(err: unknown) {
    setError(err instanceof Error ? err.message : "Error al guardar");
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
      setErr(err);
    }
  }

  async function onAddUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!unidadForm.patente.trim()) return;
    try {
      await createUnidad({
        tenant,
        tipo: unidadForm.tipo,
        patente: unidadForm.patente.trim(),
        unidad_interna: unidadForm.unidad_interna.trim() || null,
        activo: true,
      });
      setUnidadForm({ tipo: "tractor", patente: "", unidad_interna: "" });
      load();
    } catch (err) {
      setErr(err);
    }
  }

  async function onAddLocalidad(e: React.FormEvent) {
    e.preventDefault();
    if (!locForm.nombre.trim()) return;
    try {
      await createLocalidad({
        tenant,
        nombre: locForm.nombre.trim(),
        codigo: locForm.codigo.trim() || null,
        tipo: locForm.tipo,
        activo: true,
      });
      setLocForm({ nombre: "", codigo: "", tipo: "ambos" });
      load();
    } catch (err) {
      setErr(err);
    }
  }

  async function onAddDistancia(e: React.FormEvent) {
    e.preventDefault();
    const origen_id = distForm.origen_id || lomaCampanaId;
    if (!origen_id || !distForm.destino_id || distForm.km === "") return;
    try {
      await createDistancia({
        tenant: "beraldi",
        origen_id,
        destino_id: distForm.destino_id,
        km: Number(distForm.km),
        activo: true,
      });
      setDistForm({ origen_id: lomaCampanaId, destino_id: "", km: "" });
      load();
    } catch (err) {
      setErr(err);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parámetros maestros"
        subtitle="Modificá los campos de cada fila y pulsá Guardar. Podés agregar filas nuevas abajo."
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
          <p className="mb-3 text-xs text-[var(--text-faint)]">
            Editá nombre o teléfono y pulsá <strong className="text-white">Guardar</strong> en esa fila.
          </p>
          <form onSubmit={onAddChofer} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input className={inputCls} placeholder="Nombre completo" value={choferForm.nombre} onChange={(e) => setChoferForm((f) => ({ ...f, nombre: e.target.value }))} required />
            <input className={inputCls} placeholder="Teléfono WhatsApp (campo DNI CRM)" value={choferForm.documento} onChange={(e) => setChoferForm((f) => ({ ...f, documento: e.target.value }))} />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[var(--violet)] py-2 text-sm font-semibold text-white">
              <Plus size={16} /> Agregar
            </button>
          </form>
          <ParamBuscar
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre o teléfono…"
            total={choferes.length}
            filtered={choferesFiltrados.length}
          />
          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : choferesFiltrados.length > 0 ? (
            <ParamTable minWidth={720} headers={["Nombre", "Teléfono (DNI CRM)", ""]}>
              {choferesFiltrados.map((r) => (
                <ChoferRow key={r.id} row={r} onReload={load} onError={setErr} />
              ))}
            </ParamTable>
          ) : choferes.length > 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Ningún chofer coincide con la búsqueda.</p>
          ) : null}
          {!loading && choferes.length === 0 && (
            <p className="mt-2 text-sm text-[var(--text-dim)]">Sin choferes. El teléfono vincula WhatsApp al chofer al mandar remitos.</p>
          )}
        </Card>
      )}

      {tab === "unidades" && (
        <Card>
          <SectionTitle>Tractores y semis · {tenantLabel(tenant)}</SectionTitle>
          <p className="mb-3 text-xs text-[var(--text-faint)]">
            Editá los campos y pulsá <strong className="text-white">Guardar</strong> en esa fila.
          </p>
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
          <ParamBuscar
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por patente, nro interno o tipo…"
            total={unidades.length}
            filtered={unidadesFiltradas.length}
          />
          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : unidadesFiltradas.length > 0 ? (
            <ParamTable minWidth={640} headers={["Tipo", "Patente", "Nro interno", ""]}>
              {unidadesFiltradas.map((r) => (
                <UnidadRow key={r.id} row={r} onReload={load} onError={setErr} />
              ))}
            </ParamTable>
          ) : unidades.length > 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Ninguna unidad coincide con la búsqueda.</p>
          ) : null}
        </Card>
      )}

      {tab === "localidades" && (
        <Card>
          <SectionTitle>Localidades · {tenantLabel(tenant)}</SectionTitle>
          <p className="mb-3 text-xs text-[var(--text-faint)]">
            Cambiá el nombre (ej. renombrar &quot;BASE TSB 1&quot;), el código o el tipo, y pulsá{" "}
            <strong className="text-white">Guardar</strong> en esa fila.
          </p>
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
          <ParamBuscar
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre, código o tipo…"
            total={localidades.length}
            filtered={localidadesFiltradas.length}
          />
          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : localidadesFiltradas.length > 0 ? (
            <ParamTable minWidth={720} headers={["Nombre", "Código", "Tipo", ""]}>
              {localidadesFiltradas.map((r) => (
                <LocalidadRow key={r.id} row={r} onReload={load} onError={setErr} />
              ))}
            </ParamTable>
          ) : localidades.length > 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Ninguna localidad coincide con la búsqueda.</p>
          ) : null}
        </Card>
      )}

      {tab === "distancias" && (
        <Card>
          <SectionTitle>Distancias · Beraldi</SectionTitle>
          <p className="mb-4 text-sm text-[var(--text-dim)]">
            Cada <strong className="text-white">destino</strong> tiene un km fijo desde su origen — igual que el CRM
            (ej. LOMA CAMPANA-YPF → TRON 24-CIMSA = 344,00 km). Usado en planillas Beraldi.
          </p>

          <ParamBuscar
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por origen, destino o km…"
            total={distanciasSorted.length}
            filtered={distanciasFiltradas.length}
          />

          {loading ? (
            <p className="text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : distanciasFiltradas.length > 0 ? (
            <ParamTable minWidth={800} headers={["Origen", "Destino", "Distancia (km)", ""]}>
              {distanciasFiltradas.map((r) => (
                <DistanciaRow key={r.id} row={r} localidades={localidades} onReload={load} onError={setErr} />
              ))}
            </ParamTable>
          ) : distanciasSorted.length > 0 ? (
            <p className="text-sm text-[var(--text-dim)]">Ninguna distancia coincide con la búsqueda.</p>
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

function ParamTable({
  headers,
  children,
  minWidth,
}: {
  headers: string[];
  children: React.ReactNode;
  minWidth: number;
}) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
            {headers.map((h) => (
              <th key={h || "actions"} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({
  dirty,
  saving,
  saved,
  onSave,
  onDelete,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onSave} disabled={!dirty || saving} className={saveBtnCls(!dirty || saving, saved)}>
        {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg p-1.5 text-[var(--text-faint)] hover:bg-[var(--red)]/10 hover:text-[var(--red)]"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ChoferRow({
  row,
  onReload,
  onError,
}: {
  row: Chofer;
  onReload: () => void;
  onError: (err: unknown) => void;
}) {
  const [nombre, setNombre] = useState(row.nombre);
  const [telefono, setTelefono] = useState(row.documento || row.telefono || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setNombre(row.nombre);
    setTelefono(row.documento || row.telefono || "");
  }, [row.id, row.nombre, row.documento, row.telefono]);

  const dirty = nombre.trim() !== row.nombre || telefono.trim() !== (row.documento || row.telefono || "");

  async function save() {
    if (!nombre.trim()) {
      onError("El nombre no puede estar vacío");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const tel = telefono.trim() || null;
      await updateChofer(row.id, { nombre: nombre.trim(), telefono: tel, documento: tel });
      setSaved(true);
      onReload();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminar chofer",
      message: `¿Eliminar chofer "${row.nombre}"?`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteChofer(row.id);
      onReload();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <tr className="border-t border-[var(--border-soft)] hover:bg-white/[0.03]">
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={telefono} placeholder="549…" onChange={(e) => setTelefono(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <RowActions dirty={dirty} saving={saving} saved={saved} onSave={save} onDelete={remove} />
      </td>
    </tr>
  );
}

function UnidadRow({
  row,
  onReload,
  onError,
}: {
  row: Unidad;
  onReload: () => void;
  onError: (err: unknown) => void;
}) {
  const [tipo, setTipo] = useState(row.tipo);
  const [patente, setPatente] = useState(row.patente);
  const [unidadInterna, setUnidadInterna] = useState(row.unidad_interna || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setTipo(row.tipo);
    setPatente(row.patente);
    setUnidadInterna(row.unidad_interna || "");
  }, [row.id, row.tipo, row.patente, row.unidad_interna]);

  const dirty =
    tipo !== row.tipo ||
    patente.trim() !== row.patente ||
    unidadInterna.trim() !== (row.unidad_interna || "");

  async function save() {
    if (!patente.trim()) {
      onError("La patente no puede estar vacía");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await updateUnidad(row.id, {
        tipo,
        patente: patente.trim(),
        unidad_interna: unidadInterna.trim() || null,
      });
      setSaved(true);
      onReload();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminar unidad",
      message: `¿Eliminar unidad ${row.patente}?`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteUnidad(row.id);
      onReload();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <tr className="border-t border-[var(--border-soft)] hover:bg-white/[0.03]">
      <td className="px-3 py-2 align-middle">
        <select className={rowInputCls} value={tipo} onChange={(e) => setTipo(e.target.value as Unidad["tipo"])}>
          <option value="tractor">Tractor</option>
          <option value="acoplado">Semi</option>
        </select>
      </td>
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={patente} onChange={(e) => setPatente(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={unidadInterna} placeholder="—" onChange={(e) => setUnidadInterna(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <RowActions dirty={dirty} saving={saving} saved={saved} onSave={save} onDelete={remove} />
      </td>
    </tr>
  );
}

function LocalidadRow({
  row,
  onReload,
  onError,
}: {
  row: Localidad;
  onReload: () => void;
  onError: (err: unknown) => void;
}) {
  const [nombre, setNombre] = useState(row.nombre);
  const [codigo, setCodigo] = useState(row.codigo || "");
  const [tipo, setTipo] = useState(row.tipo);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setNombre(row.nombre);
    setCodigo(row.codigo || "");
    setTipo(row.tipo);
  }, [row.id, row.nombre, row.codigo, row.tipo]);

  const dirty =
    nombre.trim() !== row.nombre ||
    codigo.trim() !== (row.codigo || "") ||
    tipo !== row.tipo;

  async function save() {
    if (!nombre.trim()) {
      onError("El nombre no puede estar vacío");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await updateLocalidad(row.id, {
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        tipo,
      });
      setSaved(true);
      onReload();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminar localidad",
      message: `¿Eliminar localidad "${row.nombre}"?`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteLocalidad(row.id);
      onReload();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <tr className="border-t border-[var(--border-soft)] hover:bg-white/[0.03]">
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <input className={rowInputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </td>
      <td className="px-3 py-2 align-middle">
        <select className={rowInputCls} value={tipo} onChange={(e) => setTipo(e.target.value as Localidad["tipo"])}>
          <option value="ambos">Origen y destino</option>
          <option value="origen">Solo origen</option>
          <option value="destino">Solo destino</option>
        </select>
      </td>
      <td className="px-3 py-2 align-middle">
        <RowActions dirty={dirty} saving={saving} saved={saved} onSave={save} onDelete={remove} />
      </td>
    </tr>
  );
}

function DistanciaRow({
  row,
  localidades,
  onReload,
  onError,
}: {
  row: Distancia;
  localidades: Localidad[];
  onReload: () => void;
  onError: (err: unknown) => void;
}) {
  const [origenId, setOrigenId] = useState(row.origen_id);
  const [destinoId, setDestinoId] = useState(row.destino_id);
  const [km, setKm] = useState(String(row.km));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    setOrigenId(row.origen_id);
    setDestinoId(row.destino_id);
    setKm(String(row.km));
  }, [row.id, row.origen_id, row.destino_id, row.km]);

  const dirty =
    origenId !== row.origen_id ||
    destinoId !== row.destino_id ||
    Number(km.replace(",", ".")) !== row.km;

  async function save() {
    const kmNum = Number(km.replace(",", "."));
    if (!Number.isFinite(kmNum)) {
      onError("Km inválido");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await updateDistancia(row.id, { origen_id: origenId, destino_id: destinoId, km: kmNum });
      setSaved(true);
      onReload();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminar distancia",
      message: "¿Eliminar esta distancia?",
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteDistancia(row.id);
      onReload();
    } catch (e) {
      onError(e);
    }
  }

  return (
    <tr className="border-t border-[var(--border-soft)] hover:bg-white/[0.03]">
      <td className="px-3 py-2 align-middle">
        <select className={rowInputCls} value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
          {localidades.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo ? `${l.codigo} · ` : ""}
              {l.nombre}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-middle">
        <select className={rowInputCls} value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
          {localidades.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo ? `${l.codigo} · ` : ""}
              {l.nombre}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-middle">
        <input
          className={clsx(rowInputCls, "text-right font-semibold text-[var(--green)]")}
          inputMode="decimal"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <RowActions dirty={dirty} saving={saving} saved={saved} onSave={save} onDelete={remove} />
      </td>
    </tr>
  );
}
