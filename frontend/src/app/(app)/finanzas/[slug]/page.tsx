import { notFound, redirect } from "next/navigation";

const ALIAS: Record<string, string> = {
  cobranzas: "/finanzas/ingresos",
  facturas: "/finanzas/facturas",
  conciliacion: "/finanzas/conciliacion",
  comunicacion: "/finanzas/comunicacion",
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dest = ALIAS[slug];
  if (dest) redirect(dest);
  notFound();
}
