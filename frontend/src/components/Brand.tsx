import Image from "next/image";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

export function Brand({
  className,
  size = "md",
  showTagline = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const heights = { sm: 28, md: 36, lg: 52 };
  const h = heights[size];

  return (
    <span className={clsx("inline-flex flex-col items-start gap-0.5 select-none", className)}>
      <Image
        src={BRAND.logoPath}
        alt={BRAND.name}
        width={Math.round(h * 4.2)}
        height={h}
        className="h-auto w-auto max-w-[180px] object-contain object-left"
        priority
        unoptimized
      />
      {showTagline ? (
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
          {BRAND.tagline}
        </span>
      ) : null}
    </span>
  );
}
