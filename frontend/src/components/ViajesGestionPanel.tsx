"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Users,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import {
  createViaje,
  createViajesFlotaCamion,
  createViajesFlotaChofer,
  deleteViajesFlotaCamion,
  deleteViajesFlotaChofer,
  listViajes,
  listViajesFlotaCamiones,
  listViajesFlotaChoferes,
  updateViajesFlotaCamion,
  updateViajesFlotaChofer,
  type Viaje,
  type ViajesCamionFlota,
  type ViajesChoferFlota,
} from "@/lib/api";
import { useConfirm } from "@/lib/confirm-context";
import { Card, KpiCard } from "./ui";
import { ViajesTable } from "./ViajesTable";

const DIAS = [
  { id: 0, label: "D" },
  { id: 1, label: "L" },
  { id: 2, label: "M" },
  { id: 3, label: "M" },
  { id: 4, label: "J" },
  { id: 5, label: "V" },
  { id: 6, label: "S" },
];

const PAGE_SIZE = 5;

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[var(--text-faint)] focus:ring-1 focus:ring-[var(--violet)]";

function initials(nombre: string) {
  const parts = String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function avatarTone(seed: string) {
  const tones = [
    "from-violet-500/80 to-fuchsia-500/50",
    "from-sky-500/80 to-indigo-500/50",
    "from-emerald-500/70 to-teal-500/40",
    "from-amber-500/70 to-orange-500/40",
    "from-rose-500/70 to-pink-500/40",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 17) % tones.length;
  return tones[h];
}

function parseHorarios(raw: string) {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s));
}

