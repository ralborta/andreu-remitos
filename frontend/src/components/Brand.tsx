import Image from "next/image";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

type BrandSize = "sm" | "md" | "lg";
type BrandVariant = "product" | "company" | "stack";

const COMPANY_ASPECT = 1024 / 682;

const COMPANY_CFG: Record<BrandSize, { h: number; maxW: number }> = {
  sm: { h: 28, maxW: 110 },
  md: { h: 36, maxW: 140 },
  lg: { h: 52, maxW: 190 },
};

/** Wordmark Empliados (sin fondo): Emplia + dos violeta. */
const EMPLIADOS_SIZES: Record<BrandSize, string> = {
  sm: "text-[17px] leading-none",
  md: "text-[22px] leading-none",
  lg: "text-[28px] leading-none",
};

function EmpliadosMark({
  size = "md",
  className,
  /** En fondos claros usar texto oscuro; en UI oscura, blanco. */
  onLight = false,
}: {
  size?: BrandSize;
  className?: string;
  onLight?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex select-none font-[var(--font-display)] font-bold tracking-tight",
        EMPLIADOS_SIZES[size],
        className,
      )}
      aria-label={BRAND.productName}
    >
      <span style={{ color: onLight ? "#1C142D" : "#FFFFFF" }}>Emplia</span>
      <span style={{ color: "#D43DED" }}>dos</span>
    </span>
  );
}

function LogoImg({
  src,
  alt,
  h,
  maxW,
  aspect,
  className,
}: {
  src: string;
  alt: string;
  h: number;
  maxW: number;
  aspect: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={Math.round(h * aspect)}
      height={h}
      className={clsx("object-contain object-left", className)}
      style={{ height: h, width: "auto", maxWidth: maxW }}
      priority
      unoptimized
    />
  );
}

/**
 * product → Empliados (sidebar)
 * company → SOL (header derecha)
 * stack → SOL + Empliados (login)
 */
export function Brand({
  className,
  size = "md",
  variant = "product",
}: {
  className?: string;
  size?: BrandSize;
  variant?: BrandVariant;
}) {
  if (variant === "company") {
    const cfg = COMPANY_CFG[size];
    return (
      <span className={clsx("inline-flex select-none", className)}>
        <LogoImg
          src={BRAND.logoPath}
          alt={`${BRAND.name} ${BRAND.tagline}`}
          h={cfg.h}
          maxW={cfg.maxW}
          aspect={COMPANY_ASPECT}
        />
      </span>
    );
  }

  if (variant === "stack") {
    const company = COMPANY_CFG[size];
    return (
      <span
        className={clsx(
          "inline-flex flex-col items-center gap-2.5 select-none",
          className,
        )}
      >
        <LogoImg
          src={BRAND.logoPath}
          alt={`${BRAND.name} ${BRAND.tagline}`}
          h={company.h}
          maxW={company.maxW}
          aspect={COMPANY_ASPECT}
        />
        <EmpliadosMark size={size === "lg" ? "md" : "sm"} />
      </span>
    );
  }

  return (
    <span className={clsx("inline-flex min-w-0 items-center select-none", className)}>
      <EmpliadosMark size={size} />
    </span>
  );
}
