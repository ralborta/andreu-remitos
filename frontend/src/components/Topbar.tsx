"use client";

import { useEffect, useState } from "react";
import { Menu, Search, Bell, Moon, Sun } from "lucide-react";
import { LiveClock } from "./LiveClock";

const THEME_KEY = "andreu-theme";

function readTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  localStorage.setItem(THEME_KEY, theme);
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          placeholder="Buscar viaje, chofer, remito, cliente…"
          className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--violet)] focus:ring-1 focus:ring-[var(--violet)]/40"
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-3 sm:flex-none">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="dot-pulse absolute inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--green)]" />
          </span>
          <span className="text-xs font-medium text-[var(--text-dim)]">Sistemas activos</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "light" ? "Tema oscuro" : "Tema claro"}
          className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] hover:text-[var(--text)]"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button className="relative rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] hover:text-[var(--text)]">
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--magenta)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--magenta)]" />
          </span>
        </button>

        <LiveClock />
      </div>
    </header>
  );
}
