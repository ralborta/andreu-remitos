"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Shield, UserPlus, Users } from "lucide-react";
import { createUsuario, listUsuarios } from "@/lib/api";
import type { RolUsuario, SessionUser } from "@/lib/auth-types";
import { ROL_LABEL } from "@/lib/auth-types";
import { Card, PageHeader, SectionTitle } from "./ui";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

export function UsuariosPanel() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolUsuario>("operador");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsuarios();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const login = username.trim();
      await createUsuario({
        username: login,
        password,
        nombre: nombre.trim() || login,
        rol,
      });
      setUsername("");
      setPassword("");
      setNombre("");
      setRol("operador");
      setMsg(`Usuario "${login}" creado`);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios del sistema"
        subtitle="Solo administradores pueden crear cuentas. Operadores usan remitos, contactos y planillas."
        icon={<Users size={24} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Nuevo usuario</SectionTitle>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[var(--text-dim)]">
              Usuario (login)
              <input
                type="text"
                autoComplete="off"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={clsx(inputCls, "mt-1")}
                placeholder="ej: jperez"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--text-dim)]">
              Contraseña
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={clsx(inputCls, "mt-1")}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--text-dim)]">
              Nombre para mostrar
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={clsx(inputCls, "mt-1")}
                placeholder="Opcional"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--text-dim)]">
              Perfil
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as RolUsuario)}
                className={clsx(inputCls, "mt-1")}
              >
                <option value="operador">Operador</option>
                <option value="administrador">Administrador</option>
              </select>
            </label>
            <p className="text-[11px] text-[var(--text-faint)]">
              Operador: todo excepto borrar remitos y crear usuarios. Administrador: acceso completo.
            </p>
            <button
              type="submit"
              disabled={saving || !username.trim() || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
            >
              <UserPlus size={16} />
              {saving ? "Creando…" : "Crear usuario"}
            </button>
            {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          </form>
        </Card>

        <Card>
          <SectionTitle>Cuentas activas ({users.length})</SectionTitle>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--text-dim)]">Cargando…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--text-faint)]">
                    <th className="pb-2 pr-3 font-medium">Usuario</th>
                    <th className="pb-2 pr-3 font-medium">Nombre</th>
                    <th className="pb-2 pr-3 font-medium">Perfil</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)]/60">
                      <td className="py-2.5 pr-3 font-mono text-white">{u.username}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-dim)]">{u.nombre}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                            u.rol === "administrador"
                              ? "bg-[var(--violet)]/20 text-[var(--violet-2)]"
                              : "bg-white/5 text-[var(--text-dim)]",
                          )}
                        >
                          {u.rol === "administrador" && <Shield size={12} />}
                          {ROL_LABEL[u.rol]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
