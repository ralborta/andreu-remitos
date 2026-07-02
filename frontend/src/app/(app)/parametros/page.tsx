import { ParametrosPanel } from "@/components/ParametrosPanel";
import { AdminGate } from "@/components/AdminGate";

export default function ParametrosPage() {
  return (
    <AdminGate>
      <ParametrosPanel />
    </AdminGate>
  );
}
