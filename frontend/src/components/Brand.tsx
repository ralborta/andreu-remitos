import Image from "next/image";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

/**
 * Logo SOL acotado por altura (el PNG es ancho ~1024×682).
 * Evitar h-auto/w-auto sin tope: rompe sidebar y login.
 */
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
  const cfg = {
    sm: { h: 22, maxW: 96, product: "text-[8px] tracking-[0.14em]" },
    md: { h: 28, maxW: 120, product: "text-[9px] tracking-[0.16em]" },
    lg: { h: 48, maxW: 176, product: "text-[10px] tracking-[0.18em]" },
  }[size];

  return (
    <span
      className={clsx(
        "inline-flex flex-col items-start gap-0.5 select-none",
        className,
      )}
    >
      <Image
        src={BRAND.logoPath}
        alt={`${BRAND.name} ${BRAND.tagline}`}
        width={Math.round(cfg.h * (1024 / 682))}
        height={cfg.h}
        className="object-contain object-left"
        style={{ height: cfg.h, width: "auto", maxWidth: cfg.maxW }}
        priority
        unoptimized
      />
      {showProduct ? (
        <span
          className={clsx(
            "font-medium uppercase leading-none text-[var(--text-dim)]",
            cfg.product,
          )}
        >
          {BRAND.productName}
        </span>
      ) : null}
    </span>
  );
}
