"use client";

/** HTML Stitch a pantalla completa (borrador visual). */
export function StitchFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  return (
    <iframe
      title={title}
      src={src}
      className="fixed inset-0 z-[60] h-[100dvh] w-screen border-0 bg-[#f8f9ff]"
    />
  );
}
