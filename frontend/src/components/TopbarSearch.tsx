"use client";

import { Search } from "lucide-react";
import { useRemitosBusqueda } from "@/hooks/useRemitosBusqueda";

export function TopbarSearch() {
  const { query, setQuery } = useRemitosBusqueda();

  return (
    <div className="relative min-w-0 flex-1 max-w-md">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nº remito, chofer o patente…"
        aria-label="Buscar remitos"
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--violet)] focus:ring-1 focus:ring-[var(--violet)]/40"
      />
    </div>
  );
}
