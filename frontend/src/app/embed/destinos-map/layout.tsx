import type { ReactNode } from "react";

export default function EmbedDestinosMapLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-[#eef2f6]">{children}</div>;
}
