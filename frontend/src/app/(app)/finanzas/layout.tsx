import { FinanzasNav } from "@/components/finanzas/FinanzasNav";

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FinanzasNav />
      {children}
    </div>
  );
}
