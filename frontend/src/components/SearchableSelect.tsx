"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Search } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function match(q: string, ...parts: string[]) {
  const needle = norm(q);
  if (!needle) return true;
  return parts.some((p) => norm(p).includes(needle));
}

function patenteBase(valor: string) {
  return valor.trim().replace(/\s*[-·/].*$/, "").trim();
}

function findSelected(options: { value: string; label: string }[], value: string) {
  const v = value.trim();
  if (!v) return null;
  const exact = options.find((o) => o.value === v);
  if (exact) return exact;
  const base = patenteBase(v);
  if (base.length >= 5) {
    return options.find((o) => o.value === base || patenteBase(o.value) === base) ?? null;
  }
  return options.find((o) => norm(o.value) === norm(v) || norm(o.label).startsWith(norm(v))) ?? null;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = findSelected(options, value);
  const extra =
    value.trim() && !selected
      ? { value: value.trim(), label: `${value.trim()} (valor actual)` }
      : null;

  const filtered = useMemo(() => {
    const all = extra ? [extra, ...options] : options;
    return all.filter((o) => match(q, o.label, o.value));
  }, [options, extra, q]);

  const updatePos = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePos]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQ("");
  }

  const dropdown =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        className="fixed z-[200] max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-2)] py-1 shadow-xl"
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <li>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-[var(--text-dim)] hover:bg-white/5"
            onClick={() => pick("")}
          >
            {emptyLabel}
          </button>
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-[var(--text-faint)]">Sin resultados</li>
        ) : (
          filtered.map((o) => (
            <li key={`${o.value}::${o.label}`}>
              <button
                type="button"
                className={clsx(
                  "w-full px-3 py-2 text-left text-sm hover:bg-white/5",
                  o.value === value || selected?.value === o.value
                    ? "bg-[var(--violet)]/15 text-white"
                    : "text-[var(--text-dim)]",
                )}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))
        )}
      </ul>,
      document.body,
    );

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
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
            updatePos();
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            updatePos();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>
      {dropdown}
    </div>
  );
}
