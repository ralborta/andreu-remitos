"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { canMutateParametros } from "@/lib/auth-types";

export function ParametrosGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !canMutateParametros(user)) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return <p className="text-sm text-[var(--text-dim)]">Cargando…</p>;
  }
  if (!user || !canMutateParametros(user)) {
    return (
      <p className="text-sm text-[var(--text-dim)]">
        Solo supervisores y administradores pueden acceder a parámetros maestros.
      </p>
    );
  }
  return children;
}
