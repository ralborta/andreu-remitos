"use client";

import { useEffect, useRef, useState } from "react";

/** 
 * Iframe persistente con overlay de carga simple.
 * Enfoque minimalista para evitar parpadeos blancos sin romper navegación.
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

  useEffect(() => {
    if (!iframeRef.current) return;
    
    const iframe = iframeRef.current;
    
    // Si el src cambia, mostrar overlay
    if (iframe.src && !iframe.src.endsWith(src)) {
      setLoading(true);
    }
    
    // Actualizar src del iframe
    iframe.src = src;
    
    // Ocultar overlay cuando carga
    const handleLoad = () => {
      setLoading(false);
    };
    
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [src]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50">
      {/* Iframe persistente */}
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        className="h-[100dvh] w-full border-0 bg-slate-50"
        style={{ display: 'block' }}
      />
      
      {/* Overlay oscuro mientras carga - SIN pointer-events en el overlay */}
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
