import type { ReactNode } from "react";

/** Mapa embebible sin AppShell — para la tarjeta de Torre Stitch. */
export default function EmbedFleetMapLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#eef2f7]">{children}</div>
  );
}
