"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";

type Room = {
  token: string;
  company: string;
  contactName: string;
  expiresAt: string;
  public?: boolean;
  link?: string;
};

export function DemoRoomsPanel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [publicLink, setPublicLink] = useState("https://sol.nivel41.com/demo/public");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    contactEmail: "",
    days: 3,
  });

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/demos", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudieron cargar las demos");
      return;
    }
    setRooms(data.rooms || []);
    if (data.publicLink) setPublicLink(data.publicLink);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/demos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "No se pudo crear el link");
      return;
    }
    setLastLink(data.link || data.room?.link || null);
    setForm({ company: "", contactName: "", contactEmail: "", days: 3 });
    await refresh();
  }

  async function extend(token: string) {
    await fetch("/api/demos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extend", token, days: 3 }),
    });
    await refresh();
  }

  async function remove(token: string) {
    if (!confirm("¿Eliminar esta demo?")) return;
    await fetch("/api/demos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", token }),
    });
    await refresh();
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setLastLink(text);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="DEMO"
        subtitle="Generá links públicos por cliente · sin login para el prospecto"
      />

      <Card className="border-[var(--violet)]/30 bg-[var(--violet)]/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--violet)]">
              Link público permanente
            </div>
            <p className="mt-1 break-all text-sm font-medium">{publicLink}</p>
            <p className="mt-1 text-xs text-[var(--text-dim)]">
              Formato por cliente: https://sol.nivel41.com/demo/nombre-empresa
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copy(publicLink)}
              className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
            >
              <Copy size={14} /> Copiar
            </button>
            <a
              href={publicLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-2 text-sm"
            >
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Crear link para un cliente</h2>
        <form onSubmit={createRoom} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--text-faint)]">
            Empresa *
            <input
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--violet)]"
              placeholder="Transportes ACME"
            />
          </label>
          <label className="block text-xs text-[var(--text-faint)]">
            Contacto *
            <input
              required
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--violet)]"
              placeholder="Juan Pérez"
            />
          </label>
          <label className="block text-xs text-[var(--text-faint)]">
            Email
            <input
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--violet)]"
              placeholder="juan@acme.com"
            />
          </label>
          <label className="block text-xs text-[var(--text-faint)]">
            Días de vigencia
            <select
              value={form.days}
              onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--violet)]"
            >
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  {d} día{d > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="sm:col-span-2 text-sm text-[var(--red)]">{error}</p>
          )}
          {lastLink && (
            <div className="sm:col-span-2 rounded-xl border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2 text-sm">
              Link listo:{" "}
              <a className="font-medium text-[var(--violet-2)] underline" href={lastLink} target="_blank" rel="noreferrer">
                {lastLink}
              </a>
            </div>
          )}
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm"
            >
              <Plus size={16} /> Generar link
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-2.5 text-sm"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Links generados</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Todavía no hay demos.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((r) => {
              const link = r.link || `https://sol.nivel41.com/demo/${r.token}`;
              return (
                <li
                  key={r.token}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {r.company}{" "}
                      <span className="text-xs text-[var(--text-faint)]">· {r.token}</span>
                      {r.public && (
                        <span className="ml-2 rounded-full bg-[var(--violet)]/15 px-2 py-0.5 text-[10px] text-[var(--violet)]">
                          público
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-[var(--text-dim)]">{link}</div>
                    <div className="text-[11px] text-[var(--text-faint)]">
                      {r.public
                        ? "No vence"
                        : `Vence ${new Date(r.expiresAt).toLocaleString("es-AR")}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => copy(link)}
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                    >
                      Copiar
                    </button>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                    >
                      Abrir
                    </a>
                    {!r.public && (
                      <>
                        <button
                          type="button"
                          onClick={() => void extend(r.token)}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs"
                        >
                          +3 días
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(r.token)}
                          className="rounded-lg border border-[var(--red)]/40 px-2.5 py-1 text-xs text-[var(--red)]"
                        >
                          <Trash2 size={12} className="inline" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
