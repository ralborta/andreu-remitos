import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Empliados.net · Torre de Control Logística",
  description:
    "Suite de automatización operativa para procesos logísticos. Agentes IA, trazabilidad y control en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${display.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
