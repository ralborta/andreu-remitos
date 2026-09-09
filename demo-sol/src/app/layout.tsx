import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOL Demo Rooms",
  description: "Backoffice demo SOL — salas temporales para prospectos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
