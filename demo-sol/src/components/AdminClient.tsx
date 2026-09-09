"use client";

import { useEffect, useState } from "react";
import type { DemoRoom } from "@/lib/rooms";

type Props = { initiallyAuthed: boolean; initialRooms: DemoRoom[]; publicBase: string };

export function AdminClient({ initiallyAuthed, initialRooms, publicBase }: Props) {
  const [authed, setAuthed] = useState(initiallyAuthed);
  const [password, setPassword] = useState("");
  const [rooms, setRooms] = useState(initialRooms);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    painPoint: "Remitos / POD",
    days: 3,
    createdBy: "vendedor",
  });
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [base, setBase] = useState(publicBase);

  useEffect(() => {
    if (!publicBase && typeof window !== "undefined") {
      setBase(window.location.origin);
    }
  }, [publicBase]);

  async function refresh() {
    const res = await fetch("/api/admin/rooms");
    if (!res.ok) return;
    const data = await res.json();
    setRooms(data.rooms || []);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Clave incorrecta");
      return;
    }
    setAuthed(true);
    await refresh();
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo crear");
      return;
    }
    const link = `${base || window.location.origin}/r/${data.room.token}`;
    setLastLink(link);
    setForm((f) => ({ ...f, company: "", contactName: "", contactEmail: "", contactPhone: "" }));
    await refresh();
  }

  async function extend(token: string) {
    await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extend", token, days: 3 }),
    });
    await refresh();
  }

  async function remove(token: string) {
    if (!confirm("¿Eliminar esta demo room?")) return;
    await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", token }),
    });
    await refresh();
  }

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6"
        >
          <h1 className="text-xl font-semibold">SOL Demo · Admin vendedor</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Creá salas demo de 3 días para prospectos.
          </p>
          <label className="mt-5 block text-xs text-[var(--text-faint)]">Clave admin</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
          {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 font-semibold text-[#042026]"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Crear Demo Room</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Link único · backoffice demo · vencimiento configurable (default 3 días)
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetch("/api/admin/logout", { method: "POST" }).then(() => setAuthed(false))}
          className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          Salir
        </button>
      </div>

      <form
        onSubmit={createRoom}
        className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:grid-cols-2"
      >
        <Field label="Empresa *">
          <input
            required
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="field"
            placeholder="Transportes ACME"
          />
        </Field>
        <Field label="Contacto *">
          <input
            required
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className="field"
            placeholder="Juan Pérez"
          />
        </Field>
        <Field label="Email">
          <input
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="field"
            placeholder="juan@acme.com"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            className="field"
            placeholder="54911…"
          />
        </Field>
        <Field label="Dolor / foco">
          <select
            value={form.painPoint}
            onChange={(e) => setForm({ ...form, painPoint: e.target.value })}
            className="field"
          >
            <option>Remitos / POD</option>
            <option>Tracking / mapa</option>
            <option>Incidencias / demoras</option>
            <option>Mesa de control completa</option>
            <option>Reclamos</option>
          </select>
        </Field>
        <Field label="Duración (días)">
          <input
            type="number"
            min={1}
            max={14}
            value={form.days}
            onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 3 })}
            className="field"
          />
        </Field>
        {error && (
          <p className="sm:col-span-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 font-semibold text-[#042026]"
          >
            Generar link demo
          </button>
        </div>
      </form>

      {lastLink && (
        <div className="mt-4 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--accent-2)]">
            Link listo para el cliente
          </div>
          <div className="mt-2 break-all font-mono text-sm">{lastLink}</div>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            onClick={() => navigator.clipboard.writeText(lastLink)}
          >
            Copiar link
          </button>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">Rooms creadas</h2>
      <div className="mt-3 space-y-2">
        {rooms.length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">Todavía no hay demos.</p>
        )}
        {rooms.map((r) => {
          const link = `${base || ""}/r/${r.token}`;
          const expired = new Date(r.expiresAt).getTime() <= Date.now();
          return (
            <div
              key={r.token}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
            >
              <div>
                <div className="font-medium">
                  {r.company}{" "}
                  <span className="text-xs text-[var(--text-faint)]">· {r.token}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)]">
                  {r.contactName}
                  {expired ? " · EXPIRADA" : ` · vence ${new Date(r.expiresAt).toLocaleString("es-AR")}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5"
                >
                  Abrir
                </a>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5"
                  onClick={() => navigator.clipboard.writeText(link)}
                >
                  Copiar
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5"
                  onClick={() => extend(r.token)}
                >
                  +3 días
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-[var(--danger)]"
                  onClick={() => remove(r.token)}
                >
                  Borrar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-[var(--text-faint)] [&>input]:mt-1 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-[var(--border)] [&>input]:bg-[var(--bg)] [&>input]:px-3 [&>input]:py-2 [&>input]:outline-none [&>input]:focus:border-[var(--accent)] [&>select]:mt-1 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-[var(--border)] [&>select]:bg-[var(--bg)] [&>select]:px-3 [&>select]:py-2">
      {label}
      {children}
    </label>
  );
}
