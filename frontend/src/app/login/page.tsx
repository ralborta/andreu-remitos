"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Brand } from "@/components/Brand";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "No se pudo iniciar sesión");
      }
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Brand size="lg" />
          <p className="text-sm text-[var(--text-dim)]">Mesa de control · Andreu Logística</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[var(--border)] bg-[var(--bg-2)]/80 p-6 shadow-xl backdrop-blur"
        >
          <h1 className="mb-1 text-lg font-semibold text-white">Iniciar sesión</h1>
          <p className="mb-5 text-xs text-[var(--text-faint)]">
            Perfiles: operador, supervisor y administrador
          </p>

          <label className="mb-3 block text-xs font-medium text-[var(--text-dim)]">
            Usuario
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#2a3942] px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
              placeholder="admin"
            />
          </label>

          <label className="mb-5 block text-xs font-medium text-[var(--text-dim)]">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[#2a3942] px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]"
            />
          </label>

          {error && <p className="mb-3 text-xs text-[var(--red)]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-xl bg-[var(--violet)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--violet)]/90 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <LoginForm />
    </Suspense>
  );
}
