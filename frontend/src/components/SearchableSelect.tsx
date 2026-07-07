"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Search } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--violet)]";

const MAX_SIN_BUSCAR = 20;
const MAX_RESULTADOS = 50;

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
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

type OptionRow = { value: string; label: string; searchKey: string };

const DropdownList = memo(function DropdownList({
  top,
  left,
  width,
  filtered,
  totalMatches,
  value,
  selectedValue,
  emptyLabel,
  onPick,
}: {
  top: number;
  left: number;
  width: number;
  filtered: OptionRow[];
  totalMatches: number;
  value: string;
  selectedValue?: string;
  emptyLabel: string;
  onPick: (v: string) => void;
}) {
  return (
    <ul
      className="fixed z-[200] max-h-52 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-2)] py-1 shadow-xl"
      style={{ top, left, width }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <li>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-[var(--text-dim)] hover:bg-white/5"
          onClick={() => onPick("")}
        >
          {emptyLabel}
        </button>
      </li>
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-xs text-[var(--text-faint)]">Sin resultados</li>
      ) : (
        <>
          {filtered.map((o) => (
            <li key={`${o.value}::${o.label}`}>
              <button
                type="button"
                className={clsx(
                  "w-full px-3 py-2 text-left text-sm hover:bg-white/5",
                  o.value === value || o.value === selectedValue
                    ? "bg-[var(--violet)]/15 text-white"
                    : "text-[var(--text-dim)]",
                )}
                onClick={() => onPick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
          {totalMatches > filtered.length && (
            <li className="border-t border-[var(--border-soft)] px-3 py-2 text-[10px] text-[var(--text-faint)]">
              +{totalMatches - filtered.length} más — escribí para acotar
            </li>
          )}
        </>
      )}
    </ul>
  );
});

export const SearchableSelect = memo(function SearchableSelect({
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
  const rafRef = useRef<number | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const indexed = useMemo<OptionRow[]>(
    () => options.map((o) => ({ ...o, searchKey: norm(`${o.label} ${o.value}`) })),
    [options],
  );

  const selected = useMemo(() => findSelected(options, value), [options, value]);

  const pool = useMemo(() => {
    if (!value.trim() || selected) return indexed;
    const extra: OptionRow = {
      value: value.trim(),
      label: `${value.trim()} (valor actual)`,
      searchKey: norm(value),
    };
    if (indexed.some((o) => o.value === extra.value)) return indexed;
    return [extra, ...indexed];
  }, [indexed, value, selected]);

  const { filtered, totalMatches } = useMemo(() => {
    const needle = norm(q);
    let hits: OptionRow[];
    if (!needle) {
      hits = pool.slice(0, MAX_SIN_BUSCAR);
      return { filtered: hits, totalMatches: pool.length };
    }
    hits = pool.filter((o) => o.searchKey.includes(needle));
    return { filtered: hits.slice(0, MAX_RESULTADOS), totalMatches: hits.length };
  }, [pool, q]);

  const schedulePos = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    schedulePos();
    const onScroll = () => schedulePos();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [open, schedulePos]);

  const pick = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      setQ("");
    },
    [onChange],
  );

  const hintSinBuscar = pool.length > MAX_SIN_BUSCAR && !q.trim();

  const dropdown =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        {hintSinBuscar && (
          <div
            className="fixed z-[199] rounded-t-lg border border-b-0 border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-[10px] text-[var(--text-faint)]"
            style={{ top: pos.top - 22, left: pos.left, width: pos.width }}
          >
            Escribí para buscar entre {pool.length} opciones
          </div>
        )}
        <DropdownList
          top={pos.top}
          left={pos.left}
          width={pos.width}
          filtered={filtered}
          totalMatches={totalMatches}
          value={value}
          selectedValue={selected?.value}
          emptyLabel={emptyLabel}
          onPick={pick}
        />
      </>,
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
            schedulePos();
          }}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>
      {dropdown}
    </div>
  );
});
