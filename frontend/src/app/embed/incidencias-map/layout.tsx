import type { ReactNode } from "react";

export default function EmbedIncidenciasMapLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-[#0e1738]">{children}</div>;
}
