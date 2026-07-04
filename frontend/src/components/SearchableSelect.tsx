"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function match(q: string, ...parts: string[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => p.toLowerCase().includes(needle));
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  emptyLabel = "— Seleccionar —",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const extra =
    value.trim() && !options.some((o) => o.value === value.trim())
      ? { value: value.trim(), label: `${value.trim()} (valor actual)` }
      : null;

  const filtered = useMemo(() => {
    const all = extra ? [extra, ...options] : options;
    return all.filter((o) => match(q, o.label, o.value));
  }, [options, extra, q]);

  return (
    <div className={clsx("relative", className)}>
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          className={clsx(inputCls, "pl-8")}
          value={open ? q : selected?.label ?? value}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-2)] py-1 shadow-xl">
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-[var(--text-dim)] hover:bg-white/5"
              onMouseDown={() => {
                onChange("");
                setOpen(false);
                setQ("");
              }}
            >
              {emptyLabel}
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--text-faint)]">Sin resultados</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={clsx(
                    "w-full px-3 py-2 text-left text-sm hover:bg-white/5",
                    o.value === value ? "bg-[var(--violet)]/15 text-white" : "text-[var(--text-dim)]",
                  )}
                  onMouseDown={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
