import { ChevronRight } from "lucide-react";

export function FlowSteps({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-stretch gap-2">
          <div className="group relative flex min-w-[150px] max-w-[220px] flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-3 transition-colors hover:border-[var(--violet)]/50">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--violet)]/20 text-xs font-bold text-[var(--violet-2)]">
              {i + 1}
            </span>
            <span className="text-sm leading-snug text-[var(--text)]">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center text-[var(--text-faint)]">
              <ChevronRight size={16} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
