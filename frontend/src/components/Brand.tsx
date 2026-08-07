import Image from "next/image";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

export function Brand({
  className,
  size = "md",
  showProduct = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** TransitOne debajo del logo SOL (más chico). */
  showProduct?: boolean;
}) {
  const heights = { sm: 28, md: 40, lg: 64 };
  const h = heights[size];
  const productCls = {
    sm: "text-[9px] tracking-[0.16em]",
    md: "text-[10px] tracking-[0.18em]",
    lg: "text-xs tracking-[0.22em]",
  }[size];

  return (
    <span className={clsx("inline-flex flex-col items-start gap-1 select-none", className)}>
      <Image
        src={BRAND.logoPath}
        alt={BRAND.name}
        width={Math.round(h * 3.4)}
        height={h}
        className={clsx(
          "h-auto w-auto object-contain object-left",
          size === "lg" ? "max-w-[240px]" : "max-w-[160px]",
        )}
        priority
        unoptimized
      />
      {showProduct ? (
        <span
          className={clsx(
            "font-medium uppercase text-[var(--text-dim)]",
            productCls,
          )}
        >
          {BRAND.productName}
        </span>
      ) : null}
    </span>
  );
}
