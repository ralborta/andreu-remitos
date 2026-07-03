import { UsuariosPanel } from "@/components/UsuariosPanel";
import { AdminGate } from "@/components/AdminGate";

export default function UsuariosPage() {
  return (
    <AdminGate>
      <UsuariosPanel />
    </AdminGate>
  );
}
