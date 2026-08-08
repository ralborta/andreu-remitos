import type { Metadata } from "next";
import { WhatsAppVincular } from "@/components/WhatsAppVincular";

export const metadata: Metadata = {
  title: "Vincular WhatsApp — SOL",
  description:
    "Página externa de SOL Logística. Escaneá el QR para conectar el bot de WhatsApp (TransitOne).",
};

export default function VincularWaPage() {
  return <WhatsAppVincular />;
}
