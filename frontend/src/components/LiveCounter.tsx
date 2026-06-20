"use client";

import { useEffect, useState } from "react";

/**
 * Muestra un número entero que sube de a poco para dar sensación de
 * actividad en vivo. Comienza en `start` y nunca baja.
 */
export function LiveCounter({
  start,
  stepMax = 2,
  intervalMs = 5000,
  suffix = "",
  prefix = "",
}: {
  start: number;
  stepMax?: number;
  intervalMs?: number;
  suffix?: string;
  prefix?: string;
}) {
  const [n, setN] = useState(start);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => v + 1 + Math.floor(Math.random() * stepMax));
      setBump(true);
      setTimeout(() => setBump(false), 400);
    }, intervalMs);
    return () => clearInterval(t);
  }, [stepMax, intervalMs]);

  return (
    <span
      className="tabular inline-block transition-colors"
      style={{ color: bump ? "#a78bfa" : undefined }}
    >
      {prefix}
      {n.toLocaleString("es-AR")}
      {suffix}
    </span>
  );
}
