"use client";

import { useEffect, useRef } from "react";

/** HTML Stitch a pantalla completa (borrador visual). */
export function StitchFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrcRef = useRef(src);
  
  useEffect(() => {
    // Update iframe src when prop changes, avoiding remount
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    // Build full URL for comparison
    const currentSrc = iframe.src;
    const newFullSrc = new URL(src, window.location.origin).href;
    
    // Only update if actually different
    if (currentSrc !== newFullSrc) {
      iframe.src = newFullSrc;
    }
  }, [src]);
  
  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={initialSrcRef.current}
      className="fixed inset-0 z-[60] h-[100dvh] w-full max-w-full border-0 bg-[#f8f9ff]"
    />
  );
}
