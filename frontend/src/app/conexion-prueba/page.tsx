import type { Metadata } from "next";
import { BaileysDemoQr } from "@/components/BaileysDemoQr";

export const metadata: Metadata = {
  title: "Vincular WhatsApp — Conexión de prueba",
  description: "Pantalla de conexión de prueba para vincular WhatsApp con Baileys.",
};

export default function ConexionPruebaPage() {
  return <BaileysDemoQr />;
}
