"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Wallet,
  Scale,
  Send,
  Receipt,
} from "lucide-react";
import clsx from "clsx";

const OPERACIONES = [
  { href: "/finanzas", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/finanzas/facturas", label: "Facturas", icon: FileText },
  { href: "/finanzas/clientes", label: "Clientes", icon: Users },
  { href: "/finanzas/ingresos", label: "Ingresos", icon: Wallet },
];

const COMUNICACIONES = [
  { href: "/finanzas/comunicacion", label: "Enviar Mensaje", icon: Send },
];

const COBROS = [
  { href: "/finanzas/ingresos", label: "Transferencias", icon: Wallet },
  { href: "/finanzas/conciliacion", label: "Conciliación de Cobros", icon: Scale },
  { href: "/finanzas/echeques", label: "E-cheques", icon: Receipt },
];

function Item({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-[var(--violet)] text-white" : "text-[var(--text-dim)] hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
      {children}
    </p>
  );
}

export function FinanzasNav() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] px-2 py-3">
      <div className="mb-2 px-3 py-2">
        <p className="text-sm font-bold text-white">Finanzas</p>
        <p className="text-[10px] text-[var(--text-faint)]">Gestión de Cobranzas</p>
      </div>
      <nav className="space-y-0.5">
        <Label>Operaciones</Label>
        {OPERACIONES.map((i) => (
          <Item key={i.label} {...i} />
        ))}
        <Label>Comunicaciones</Label>
        {COMUNICACIONES.map((i) => (
          <Item key={i.href} {...i} />
        ))}
        <Label>Finanzas</Label>
        {COBROS.map((i) => (
          <Item key={i.label} {...i} />
        ))}
      </nav>
    </aside>
  );
}
