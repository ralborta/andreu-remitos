import clsx from "clsx";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, type AgentStatus } from "@/lib/agents";

export function PageHeader({
  title,
  subtitle,
  badge,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--violet)]/30 to-[var(--magenta)]/20 text-[var(--violet-2)] ring-1 ring-[var(--violet)]/30">
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-[28px]">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--text-dim)]">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color,
        background: `${color}1f`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({
  children,
  color = "#a78bfa",
  soft = true,
}: {
  children: React.ReactNode;
  color?: string;
  soft?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color,
        background: soft ? `${color}1a` : color,
        boxShadow: `inset 0 0 0 1px ${color}40`,
      }}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  trend,
  hint,
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  const negative = trend?.trim().startsWith("-");
  // En logística, bajar tiempos/consultas es positivo: tratamos el color por contexto neutro.
  const trendColor = trend
    ? negative
      ? "#22c55e"
      : "#22c55e"
    : undefined;

  return (
    <div className="panel panel-hover p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-[var(--text-dim)]">{label}</p>
        {icon && <span className="text-[var(--text-faint)]">{icon}</span>}
      </div>
      <p className="tabular mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {trend && trend.length > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: trendColor }}
          >
            {negative ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {trend}
          </span>
        )}
        {hint && <span className="text-xs text-[var(--text-faint)]">{hint}</span>}
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx("panel p-5", className)}>{children}</div>;
}

const CRIT_COLOR: Record<string, string> = {
  Alta: "#ef4444",
  Media: "#f59e0b",
  Baja: "#38bdf8",
};

export function CritBadge({ level }: { level: string }) {
  const c = CRIT_COLOR[level] ?? "#a79fc9";
  return <Pill color={c}>{level}</Pill>;
}

export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
    >
      {children}
    </Link>
  );
}
