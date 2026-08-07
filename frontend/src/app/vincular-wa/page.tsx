import type { Metadata } from "next";
import { WhatsAppVincular } from "@/components/WhatsAppVincular";

export const metadata: Metadata = {
  title: "Vincular WhatsApp — TransitOne",
  description: "Escaneá el QR para conectar el bot de WhatsApp de TransitOne.",
};

export default function VincularWaPage() {
  return <WhatsAppVincular />;
}
