import type { Metadata } from "next";
import { BaileysDemoQr } from "@/components/BaileysDemoQr";

export const metadata: Metadata = {
  title: "Demo Baileys — Vincular WhatsApp",
  description: "Pantalla de ejemplo del flujo de conexión WhatsApp con Baileys (solo demostración).",
};

export default function BaileysDemoPage() {
  return <BaileysDemoQr />;
}
