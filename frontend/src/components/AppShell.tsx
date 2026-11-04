"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { isStitchRedesignPath } from "@/lib/stitch-redesign";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Pantallas con HTML Stitch a pantalla completa (sin chrome propio)
  const stitchFullBleed = isStitchRedesignPath(pathname);

  // Listen for navigation messages from Stitch iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'stitch-navigate') {
        const href = event.data.href;
        if (typeof href === 'string' && href.startsWith('/')) {
          // Acknowledge receipt
          event.source?.postMessage({ type: 'stitch-navigate-ack' }, event.origin as any);
          // Client-side navigation (no page reload)
          router.push(href);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

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
