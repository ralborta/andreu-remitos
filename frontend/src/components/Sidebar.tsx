"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  X,
  FileText,
  Upload,
  ChevronDown,
  MessageCircle,
  Settings2,
  FileSpreadsheet,
  Users,
  Activity,
  ChartColumn,
  Radio,
  Sparkles,
  LogOut,
  Truck,
} from "lucide-react";
import { agents, STATUS_COLOR, STATUS_LABEL } from "@/lib/agents";
import { REMITO_TENANTS } from "@/lib/tenants";
import { useAuth } from "@/lib/auth-context";
import { canMutateParametros, isAdmin, ROL_LABEL } from "@/lib/auth-types";
import { AgentIcon } from "./Icon";
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
  const parametros = canMutateParametros(user);
  const remitosSectionOpen =
    pathname === "/remitos" ||
    pathname.startsWith("/remitos/") ||
    pathname === "/planillas" ||
    pathname.startsWith("/planillas/") ||
    pathname === "/subir" ||
    pathname.startsWith("/subir/") ||
    pathname === "/agentes/remitos" ||
    pathname.startsWith("/agentes/remitos/");
  const [remitosExpanded, setRemitosExpanded] = useState(remitosSectionOpen);
  const activeTenants = REMITO_TENANTS.filter((t) => t.active);

  useEffect(() => {
    if (remitosSectionOpen) setRemitosExpanded(true);
  }, [remitosSectionOpen]);

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
          <p className="px-3 pb-2 pt-2 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Monitoreo
          </p>
          <Link href="/" onClick={onClose} className={navClass(isActive("/"))}>
            <LayoutDashboard size={18} />
            Torre de Control
          </Link>
          <Link href="/monitor" onClick={onClose} className={navClass(isActive("/monitor"))}>
            <Activity size={18} />
            Monitor Flota
          </Link>
          <Link href="/contactos" onClick={onClose} className={navClass(isActive("/contactos"))}>
            <MessageCircle size={18} />
            <span className="flex-1">WhatsApp</span>
            <span className="rounded-full bg-[#6ffbbe]/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#005236]">
              Nuevo
            </span>
          </Link>
          {admin && (
            <Link href="/backoffice" onClick={onClose} className={navClass(isActive("/backoffice"))}>
              <ChartColumn size={18} />
              Métricas
            </Link>
          )}

          <p className="px-3 pb-2 pt-5 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Agentes
          </p>

          {agents
            .filter((a) => a.slug !== "commander")
            .map((a) => {
              const href = `/agentes/${a.slug}`;
              const isRemitosAgent = a.slug === "remitos";
              const active = isRemitosAgent ? remitosSectionOpen : isActive(href);

              if (isRemitosAgent) {
                return (
                  <div key={a.slug} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() => setRemitosExpanded((v) => !v)}
                      className={clsx(navClass(active), "w-full")}
                    >
                      <span
                        className={clsx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-white/15 text-white" : "bg-[var(--panel-2)] text-[var(--text-dim)]",
                        )}
                      >
                        <AgentIcon name={a.icon} size={15} />
                      </span>
                      <span className="flex-1 truncate text-left">{a.short}</span>
                      <ChevronDown
                        size={16}
                        className={clsx("shrink-0 transition-transform", remitosExpanded && "rotate-180")}
                      />
                    </button>
                    {remitosExpanded && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border-soft)] pl-2">
                        <Link
                          href="/agentes/remitos"
                          onClick={onClose}
                          className={clsx(
                            "block rounded-lg px-3 py-2 text-sm transition-colors",
                            pathname.startsWith("/agentes/remitos")
                              ? "bg-[var(--panel-2)] font-medium text-[var(--text)]"
                              : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]",
                          )}
                        >
                          Resumen del agente
                        </Link>
                        <Link
                          href="/remitos"
                          onClick={onClose}
                          className={clsx(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            pathname === "/remitos" || pathname.startsWith("/remitos/")
                              ? "bg-[var(--panel-2)] font-medium text-[var(--text)]"
                              : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]",
                          )}
                        >
                          <FileText size={14} className="shrink-0 opacity-70" />
                          Remitos
                        </Link>
                        {activeTenants.map((t) => {
                          const planillaHref = `/planillas/${t.slug}`;
                          return (
                            <Link
                              key={`planilla-${t.slug}`}
                              href={planillaHref}
                              onClick={onClose}
                              className={clsx(
                                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                                pathname.startsWith(planillaHref)
                                  ? "bg-[var(--panel-2)] font-medium text-[var(--text)]"
                                  : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]",
                              )}
                            >
                              <FileSpreadsheet size={14} className="shrink-0 opacity-70" />
                              {activeTenants.length === 1 ? "Planilla" : `Planilla ${t.short}`}
                            </Link>
                          );
                        })}
                        <Link
                          href="/subir"
                          onClick={onClose}
                          className={clsx(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive("/subir")
                              ? "bg-[var(--panel-2)] font-medium text-[var(--text)]"
                              : "text-[var(--text-dim)] hover:bg-[var(--panel-2)]",
                          )}
                        >
                          <Upload size={14} className="shrink-0 opacity-70" />
                          Subir remito
                        </Link>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link key={a.slug} href={href} onClick={onClose} className={navClass(active)}>
                  <span
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-white/15 text-white" : "bg-[var(--panel-2)] text-[var(--text-dim)]",
                    )}
                  >
                    <AgentIcon name={a.icon} size={15} />
                  </span>
                  <span className="flex-1 truncate">{a.short}</span>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    title={STATUS_LABEL[a.status]}
                    style={{ background: STATUS_COLOR[a.status] }}
                  />
                </Link>
              );
            })}

          <p className="px-3 pb-2 pt-5 font-mono-label text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Operación
          </p>
          <Link
            href="/agentes/commander"
            onClick={onClose}
            className={navClass(isActive("/agentes/commander"))}
          >
            <Radio size={18} />
            Chat Central
          </Link>
          {admin && (
            <Link href="/usuarios" onClick={onClose} className={navClass(isActive("/usuarios"))}>
              <Users size={18} />
              Usuarios
            </Link>
          )}
          {parametros && (
            <Link href="/parametros" onClick={onClose} className={navClass(isActive("/parametros"))}>
              <Settings2 size={18} />
              Parámetros
            </Link>
          )}
          <Link href="/salas-demo" onClick={onClose} className={navClass(isActive("/salas-demo"))}>
            <Sparkles size={18} />
            <span className="flex-1">DEMO</span>
          </Link>
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