function parseTipos(raw: string) {
  return raw
    .split(/[,;|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function DiasPills({
  value,
  onChange,
  readOnly = false,
}: {
  value: number[];
  onChange?: (v: number[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {DIAS.map((d) => {
        const on = value.includes(d.id);
        return (
          <button
            key={`${d.id}-${d.label}`}
            type="button"
            disabled={readOnly && !onChange}
            onClick={() => {
              if (!onChange) return;
              onChange(
                on ? value.filter((x) => x !== d.id) : [...value, d.id].sort((a, b) => a - b),
              );
            }}
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition",
              on
                ? "bg-[var(--violet)] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.35)]"
                : "bg-white/[0.04] text-[var(--text-faint)] ring-1 ring-white/10",
              onChange && "cursor-pointer hover:opacity-90",
              !onChange && "cursor-default",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function HorarioTags({ items }: { items: string[] }) {
  if (!items?.length) return <span className="text-xs text-[var(--text-faint)]">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((h) => (
        <span
          key={h}
          className="rounded-lg bg-[var(--violet)]/15 px-2 py-0.5 text-xs font-medium text-[var(--violet-2)] ring-1 ring-[var(--violet)]/25"
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function waLink(telefono: string) {
  const n = String(telefono || "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}`;
}

export function ViajesGestionPanel() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"choferes" | "camiones" | "viajes">("choferes");
  const [choferes, setChoferes] = useState<ViajesChoferFlota[]>([]);
  const [camiones, setCamiones] = useState<ViajesCamionFlota[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [qNombre, setQNombre] = useState("");
  const [qTel, setQTel] = useState("");
  const [qHorarios, setQHorarios] = useState("");
  const [qDias, setQDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [soloActivos, setSoloActivos] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAlta, setShowAlta] = useState(false);
  const [editingChofer, setEditingChofer] = useState<ViajesChoferFlota | null>(null);
  const [editingCamion, setEditingCamion] = useState<ViajesCamionFlota | null>(null);
  const [showNuevoViaje, setShowNuevoViaje] = useState(false);

  const [choferForm, setChoferForm] = useState({
    nombre: "",
    telefono: "",
    dias_semana: [1, 2, 3, 4, 5] as number[],
    horarios: "08:00, 11:00, 14:00, 16:00",
  });
  const [camionForm, setCamionForm] = useState({
    tractor: "",
    semi: "",
    tipo: "tolva",
    tipos_carga: "soja, granos, cereal",
    capacidad_t: "28",
    dias_semana: [1, 2, 3, 4, 5] as number[],
    horarios: "08:00, 11:00, 14:00",
  });
  const [viajeForm, setViajeForm] = useState({
    cliente: "",
    origen: "",
    destino: "",
    carga: "",
    fecha: "",
    hora: "08:00",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, m, v] = await Promise.all([
        listViajesFlotaChoferes(),
        listViajesFlotaCamiones(),
        listViajes({ limit: 100 }).catch(() => [] as Viaje[]),
      ]);
      setChoferes(c);
      setCamiones(m);
      setViajes(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la flota de viajes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, qNombre, qTel, qHorarios, qDias, soloActivos]);

  const choferesFiltrados = useMemo(() => {
    return choferes.filter((c) => {
      if (soloActivos && c.activo === false) return false;
      if (qNombre && !c.nombre.toLowerCase().includes(qNombre.toLowerCase())) return false;
      if (qTel && !String(c.telefono || "").includes(qTel.replace(/\D/g, ""))) return false;
      if (qHorarios.trim()) {
        const wanted = parseHorarios(qHorarios);
        if (wanted.length && !wanted.every((h) => (c.horarios || []).includes(h))) return false;
      }
      if (qDias.length && !qDias.every((d) => (c.dias_semana || []).includes(d))) return false;
      return true;
    });
  }, [choferes, qNombre, qTel, qHorarios, qDias, soloActivos]);

  const camionesFiltrados = useMemo(() => {
    return camiones.filter((c) => {
      if (soloActivos && c.activo === false) return false;
      const blob = `${c.tractor} ${c.semi || ""} ${c.tipo} ${(c.tipos_carga || []).join(" ")}`.toLowerCase();
      if (qNombre && !blob.includes(qNombre.toLowerCase())) return false;
      if (qHorarios.trim()) {
        const wanted = parseHorarios(qHorarios);
        if (wanted.length && !wanted.every((h) => (c.horarios || []).includes(h))) return false;
      }
      if (qDias.length && !qDias.every((d) => (c.dias_semana || []).includes(d))) return false;
      return true;
    });
  }, [camiones, qNombre, qHorarios, qDias, soloActivos]);

  const rows = tab === "choferes" ? choferesFiltrados : camionesFiltrados;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = rows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const kpis = useMemo(() => {
    const activos = choferes.filter((c) => c.activo !== false).length;
    const programados = viajes.filter((v) =>
      ["confirmado", "asignado", "en_curso"].includes(v.estado),
    ).length;
    const pendientes = viajes.filter((v) => v.estado === "solicitado").length;
    const ocupados = new Set(
      viajes
        .filter((v) => ["asignado", "en_curso"].includes(v.estado))
        .map((v) => (v.chofer || "").toLowerCase())
        .filter(Boolean),
    ).size;
    const ocupacion = activos ? Math.round((ocupados / activos) * 100) : 0;
    return { activos, programados, pendientes, ocupacion };
  }, [choferes, viajes]);

  async function altaChofer() {
    if (!choferForm.nombre.trim()) return;
    await createViajesFlotaChofer({
      nombre: choferForm.nombre.trim(),
      telefono: choferForm.telefono,
      dias_semana: choferForm.dias_semana,
      horarios: parseHorarios(choferForm.horarios),
      activo: true,
    });
    setChoferForm({
      nombre: "",
      telefono: "",
      dias_semana: [1, 2, 3, 4, 5],
      horarios: "08:00, 11:00, 14:00, 16:00",
    });
    setShowAlta(false);
    await load();
  }

  async function altaCamion() {
    if (!camionForm.tractor.trim()) return;
    await createViajesFlotaCamion({
      tractor: camionForm.tractor.trim(),
      semi: camionForm.semi || null,
      tipo: camionForm.tipo,
      tipos_carga: parseTipos(camionForm.tipos_carga),
      capacidad_t: Number(camionForm.capacidad_t) || 28,
      dias_semana: camionForm.dias_semana,
      horarios: parseHorarios(camionForm.horarios),
      activo: true,
    });
    setShowAlta(false);
    await load();
  }

  async function guardarChoferEdit() {
    if (!editingChofer) return;
    await updateViajesFlotaChofer(editingChofer.id, {
      nombre: editingChofer.nombre,
      telefono: editingChofer.telefono,
      dias_semana: editingChofer.dias_semana,
      horarios: editingChofer.horarios,
      activo: editingChofer.activo,
    });
    setEditingChofer(null);
    await load();
  }

  async function guardarCamionEdit() {
    if (!editingCamion) return;
    await updateViajesFlotaCamion(editingCamion.id, {
      tractor: editingCamion.tractor,
      semi: editingCamion.semi,
      tipo: editingCamion.tipo,
      tipos_carga: editingCamion.tipos_carga,
      capacidad_t: editingCamion.capacidad_t,
      dias_semana: editingCamion.dias_semana,
      horarios: editingCamion.horarios,
      activo: editingCamion.activo,
    });
    setEditingCamion(null);
    await load();
  }

  async function crearNuevoViaje() {
    if (!viajeForm.cliente || !viajeForm.origen || !viajeForm.destino) return;
    await createViaje({
      cliente: viajeForm.cliente,
      origen: viajeForm.origen,
      destino: viajeForm.destino,
      carga: viajeForm.carga || undefined,
      fecha: viajeForm.fecha || undefined,
      hora: viajeForm.hora || undefined,
    });
    setShowNuevoViaje(false);
    setViajeForm({ cliente: "", origen: "", destino: "", carga: "", fecha: "", hora: "08:00" });
    setTab("viajes");
    await load();
  }

  return (
    <div className="space-y-5">
      {/* Header tipo mockup */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-white sm:text-2xl">
            Gestión de Viajes
          </h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Configura y administra los horarios y disponibilidad de tu flota
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white/[0.03] text-[var(--text-dim)] hover:text-white"
            title="Pendientes"
          >
            <Bell size={18} />
            {kpis.pendientes > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--violet)] px-1 text-[10px] font-bold text-white">
                {kpis.pendientes}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setShowNuevoViaje(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--violet)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-[var(--violet)]/90"
          >
            <Plus size={16} />
            Nuevo Viaje
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(
          [
            ["choferes", "Choferes"],
            ["camiones", "Camiones"],
            ["viajes", "Viajes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              "relative px-4 py-2.5 text-sm font-semibold transition",
              tab === id ? "text-white" : "text-[var(--text-faint)] hover:text-[var(--text-dim)]",
            )}
          >
            {label}
            {tab === id ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--violet)]" />
            ) : null}
          </button>
        ))}
      </div>

      {tab !== "viajes" && (
        <>
          {/* Filtros */}
          <Card className="!p-4">
            <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
              <div className="relative lg:col-span-3">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  className={clsx(inputCls, "pl-9")}
                  placeholder={tab === "choferes" ? "Buscar chofer..." : "Buscar camión..."}
                  value={qNombre}
                  onChange={(e) => setQNombre(e.target.value)}
                />
              </div>
              {tab === "choferes" ? (
                <div className="lg:col-span-2">
                  <input
                    className={inputCls}
                    placeholder="Teléfono / WhatsApp"
                    value={qTel}
                    onChange={(e) => setQTel(e.target.value)}
                  />
                </div>
              ) : null}
              <div className={clsx("relative", tab === "choferes" ? "lg:col-span-3" : "lg:col-span-4")}>
                <Clock3
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  className={clsx(inputCls, "pl-9")}
                  placeholder="Horarios (ej: 08:00, 11:00)"
                  value={qHorarios}
                  onChange={(e) => setQHorarios(e.target.value)}
                />
              </div>
              <div className="lg:col-span-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                  Días disponibles
                </p>
                <DiasPills value={qDias} onChange={setQDias} />
              </div>
              <div className="flex gap-2 lg:col-span-1 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 text-xs font-medium text-[var(--text-dim)] hover:text-white"
                >
                  <Filter size={14} />
                  Filtros
                </button>
              </div>
            </div>
            {showAdvanced ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border-soft)] pt-3">
                <label className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                  <input
                    type="checkbox"
                    checked={soloActivos}
                    onChange={(e) => setSoloActivos(e.target.checked)}
                    className="accent-[var(--violet)]"
                  />
                  Solo activos
                </label>
                <button
                  type="button"
                  onClick={() => setShowAlta(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                >
                  <Plus size={13} />
                  Alta {tab === "choferes" ? "chofer" : "camión"}
                </button>
              </div>
            ) : null}
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Choferes activos"
              value={String(kpis.activos)}
              hint="En flota de viajes"
              icon={<Users size={16} />}
            />
            <KpiCard
              label="Viajes programados"
              value={String(kpis.programados)}
              hint="Confirmados / en curso"
              icon={<CalendarDays size={16} />}
            />
            <KpiCard
              label="Ocupación promedio"
              value={`${kpis.ocupacion}%`}
              hint="Choferes con viaje activo"
              icon={<Truck size={16} />}
            />
            <KpiCard
              label="Viajes pendientes"
              value={String(kpis.pendientes)}
              hint="Por asignar"
              icon={<AlertCircle size={16} />}
            />
          </div>
        </>
      )}

      {error ? <p className="text-sm text-amber-300/90">{error}</p> : null}

      {tab === "viajes" ? (
        <ViajesTable />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                  <th className="px-4 py-3 font-semibold">
                    {tab === "choferes" ? "Chofer" : "Camión"}
                  </th>
                  <th className="px-4 py-3 font-semibold">Días disponibles</th>
                  <th className="px-4 py-3 font-semibold">Horarios</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tab === "choferes" &&
                  (pageRows as ViajesChoferFlota[]).map((c) => {
                    const wa = waLink(c.telefono);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--border-soft)] transition hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
                                avatarTone(c.nombre),
                              )}
                            >
                              {initials(c.nombre)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{c.nombre}</div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-faint)]">
                                <span>{c.telefono || "Sin teléfono"}</span>
                                {wa ? (
                                  <a
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                    title="WhatsApp"
                                  >
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DiasPills
                            value={c.dias_semana || []}
                            onChange={(dias_semana) =>
                              void updateViajesFlotaChofer(c.id, { dias_semana }).then(load)
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <HorarioTags items={c.horarios || []} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                              c.activo !== false
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-white/5 text-[var(--text-faint)]",
                            )}
                          >
                            <span
                              className={clsx(
                                "h-1.5 w-1.5 rounded-full",
                                c.activo !== false ? "bg-emerald-400" : "bg-[var(--text-faint)]",
                              )}
                            />
                            {c.activo !== false ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingChofer({ ...c })}
                              className="rounded-lg p-2 text-[var(--text-faint)] hover:bg-white/5 hover:text-white"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-[var(--text-faint)] hover:bg-red-500/10 hover:text-red-400"
                              title="Eliminar"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Eliminar chofer",
                                  message: `¿Borrar a ${c.nombre} de la flota de viajes?`,
                                  variant: "danger",
                                });
                                if (!ok) return;
                                await deleteViajesFlotaChofer(c.id);
                                await load();
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {tab === "camiones" &&
                  (pageRows as ViajesCamionFlota[]).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border-soft)] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
                            <Truck size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {c.tractor}
                              {c.semi ? ` / ${c.semi}` : ""}
                            </div>
                            <div className="text-xs text-[var(--text-faint)]">
                              {c.tipo} · {c.capacidad_t}t · {(c.tipos_carga || []).slice(0, 4).join(", ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DiasPills
                          value={c.dias_semana || []}
                          onChange={(dias_semana) =>
                            void updateViajesFlotaCamion(c.id, { dias_semana }).then(load)
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <HorarioTags items={c.horarios || []} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                            c.activo !== false
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-white/5 text-[var(--text-faint)]",
                          )}
                        >
                          <span
                            className={clsx(
                              "h-1.5 w-1.5 rounded-full",
                              c.activo !== false ? "bg-emerald-400" : "bg-[var(--text-faint)]",
                            )}
                          />
                          {c.activo !== false ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingCamion({ ...c })}
                            className="rounded-lg p-2 text-[var(--text-faint)] hover:bg-white/5 hover:text-white"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-[var(--text-faint)] hover:bg-red-500/10 hover:text-red-400"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Eliminar camión",
                                message: `¿Borrar ${c.tractor} de la flota?`,
                                variant: "danger",
                              });
                              if (!ok) return;
                              await deleteViajesFlotaCamion(c.id);
                              await load();
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-dim)]">
                      No hay resultados con esos filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-faint)]">
            <span>
              Mostrando{" "}
              {rows.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1} a{" "}
              {Math.min(pageSafe * PAGE_SIZE, rows.length)} de {rows.length}{" "}
              {tab === "choferes" ? "choferes" : "camiones"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg p-1.5 hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, pageSafe - 3), Math.max(0, pageSafe - 3) + 5)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={clsx(
                      "min-w-8 rounded-lg px-2 py-1 font-semibold",
                      n === pageSafe
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--text-dim)] hover:bg-white/5",
                    )}
                  >
                    {n}
                  </button>
                ))}
              <button
                type="button"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg p-1.5 hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Modal alta */}
      {showAlta ? (
        <Modal
          title={tab === "choferes" ? "Alta de chofer" : "Alta de camión"}
          onClose={() => setShowAlta(false)}
        >
          {tab === "choferes" ? (
            <div className="space-y-3">
              <input
                className={inputCls}
                placeholder="Nombre"
                value={choferForm.nombre}
                onChange={(e) => setChoferForm((f) => ({ ...f, nombre: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Teléfono / WhatsApp"
                value={choferForm.telefono}
                onChange={(e) => setChoferForm((f) => ({ ...f, telefono: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Horarios"
                value={choferForm.horarios}
                onChange={(e) => setChoferForm((f) => ({ ...f, horarios: e.target.value }))}
              />
              <DiasPills
                value={choferForm.dias_semana}
                onChange={(dias_semana) => setChoferForm((f) => ({ ...f, dias_semana }))}
              />
              <button
                type="button"
                onClick={() => void altaChofer()}
                className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
              >
                Guardar chofer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                className={inputCls}
                placeholder="Patente tractor"
                value={camionForm.tractor}
                onChange={(e) => setCamionForm((f) => ({ ...f, tractor: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Semi"
                value={camionForm.semi}
                onChange={(e) => setCamionForm((f) => ({ ...f, semi: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Tipo"
                value={camionForm.tipo}
                onChange={(e) => setCamionForm((f) => ({ ...f, tipo: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Tipos de carga"
                value={camionForm.tipos_carga}
                onChange={(e) => setCamionForm((f) => ({ ...f, tipos_carga: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Capacidad t"
                value={camionForm.capacidad_t}
                onChange={(e) => setCamionForm((f) => ({ ...f, capacidad_t: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Horarios"
                value={camionForm.horarios}
                onChange={(e) => setCamionForm((f) => ({ ...f, horarios: e.target.value }))}
              />
              <DiasPills
                value={camionForm.dias_semana}
                onChange={(dias_semana) => setCamionForm((f) => ({ ...f, dias_semana }))}
              />
              <button
                type="button"
                onClick={() => void altaCamion()}
                className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
              >
                Guardar camión
              </button>
            </div>
          )}
        </Modal>
      ) : null}

      {editingChofer ? (
        <Modal title="Editar chofer" onClose={() => setEditingChofer(null)}>
          <div className="space-y-3">
            <input
              className={inputCls}
              value={editingChofer.nombre}
              onChange={(e) => setEditingChofer({ ...editingChofer, nombre: e.target.value })}
            />
            <input
              className={inputCls}
              value={editingChofer.telefono}
              onChange={(e) => setEditingChofer({ ...editingChofer, telefono: e.target.value })}
            />
            <input
              className={inputCls}
              value={(editingChofer.horarios || []).join(", ")}
              onChange={(e) =>
                setEditingChofer({ ...editingChofer, horarios: parseHorarios(e.target.value) })
              }
            />
            <DiasPills
              value={editingChofer.dias_semana || []}
              onChange={(dias_semana) => setEditingChofer({ ...editingChofer, dias_semana })}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
              <input
                type="checkbox"
                checked={editingChofer.activo !== false}
                onChange={(e) => setEditingChofer({ ...editingChofer, activo: e.target.checked })}
              />
              Activo
            </label>
            <button
              type="button"
              onClick={() => void guardarChoferEdit()}
              className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
            >
              Guardar cambios
            </button>
          </div>
        </Modal>
      ) : null}

      {editingCamion ? (
        <Modal title="Editar camión" onClose={() => setEditingCamion(null)}>
          <div className="space-y-3">
            <input
              className={inputCls}
              value={editingCamion.tractor}
              onChange={(e) => setEditingCamion({ ...editingCamion, tractor: e.target.value })}
            />
            <input
              className={inputCls}
              value={editingCamion.semi || ""}
              onChange={(e) => setEditingCamion({ ...editingCamion, semi: e.target.value || null })}
            />
            <input
              className={inputCls}
              value={(editingCamion.horarios || []).join(", ")}
              onChange={(e) =>
                setEditingCamion({ ...editingCamion, horarios: parseHorarios(e.target.value) })
              }
            />
            <DiasPills
              value={editingCamion.dias_semana || []}
              onChange={(dias_semana) => setEditingCamion({ ...editingCamion, dias_semana })}
            />
            <button
              type="button"
              onClick={() => void guardarCamionEdit()}
              className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
            >
              Guardar cambios
            </button>
          </div>
        </Modal>
      ) : null}

      {showNuevoViaje ? (
        <Modal title="Nuevo viaje" onClose={() => setShowNuevoViaje(false)}>
          <div className="space-y-3">
            <input
              className={inputCls}
              placeholder="Cliente"
              value={viajeForm.cliente}
              onChange={(e) => setViajeForm((f) => ({ ...f, cliente: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Origen"
              value={viajeForm.origen}
              onChange={(e) => setViajeForm((f) => ({ ...f, origen: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Destino"
              value={viajeForm.destino}
              onChange={(e) => setViajeForm((f) => ({ ...f, destino: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Carga"
              value={viajeForm.carga}
              onChange={(e) => setViajeForm((f) => ({ ...f, carga: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputCls}
                type="date"
                value={viajeForm.fecha}
                onChange={(e) => setViajeForm((f) => ({ ...f, fecha: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Hora"
                value={viajeForm.hora}
                onChange={(e) => setViajeForm((f) => ({ ...f, hora: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={() => void crearNuevoViaje()}
              className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white"
            >
              Crear viaje
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-faint)] hover:bg-white/5 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Compat: nombre anterior */
export { ViajesGestionPanel as ViajesFlotaPanel };
