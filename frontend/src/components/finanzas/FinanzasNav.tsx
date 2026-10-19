"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Banknote,
  Scale,
  MessageCircle,
} from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/finanzas", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/finanzas/facturas", label: "Facturas", icon: FileText },
  { href: "/finanzas/cobranzas", label: "Cobranzas", icon: Banknote },
  { href: "/finanzas/conciliacion", label: "Conciliación", icon: Scale },
  { href: "/finanzas/comunicacion", label: "Comunicación", icon: MessageCircle },
] as const;

export function FinanzasNav() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--violet)] text-white shadow-[var(--shadow-primary)]"
                : "text-[var(--text-dim)] hover:bg-[var(--panel-2)] hover:text-white",
            )}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
