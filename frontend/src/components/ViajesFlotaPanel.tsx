"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createViajesFlotaCamion,
  createViajesFlotaChofer,
  deleteViajesFlotaCamion,
  deleteViajesFlotaChofer,
  listViajesFlotaCamiones,
  listViajesFlotaChoferes,
  updateViajesFlotaCamion,
  updateViajesFlotaChofer,
  type ViajesCamionFlota,
  type ViajesChoferFlota,
} from "@/lib/api";
import { useConfirm } from "@/lib/confirm-context";
import { Card, SectionTitle } from "./ui";

const DIAS = [
  { id: 0, label: "D" },
  { id: 1, label: "L" },
  { id: 2, label: "M" },
  { id: 3, label: "X" },
  { id: 4, label: "J" },
  { id: 5, label: "V" },
  { id: 6, label: "S" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function DiasToggle({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {DIAS.map((d) => {
        const on = value.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() =>
              onChange(on ? value.filter((x) => x !== d.id) : [...value, d.id].sort((a, b) => a - b))
            }
            className={clsx(
              "h-7 w-7 rounded text-xs font-semibold",
              on ? "bg-[var(--violet)] text-white" : "bg-white/5 text-[var(--text-faint)]",
            )}
            title={d.label}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function parseHorarios(raw: string) {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTipos(raw: string) {
  return raw
    .split(/[,;|]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function ViajesFlotaPanel() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"choferes" | "camiones">("choferes");
  const [choferes, setChoferes] = useState<ViajesChoferFlota[]>([]);
  const [camiones, setCamiones] = useState<ViajesCamionFlota[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [choferForm, setChoferForm] = useState({
    nombre: "",
    telefono: "",
    dias_semana: [1, 2, 3, 4, 5, 6] as number[],
    horarios: "08:00, 11:00, 14:00",
  });
  const [camionForm, setCamionForm] = useState({
    tractor: "",
    semi: "",
    tipo: "tolva",
    tipos_carga: "soja, granos, cereal",
    capacidad_t: "28",
    dias_semana: [1, 2, 3, 4, 5, 6] as number[],
    horarios: "08:00, 11:00, 14:00",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, m] = await Promise.all([listViajesFlotaChoferes(), listViajesFlotaCamiones()]);
      setChoferes(c);
      setCamiones(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar flota de viajes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function altaChofer() {
    if (!choferForm.nombre.trim()) return;
    await createViajesFlotaChofer({
      nombre: choferForm.nombre,
      telefono: choferForm.telefono,
      dias_semana: choferForm.dias_semana,
      horarios: parseHorarios(choferForm.horarios),
      activo: true,
    });
    setChoferForm({
      nombre: "",
      telefono: "",
      dias_semana: [1, 2, 3, 4, 5, 6],
      horarios: "08:00, 11:00, 14:00",
    });
    await load();
  }

  async function altaCamion() {
    if (!camionForm.tractor.trim()) return;
    await createViajesFlotaCamion({
      tractor: camionForm.tractor,
      semi: camionForm.semi || null,
      tipo: camionForm.tipo,
      tipos_carga: parseTipos(camionForm.tipos_carga),
      capacidad_t: Number(camionForm.capacidad_t) || 28,
      dias_semana: camionForm.dias_semana,
      horarios: parseHorarios(camionForm.horarios),
      activo: true,
    });
    setCamionForm({
      tractor: "",
      semi: "",
      tipo: "tolva",
      tipos_carga: "soja, granos, cereal",
      capacidad_t: "28",
      dias_semana: [1, 2, 3, 4, 5, 6],
      horarios: "08:00, 11:00, 14:00",
    });
    await load();
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <SectionTitle>Parámetros de Gestión de Viajes</SectionTitle>
          <p className="mt-1 max-w-2xl text-xs text-[var(--text-faint)]">
            Flota propia del agente (choferes, camiones, días y horarios). Es distinta a Parámetros de
            Remitos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-white"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {(
          [
            ["choferes", "Choferes"],
            ["camiones", "Camiones"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              tab === id ? "bg-[var(--violet)] text-white" : "bg-white/5 text-[var(--text-dim)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-amber-300/90">{error}</p> : null}

      {tab === "choferes" && (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={inputCls}
              placeholder="Nombre"
              value={choferForm.nombre}
              onChange={(e) => setChoferForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Teléfono WA"
              value={choferForm.telefono}
              onChange={(e) => setChoferForm((f) => ({ ...f, telefono: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Horarios (08:00, 11:00)"
              value={choferForm.horarios}
              onChange={(e) => setChoferForm((f) => ({ ...f, horarios: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <DiasToggle
                value={choferForm.dias_semana}
                onChange={(dias_semana) => setChoferForm((f) => ({ ...f, dias_semana }))}
              />
              <button
                type="button"
                onClick={() => void altaChofer()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--violet)] px-3 py-2 text-xs font-semibold text-white"
              >
                <Plus size={14} /> Alta
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {choferes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-[140px] flex-1">
                  <div className="font-medium text-white">{c.nombre}</div>
                  <div className="text-xs text-[var(--text-faint)]">{c.telefono || "sin teléfono"}</div>
                </div>
                <DiasToggle
                  value={c.dias_semana ?? []}
                  onChange={(dias_semana) =>
                    void updateViajesFlotaChofer(c.id, { dias_semana }).then(load)
                  }
                />
                <input
                  className={clsx(inputCls, "max-w-[180px]")}
                  defaultValue={(c.horarios ?? []).join(", ")}
                  onBlur={(e) =>
                    void updateViajesFlotaChofer(c.id, {
                      horarios: parseHorarios(e.target.value),
                    }).then(load)
                  }
                />
                <label className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                  <input
                    type="checkbox"
                    checked={c.activo !== false}
                    onChange={(e) =>
                      void updateViajesFlotaChofer(c.id, { activo: e.target.checked }).then(load)
                    }
                  />
                  Activo
                </label>
                <button
                  type="button"
                  className="text-[var(--text-faint)] hover:text-red-400"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Eliminar chofer",
                      message: `¿Borrar ${c.nombre} de la flota de viajes?`,
                    });
                    if (!ok) return;
                    await deleteViajesFlotaChofer(c.id);
                    await load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!loading && choferes.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">Sin choferes de viajes todavía.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === "camiones" && (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className={inputCls}
              placeholder="Patente tractor"
              value={camionForm.tractor}
              onChange={(e) => setCamionForm((f) => ({ ...f, tractor: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Semi (opcional)"
              value={camionForm.semi}
              onChange={(e) => setCamionForm((f) => ({ ...f, semi: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Tipo (tolva, termo…)"
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
            <div className="flex items-center gap-2 lg:col-span-3">
              <DiasToggle
                value={camionForm.dias_semana}
                onChange={(dias_semana) => setCamionForm((f) => ({ ...f, dias_semana }))}
              />
              <button
                type="button"
                onClick={() => void altaCamion()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--violet)] px-3 py-2 text-xs font-semibold text-white"
              >
                <Plus size={14} /> Alta
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {camiones.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-[160px] flex-1">
                  <div className="font-medium text-white">
                    {c.tractor}
                    {c.semi ? ` / ${c.semi}` : ""}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {c.tipo} · {c.capacidad_t}t · {(c.tipos_carga ?? []).join(", ")}
                  </div>
                </div>
                <DiasToggle
                  value={c.dias_semana ?? []}
                  onChange={(dias_semana) =>
                    void updateViajesFlotaCamion(c.id, { dias_semana }).then(load)
                  }
                />
                <input
                  className={clsx(inputCls, "max-w-[180px]")}
                  defaultValue={(c.horarios ?? []).join(", ")}
                  onBlur={(e) =>
                    void updateViajesFlotaCamion(c.id, {
                      horarios: parseHorarios(e.target.value),
                    }).then(load)
                  }
                />
                <label className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                  <input
                    type="checkbox"
                    checked={c.activo !== false}
                    onChange={(e) =>
                      void updateViajesFlotaCamion(c.id, { activo: e.target.checked }).then(load)
                    }
                  />
                  Activo
                </label>
                <button
                  type="button"
                  className="text-[var(--text-faint)] hover:text-red-400"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Eliminar camión",
                      message: `¿Borrar ${c.tractor} de la flota de viajes?`,
                    });
                    if (!ok) return;
                    await deleteViajesFlotaCamion(c.id);
                    await load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!loading && camiones.length === 0 ? (
              <p className="text-sm text-[var(--text-dim)]">Sin camiones de viajes todavía.</p>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
