"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  X,
  ChevronDown,
  LogOut,
  Truck,
  FileText,
  Wallet,
  Megaphone,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAdmin, ROL_LABEL } from "@/lib/auth-types";
import { Brand } from "./Brand";
import { BRAND } from "@/lib/brand";

function navClass(active: boolean) {
  return clsx(
    "group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
    active
      ? "nav-active"
      : "text-[var(--text-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]",
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const admin = isAdmin(user);
  
  // Determinar qué secciones están activas
  const operacionActive = 
    pathname === "/" || 
    pathname === "/contactos" || 
    pathname === "/agentes/viajes" || 
    pathname === "/agentes/tracking" ||
    pathname === "/agentes/incidencias";
  
  const documentacionActive =
    pathname.startsWith("/agentes/remitos") ||
    pathname === "/agentes/pod" ||
    pathname === "/agentes/rendicion" ||
    pathname === "/agentes/reclamos";
  
  const finanzasActive = pathname.startsWith("/finanzas");
  const marketingActive = pathname.startsWith("/marketing");
  const sistemaActive = 
    pathname === "/monitor" || 
    pathname === "/backoffice" || 
    pathname.startsWith("/agentes/commander");
  
  // Estados de expansión
  const [operacionExpanded, setOperacionExpanded] = useState(operacionActive);
  const [documentacionExpanded, setDocumentacionExpanded] = useState(documentacionActive);
  const [finanzasExpanded, setFinanzasExpanded] = useState(finanzasActive);
  const [marketingExpanded, setMarketingExpanded] = useState(marketingActive);
  const [sistemaExpanded, setSistemaExpanded] = useState(sistemaActive);

  useEffect(() => {
    if (operacionActive) setOperacionExpanded(true);
  }, [operacionActive]);

  useEffect(() => {
    if (documentacionActive) setDocumentacionExpanded(true);
  }, [documentacionActive]);

  useEffect(() => {
    if (finanzasActive) setFinanzasExpanded(true);
  }, [finanzasActive]);

  useEffect(() => {
    if (marketingActive) setMarketingExpanded(true);
  }, [marketingActive]);
  
  useEffect(() => {
    if (sistemaActive) setSistemaExpanded(true);
  }, [sistemaActive]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-[var(--text)]/30 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--panel)] shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--violet)] text-white shadow-[var(--shadow-primary)]">
              <Truck size={18} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <Brand variant="product" size="sm" onLight />
                <span className="rounded-full bg-[#39b8fd]/25 px-1.5 py-0.5 font-mono-label text-[10px] font-semibold uppercase text-[#004666]">
                  {BRAND.shortName}
                </span>
              </span>
              <span className="block font-mono-label text-[10px] text-[var(--text-faint)]">
                Control Tower
              </span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--panel-2)] lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-4">
          {/* Operación */}
          <p className="px-3 pb-2 pt-2 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Operación
          </p>
          <div className="mb-0.5">
            <button
              type="button"
              onClick={() => setOperacionExpanded((v) => !v)}
              className={clsx(navClass(operacionActive), "w-full")}
            >
              <Truck size={18} />
              <span className="flex-1 text-left">Operación</span>
              <ChevronDown
                size={14}
                className={clsx("shrink-0 transition-transform", operacionExpanded && "rotate-180")}
              />
            </button>
            {operacionExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                <Link href="/" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Torre de Control
                </Link>
                <Link href="/agentes/viajes" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/viajes" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Viajes
                </Link>
                <Link href="/agentes/tracking" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/tracking" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Tracking
                </Link>
                <Link href="/agentes/incidencias" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/incidencias" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Incidencias
                </Link>
                <Link href="/contactos" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/contactos" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  WhatsApp
                </Link>
              </div>
            )}
          </div>

          {/* Documentación */}
          <p className="px-3 pb-2 pt-4 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Documentación
          </p>
          <div className="mb-0.5">
            <button
              type="button"
              onClick={() => setDocumentacionExpanded((v) => !v)}
              className={clsx(navClass(documentacionActive), "w-full")}
            >
              <FileText size={18} />
              <span className="flex-1 text-left">Documentación</span>
              <ChevronDown
                size={14}
                className={clsx("shrink-0 transition-transform", documentacionExpanded && "rotate-180")}
              />
            </button>
            {documentacionExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                <Link href="/agentes/remitos" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/agentes/remitos") ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Remitos
                </Link>
                <Link href="/agentes/pod" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/pod" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  POD
                </Link>
                <Link href="/agentes/rendicion" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/rendicion" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Rendición
                </Link>
                <Link href="/agentes/reclamos" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/agentes/reclamos" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Reclamos
                </Link>
              </div>
            )}
          </div>

          {/* Finanzas */}
          <p className="px-3 pb-2 pt-4 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Finanzas
          </p>
          <div className="mb-0.5">
            <button
              type="button"
              onClick={() => setFinanzasExpanded((v) => !v)}
              className={clsx(navClass(finanzasActive), "w-full")}
            >
              <Wallet size={18} />
              <span className="flex-1 text-left">Finanzas</span>
              <ChevronDown
                size={14}
                className={clsx("shrink-0 transition-transform", finanzasExpanded && "rotate-180")}
              />
            </button>
            {finanzasExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                <Link href="/finanzas/facturas/pagos" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/finanzas/facturas/pagos") ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Facturas de pago
                </Link>
                <Link href="/finanzas/facturas/cobro" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/finanzas/facturas/cobro" || pathname.startsWith("/finanzas/facturas/cobro/")
                    ? "bg-[var(--panel-2)] font-medium text-[var(--text)]"
                    : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Facturas de cobranza
                </Link>
                <Link href="/finanzas/facturas/cobranzas" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/finanzas/facturas/cobranzas") ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Gestión de cobranza
                </Link>
                <Link href="/finanzas/conciliacion" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/finanzas/conciliacion" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Conciliación
                </Link>
              </div>
            )}
          </div>

          {/* Marketing */}
          <p className="px-3 pb-2 pt-4 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Marketing
          </p>
          <div className="mb-0.5">
            <button
              type="button"
              onClick={() => setMarketingExpanded((v) => !v)}
              className={clsx(navClass(marketingActive), "w-full")}
            >
              <Megaphone size={18} />
              <span className="flex-1 text-left">Marketing</span>
              <ChevronDown
                size={14}
                className={clsx("shrink-0 transition-transform", marketingExpanded && "rotate-180")}
              />
            </button>
            {marketingExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                <Link href="/marketing" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/marketing" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Hub
                </Link>
                <Link href="/marketing/estrategia" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/marketing/estrategia" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Campañas
                </Link>
                <Link href="/marketing/visibilidad" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/marketing/visibilidad" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Rankear
                </Link>
              </div>
            )}
          </div>

          {/* Sistema */}
          <p className="px-3 pb-2 pt-4 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Sistema
          </p>
          <div className="mb-0.5">
            <button
              type="button"
              onClick={() => setSistemaExpanded((v) => !v)}
              className={clsx(navClass(sistemaActive), "w-full")}
            >
              <Settings2 size={18} />
              <span className="flex-1 text-left">Sistema</span>
              <ChevronDown
                size={14}
                className={clsx("shrink-0 transition-transform", sistemaExpanded && "rotate-180")}
              />
            </button>
            {sistemaExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                <Link href="/monitor" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/monitor" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Monitor
                </Link>
                {admin && (
                  <Link href="/backoffice" onClick={onClose} className={clsx(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname === "/backoffice" ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                  )}>
                    Métricas
                  </Link>
                )}
                <Link href="/agentes/commander" onClick={onClose} className={clsx(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname.startsWith("/agentes/commander") ? "bg-[var(--panel-2)] font-medium text-[var(--text)]" : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]"
                )}>
                  Chat Central
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="bg-[var(--bg-2)] p-3">
          <div className="flex items-center gap-3 rounded-lg bg-[var(--panel)] p-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--violet)] text-sm font-bold text-white">
              {(user?.nombre || user?.username || "?").slice(0, 2).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#6ffbbe] ring-2 ring-[var(--panel)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                {user?.nombre || "Usuario"}
              </p>
              <p className="truncate font-mono-label text-[10px] text-[var(--text-faint)]">
                {user ? ROL_LABEL[user.rol] : "—"} · Activo
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
