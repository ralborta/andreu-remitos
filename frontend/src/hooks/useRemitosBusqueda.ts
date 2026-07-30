"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Búsqueda global de remitos (Topbar + panel), persistida en ?q= */
export function useRemitosBusqueda() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const [query, setQueryLocal] = useState(qParam);

  useEffect(() => {
    setQueryLocal(qParam);
  }, [qParam]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryLocal(value);
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      const onRemitos = pathname.startsWith("/remitos");
      const target = onRemitos ? `${pathname}${qs ? `?${qs}` : ""}` : `/remitos${qs ? `?${qs}` : ""}`;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const queryActive = query.trim().length >= 3;

  return { query, setQuery, queryActive };
}
