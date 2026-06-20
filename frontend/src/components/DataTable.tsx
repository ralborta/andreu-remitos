import clsx from "clsx";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends object>({
  columns,
  rows,
  minWidth = 640,
  rowClassName,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  minWidth?: number;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth }}
      >
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
            {columns.map((c) => (
              <th key={c.key} className={clsx("px-3 py-2 font-medium", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={(row as { id?: string }).id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                "border-t border-[var(--border-soft)] transition-colors hover:bg-white/[0.03]",
                onRowClick && "cursor-pointer",
                rowClassName?.(row),
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={clsx("px-3 py-3 align-middle", c.className)}>
                  {c.render
                    ? c.render(row)
                    : ((row as Record<string, ReactNode>)[c.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
