"use client";

/**
 * Renderiza el HTML exportado de Stitch (Platform Redesign Concept)
 * a pantalla completa. Es el borrador visual real.
 */
export function StitchTorreFrame() {
  return (
    <iframe
      title="Torre de Control SOL — HTML Stitch"
      src="/stitch/torre-sol.html"
      className="fixed inset-0 z-[60] h-[100dvh] w-screen border-0 bg-[#f8f9ff]"
    />
  );
}
