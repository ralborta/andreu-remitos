import type { ReactNode } from "react";

/** Layout público sin AppShell ni auth — mobile-first PWA chofer. */
export default function TrackingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]" data-tracking-app>
      {children}
    </div>
  );
}
