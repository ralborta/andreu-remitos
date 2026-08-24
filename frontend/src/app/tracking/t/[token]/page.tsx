import type { Metadata, Viewport } from "next";
import { TrackingDriverApp } from "@/components/tracking/TrackingDriverApp";

export const metadata: Metadata = {
  title: "Seguimiento de viaje — SOL",
  description: "Tracking Express — seguimiento operativo sin instalar apps",
  appleWebApp: {
    capable: true,
    title: "SOL Tracking",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#7c3aed",
};

export default async function TrackingTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TrackingDriverApp token={token} />;
}
