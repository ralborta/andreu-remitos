import type { Metadata } from "next";
import { WhatsAppVincular } from "@/components/WhatsAppVincular";

export const metadata: Metadata = {
  title: "Vincular WhatsApp — Andreu",
  description: "Escaneá el QR para reconectar el bot de WhatsApp de Andreu.",
};

export default function VincularWaPage() {
  return <WhatsAppVincular />;
}
