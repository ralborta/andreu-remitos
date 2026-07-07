import type { Metadata } from "next";
import { BaileysPruebaQr } from "@/components/BaileysPruebaQr";

export const metadata: Metadata = {
  title: "Vincular WhatsApp",
  description: "Vincular dispositivo WhatsApp.",
};

export default function ConexionPruebaPage() {
  return <BaileysPruebaQr />;
}
