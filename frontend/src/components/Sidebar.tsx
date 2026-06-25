"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import {
  LayoutDashboard,
  Database,
  X,
  FileText,
  Upload,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { agents, STATUS_COLOR, STATUS_LABEL } from "@/lib/agents";
import { REMITO_TENANTS } from "@/lib/tenants";
import { AgentIcon } from "./Icon";
import { Brand } from "./Brand";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const remitosOpen =
    pathname === "/remitos" || pathname.startsWith("/remitos/");
  const [remitosExpanded, setRemitosExpanded] = useState(remitosOpen);

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
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <Brand size="md" />
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

          <div className="mb-1">
            <button
              type="button"
              onClick={() => setRemitosExpanded((v) => !v)}
              className={clsx(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                remitosOpen
                  ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
              )}
            >
              <FileText size={18} />
              <span className="flex-1 text-left">Remitos</span>
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
                  href="/remitos"
                  onClick={onClose}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname === "/remitos"
                      ? "bg-white/10 font-medium text-white"
                      : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                  )}
                >
                  Todos
                </Link>
                {REMITO_TENANTS.filter((t) => t.active).map((t) => {
                  const href = `/remitos/${t.slug}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={t.slug}
                      href={href}
                      onClick={onClose}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      {t.short}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <Link
            href="/subir"
            onClick={onClose}
            className={clsx(
              "group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive("/subir")
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
            )}
          >
            <Upload size={18} />
            Subir remito
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
            Contactos
          </Link>

          <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Agentes (demo)
          </p>

          {agents.map((a) => {
            const href = `/agentes/${a.slug}`;
            const active = isActive(href);
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
          <Link
            href="/backoffice"
            onClick={onClose}
            className={clsx(
              "group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              isActive("/backoffice")
                ? "bg-[var(--violet)]/15 text-white ring-1 ring-[var(--violet)]/40"
                : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white",
            )}
          >
            <Database size={18} />
            Backoffice y métricas
          </Link>
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--magenta)] text-sm font-bold text-white">
              MC
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                Mesa de Control
              </p>
              <p className="truncate text-xs text-[var(--text-faint)]">
                Operaciones · Turno mañana
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
