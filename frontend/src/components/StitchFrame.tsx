"use client";

import { useEffect, useRef, useState } from "react";

/** 
 * Iframe persistente con overlay de carga simple.
 * CRÍTICO: Fallback timeout garantiza que el overlay nunca quede fijo.
 */
export function StitchFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    
    const iframe = iframeRef.current;
    
    // Si el src cambia, mostrar overlay
    if (iframe.src && !iframe.src.endsWith(src)) {
      setLoading(true);
      
      // FALLBACK CRÍTICO: Ocultar overlay después de 1.5s
      // incluso si el load event nunca llega
      timeoutRef.current = setTimeout(() => {
        console.warn('[StitchFrame] Fallback timeout - mostrando iframe sin load event');
        setLoading(false);
      }, 1500);
    }
    
    // Actualizar src del iframe
    iframe.src = src;
    
    // Ocultar overlay cuando carga (o por fallback)
    const handleLoad = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setLoading(false);
    };
    
    iframe.addEventListener('load', handleLoad);
    
    return () => {
      iframe.removeEventListener('load', handleLoad);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [src]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50">
      {/* Iframe persistente - SIEMPRE visible */}
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        className="h-[100dvh] w-full border-0 bg-slate-50"
        style={{ display: 'block' }}
      />
      
      {/* Overlay oscuro mientras carga - desaparece a los 1.5s máximo */}
      {loading && (
        <div 
          className="fixed inset-0 z-[61] flex items-center justify-center bg-slate-900/10 transition-opacity duration-150"
          style={{ pointerEvents: 'none' }} // CRÍTICO: no bloquear clicks
        >
          <div className="rounded-lg bg-slate-800/90 px-4 py-2 text-sm text-white shadow-lg">
            Cargando...
          </div>
        </div>
      )}
    </div>
  );
}
