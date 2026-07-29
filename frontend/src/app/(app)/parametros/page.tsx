import { ParametrosPanel } from "@/components/ParametrosPanel";
import { ParametrosGate } from "@/components/ParametrosGate";

export default function ParametrosPage() {
  return (
    <ParametrosGate>
      <ParametrosPanel />
    </ParametrosGate>
  );
}
