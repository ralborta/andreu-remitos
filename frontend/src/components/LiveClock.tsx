"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const frame = window.requestAnimationFrame(update);
    const t = setInterval(update, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      clearInterval(t);
    };
  }, []);

  if (!now) {
    return <span className="tabular text-sm text-[var(--text-dim)]">--:--:--</span>;
  }

  const fecha = now.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const hora = now.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="hidden flex-col items-end leading-tight md:flex">
      <span className="tabular text-sm font-semibold text-white">{hora}</span>
      <span className="text-[11px] capitalize text-[var(--text-faint)]">
        {fecha}
      </span>
    </div>
  );
}
