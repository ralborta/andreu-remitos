"use client";

import { Menu, Bell, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveClock } from "./LiveClock";
import { Brand } from "./Brand";

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

interface SystemStatus {
  ok: boolean;
  services: {
    whatsapp: {
      ok: boolean;
      status: string;
    };
    api: {
      ok: boolean;
    };
    bot: {
      ok: boolean;
    };
  };
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    
    async function fetchStatus() {
      try {
        const res = await fetch("/api/monitor/status");
        if (res.ok) {
          const data = await res.json();
          setSystemStatus(data);
        }
      } catch (err) {
        console.error("Error fetching system status:", err);
      }
    }
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-[var(--text-dim)] hover:bg-[var(--overlay-strong)] lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--text-dim)]">
            Torre de Control · flota, remitos y agentes
          </p>
          <span className="hidden shrink-0 rounded-full bg-[var(--violet)]/15 px-2 py-0.5 font-mono-label text-[10px] font-semibold uppercase text-[var(--violet)] sm:inline">
            Borrador UI
          </span>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center justify-end gap-3">
        {systemStatus && (() => {
          const waOk = systemStatus.services?.whatsapp?.ok ?? false;
          const apiOk = systemStatus.services?.api?.ok ?? true;
          const allOk = systemStatus.ok && waOk && apiOk;
          
          const statusColor = allOk 
            ? "bg-emerald-500" 
            : waOk 
            ? "bg-amber-500" 
            : "bg-rose-500";
            
          const statusText = allOk
            ? "Sistemas activos"
            : !waOk
            ? "WhatsApp caído"
            : "Servicios degradados";
          
          return (
            <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className={`dot-pulse absolute inline-flex h-2 w-2 rounded-full ${statusColor}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
              </span>
              <span className="text-xs font-medium text-[var(--text-dim)]">
                {statusText}
              </span>
            </div>
          );
        })()}

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

        <div className="ml-1 hidden border-l border-[var(--border)] pl-3 sm:block">
          <Brand variant="company" size="md" />
        </div>
        <div className="sm:hidden">
          <Brand variant="company" size="sm" />
        </div>
      </div>
    </header>
  );
}
