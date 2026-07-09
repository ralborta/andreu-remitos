import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/lib/auth-context";
import { ConfirmProvider } from "@/lib/confirm-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <AppShell>{children}</AppShell>
      </ConfirmProvider>
    </AuthProvider>
  );
}
