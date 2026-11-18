"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Menu, Bell, Moon, Sun } from "lucide-react";
import { LiveClock } from "./LiveClock";
import { TopbarSearch } from "./TopbarSearch";
import { fetchMonitorStatus } from "@/lib/api";
import type { MonitorStatus } from "@/lib/monitor-types";

const THEME_KEY = "andreu-theme";
const POLL_INTERVAL = 30_000; // Check system health every 30s

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
  const [systemHealth, setSystemHealth] = useState<{ ok: boolean; loading: boolean }>({ ok: true, loading: true });

  const checkHealth = useCallback(async () => {
    try {
      const status: MonitorStatus = await fetchMonitorStatus();
      setSystemHealth({ ok: status.ok, loading: false });
    } catch {
      // On error, assume degraded (don't spam console in demo mode)
      setSystemHealth({ ok: false, loading: false });
    }
  }, []);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  useEffect(() => {
    void checkHealth();
    const interval = setInterval(() => void checkHealth(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkHealth]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  const statusColor = systemHealth.loading ? "#a78bfa" : systemHealth.ok ? "#22c55e" : "#f59e0b";
  const statusText = systemHealth.loading ? "Verificando..." : systemHealth.ok ? "Sistemas activos" : "Sistema degradado";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] lg:hidden"
      >
        <Menu size={20} />
      </button>

      <Suspense
        fallback={
          <div className="h-9 min-w-0 flex-1 max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)]" />
        }
      >
        <TopbarSearch />
      </Suspense>

      <div className="flex flex-1 items-center justify-end gap-3 sm:flex-none">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 sm:flex">
          <span className="relative flex h-2 w-2">
            <span 
              className="dot-pulse absolute inline-flex h-2 w-2 rounded-full" 
              style={{ backgroundColor: statusColor }}
            />
            <span 
              className="relative inline-flex h-2 w-2 rounded-full" 
              style={{ backgroundColor: statusColor }}
            />
          </span>
          <span className="text-xs font-medium text-[var(--text-dim)]">{statusText}</span>
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
