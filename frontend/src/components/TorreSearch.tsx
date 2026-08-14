"use client";

import { Search } from "lucide-react";
import { useRemitosBusqueda } from "@/hooks/useRemitosBusqueda";

/** Búsqueda general SOL (Torre de Control) — remitos / chofer / patente. */
export function TorreSearch() {
  const { query, setQuery } = useRemitosBusqueda();

  return (
    <div className="panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        Búsqueda general SOL
      </p>
      <p className="mt-1 text-sm text-[var(--text-dim)]">
        Buscá en remitos por número, chofer o patente. Los buscadores de cada agente siguen en su
        pantalla.
      </p>
      <div className="relative mt-3">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nº remito, chofer o patente…"
          aria-label="Búsqueda general SOL"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] pl-10 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--violet)] focus:ring-1 focus:ring-[var(--violet)]/40"
        />
      </div>
    </div>
  );
}
