"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function TrackingShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-4 py-5 pb-8">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--violet)]">
          SOL Tracking Express
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text)]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-dim)]">{subtitle}</p>}
      </header>
      <div className="flex-1">{children}</div>
      {footer}
      <p className="mt-6 rounded-xl border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--text-dim)]">
        El seguimiento funciona mientras esta pantalla permanece activa. No cierres el navegador
        durante el viaje.
      </p>
    </div>
  );
}

export function TrackingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TrackingButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary:
      "bg-[var(--violet)] text-white shadow-md shadow-[var(--violet)]/25 hover:bg-[var(--violet-deep)]",
    secondary:
      "border border-[var(--border)] bg-[var(--panel-2)] text-[var(--text)] hover:bg-[var(--overlay)]",
    danger: "bg-[var(--red)] text-white hover:opacity-90",
    ghost: "text-[var(--violet)] hover:bg-[var(--overlay)]",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
      )}
    >
      {children}
    </button>
  );
}

export function TrackingField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border-soft)] py-2 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--text)]">{value || "—"}</dd>
    </div>
  );
}

export function TrackingStatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }) {
  const colors = {
    green: "var(--green)",
    amber: "var(--amber)",
    red: "var(--red)",
    gray: "var(--text-faint)",
    blue: "var(--blue)",
  };
  const c = colors[tone];
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: c, background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}44` }}
    >
      {label}
    </span>
  );
}
