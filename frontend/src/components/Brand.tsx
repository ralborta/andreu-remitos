import Image from "next/image";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

type BrandSize = "sm" | "md" | "lg";
type BrandVariant = "product" | "company" | "stack";

/** Empliados wordmark (1200×334). */
const PRODUCT_ASPECT = 1200 / 334;
const COMPANY_ASPECT = 1024 / 682;

const PRODUCT_CFG: Record<BrandSize, { h: number; maxW: number }> = {
  sm: { h: 22, maxW: 150 },
  md: { h: 28, maxW: 180 },
  lg: { h: 36, maxW: 220 },
};

const COMPANY_CFG: Record<BrandSize, { h: number; maxW: number }> = {
  sm: { h: 28, maxW: 110 },
  md: { h: 36, maxW: 140 },
  lg: { h: 52, maxW: 190 },
};

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
    const product = PRODUCT_CFG.sm;
    return (
      <span
        className={clsx(
          "inline-flex flex-col items-center gap-2 select-none",
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
        <LogoImg
          src={BRAND.productLogoPath}
          alt={BRAND.productName}
          h={product.h}
          maxW={product.maxW}
          aspect={PRODUCT_ASPECT}
        />
      </span>
    );
  }

  const cfg = PRODUCT_CFG[size];
  return (
    <span className={clsx("inline-flex min-w-0 select-none", className)}>
      <LogoImg
        src={BRAND.productLogoPath}
        alt={BRAND.productName}
        h={cfg.h}
        maxW={cfg.maxW}
        aspect={PRODUCT_ASPECT}
      />
    </span>
  );
}
