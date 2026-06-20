"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { baseActivity, liveTemplates, type ActivityEvent } from "@/lib/data";

const LEVEL: Record<ActivityEvent["level"], { dot: string; ring: string }> = {
  info: { dot: "#38bdf8", ring: "#38bdf833" },
  ok: { dot: "#22c55e", ring: "#22c55e33" },
  warn: { dot: "#f59e0b", ring: "#f59e0b33" },
  alert: { dot: "#ef4444", ring: "#ef444433" },
};

function nowTime() {
  return new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const [events, setEvents] = useState<ActivityEvent[]>(baseActivity);

  useEffect(() => {
    let id = 1000;
    const t = setInterval(() => {
      const tpl = liveTemplates[Math.floor(Math.random() * liveTemplates.length)];
      setEvents((prev) => {
        const next: ActivityEvent = { ...tpl, id: id++, time: nowTime() };
        return [next, ...prev].slice(0, 14);
      });
    }, 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-1">
      {events.map((e, i) => {
        const c = LEVEL[e.level];
        const isNew = i === 0;
        return (
          <div
            key={e.id}
            className={clsx(
              "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
              isNew ? "animate-in bg-[var(--violet)]/8" : "hover:bg-white/[0.03]",
            )}
          >
            <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
              {isNew && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full"
                  style={{ background: c.dot, opacity: 0.6 }}
                />
              )}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: c.dot, boxShadow: `0 0 0 3px ${c.ring}` }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-[var(--text)]">{e.text}</p>
              {!compact && (
                <p className="mt-0.5 text-xs text-[var(--text-faint)]">
                  {e.agent}
                </p>
              )}
            </div>
            <span className="tabular shrink-0 text-xs text-[var(--text-faint)]">
              {e.time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
