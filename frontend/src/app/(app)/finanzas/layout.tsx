import { FinanzasNav } from "@/components/finanzas/FinanzasNav";

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -mt-5 flex min-h-[calc(100vh-4rem)] lg:-mx-7 lg:-mt-6">
      <FinanzasNav />
      <div className="min-w-0 flex-1 px-5 py-6 lg:px-8">{children}</div>
    </div>
  );
}
