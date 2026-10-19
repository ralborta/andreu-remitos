export function EstadoCobranzaPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "bad"
      ? "bg-[#fef2f2] text-[#b91c1c]"
      : tone === "warn"
        ? "bg-[#fffbeb] text-[#b45309]"
        : tone === "info"
          ? "bg-[#eff6ff] text-[#1d4ed8]"
          : "bg-[#f0fdf4] text-[#15803d]";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {children}
    </span>
  );
}
