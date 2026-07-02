"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/auth-types";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !isAdmin(user)) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return <p className="text-sm text-[var(--text-dim)]">Cargando…</p>;
  }
  if (!user || !isAdmin(user)) {
    return (
      <p className="text-sm text-[var(--text-dim)]">
        Solo administradores pueden acceder a esta sección.
      </p>
    );
  }
  return children;
}
