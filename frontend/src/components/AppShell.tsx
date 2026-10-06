"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Pantallas con HTML Stitch a pantalla completa (sin chrome propio)
  const stitchFullBleed = pathname === "/" || pathname === "/monitor";

  if (stitchFullBleed) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 py-5 lg:px-7 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
