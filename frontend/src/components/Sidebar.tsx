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
} from "lucide-react";
import { agents, STATUS_COLOR, STATUS_LABEL } from "@/lib/agents";
import { REMITO_TENANTS } from "@/lib/tenants";
import { useAuth } from "@/lib/auth-context";
import { canMutateParametros, isAdmin, ROL_LABEL } from "@/lib/auth-types";
import { AgentIcon } from "./Icon";
import { Brand } from "./Brand";
import { LogOut } from "lucide-react";

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
      {/* overlay mobile */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[var(--border)] bg-[var(--bg-2)]/95 backdrop-blur-xl transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Brand variant="product" size="sm" />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-white/5 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-4">
          <Link
            href="/"
            onClick={onClose}
            className={clsx(
              "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/")
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
            )}
          >
            <LayoutDashboard size={18} />
            Torre de Control
          </Link>

          <Link
            href="/monitor"
            onClick={onClose}
            className={clsx(
              "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/monitor")
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
            )}
          >
            <Activity size={18} />
            Monitor
          </Link>

          <Link
            href="/contactos"
            onClick={onClose}
            className={clsx(
              "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/contactos")
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
            )}
          >
            <MessageCircle size={18} />
            <span className="flex-1">WhatsApp</span>
            <span className="rounded-full bg-[#25d366]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#25d366]">
              Nuevo
            </span>
          </Link>

          {admin && (
            <Link
              href="/backoffice"
              onClick={onClose}
              className={clsx(
                "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive("/backoffice")
                  ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
              )}
            >
              <ChartColumn size={18} />
              Métricas
            </Link>
          )}

          <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Agentes
          </p>

          {agents.map((a) => {
            const href = `/agentes/${a.slug}`;
            const isRemitosAgent = a.slug === "remitos";
            const active = isRemitosAgent
              ? remitosSectionOpen
              : isActive(href);

            if (isRemitosAgent) {
              return (
                <div key={a.slug} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => setRemitosExpanded((v) => !v)}
                    className={clsx(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                        : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        active
                          ? "bg-[var(--violet)]/25 text-[var(--violet-2)]"
                          : "bg-white/5 text-[var(--text-dim)] group-hover:text-white",
                      )}
                    >
                      <AgentIcon name={a.icon} size={15} />
                    </span>
                    <span className="flex-1 truncate text-left">{a.short}</span>
                    <ChevronDown
                      size={16}
                      className={clsx(
                        "shrink-0 transition-transform",
                        remitosExpanded ? "rotate-180" : "",
                      )}
                    />
                  </button>
                  {remitosExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--border)] pl-2">
                      <Link
                        href="/agentes/remitos"
                        onClick={onClose}
                        className={clsx(
                          "block rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/agentes/remitos" ||
                            pathname.startsWith("/agentes/remitos/")
                            ? "bg-white/10 font-medium text-white"
                            : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                        )}
                      >
                        Resumen del agente
                      </Link>
                      <Link
                        href="/remitos"
                        onClick={onClose}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          pathname === "/remitos" ||
                            pathname.startsWith("/remitos/")
                            ? "bg-white/10 font-medium text-white"
                            : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <FileText size={14} className="shrink-0 opacity-70" />
                        Remitos
                      </Link>
                      {activeTenants.map((t) => {
                        const planillaHref = `/planillas/${t.slug}`;
                        const planillaActive = pathname.startsWith(planillaHref);
                        const label =
                          activeTenants.length === 1
                            ? "Planilla"
                            : `Planilla ${t.short}`;
                        return (
                          <Link
                            key={`planilla-${t.slug}`}
                            href={planillaHref}
                            onClick={onClose}
                            className={clsx(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                              planillaActive
                                ? "bg-white/10 font-medium text-white"
                                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                            )}
                          >
                            <FileSpreadsheet
                              size={14}
                              className="shrink-0 opacity-70"
                            />
                            {label}
                          </Link>
                        );
                      })}
                      <Link
                        href="/subir"
                        onClick={onClose}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive("/subir")
                            ? "bg-white/10 font-medium text-white"
                            : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
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
              <Link
                key={a.slug}
                href={href}
                onClick={onClose}
                className={clsx(
                  "group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                    : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                )}
              >
                <span
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-[var(--violet)]/25 text-[var(--violet-2)]"
                      : "bg-white/5 text-[var(--text-dim)] group-hover:text-white",
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

          <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Operación
          </p>
          {admin && (
            <Link
              href="/usuarios"
              onClick={onClose}
              className={clsx(
                "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive("/usuarios")
                  ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
              )}
            >
              <Users size={18} />
              Usuarios
            </Link>
          )}
          {parametros && (
            <Link
              href="/parametros"
              onClick={onClose}
              className={clsx(
                "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive("/parametros")
                  ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
              )}
            >
              <Settings2 size={18} />
              Parámetros maestros
            </Link>
          )}
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--magenta)] text-sm font-bold text-white">
              {(user?.nombre || user?.username || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.nombre || "Usuario"}
              </p>
              <p className="truncate text-xs text-[var(--text-faint)]">
                {user ? ROL_LABEL[user.rol] : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
