import clsx from "clsx";

export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };
  return (
    <span
      className={clsx(
        "font-[var(--font-display)] font-bold tracking-tight text-white select-none",
        sizes[size],
        className,
      )}
    >
      Emplia
      <span className="relative inline-block text-[#d946ef]">d</span>
      <span className="relative inline-flex items-center justify-center text-[#d946ef]">o</span>
      <span>s</span>
      <span className="text-[var(--text-dim)] font-semibold"> · Andreu</span>
    </span>
  );
}
