"use client";

import { useEffect, useRef, useState } from "react";

/** 
 * HTML Stitch a pantalla completa con double-buffering.
 * Mantiene el iframe anterior visible mientras el nuevo carga completamente.
 */
export function StitchFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [nextSrc, setNextSrc] = useState<string | null>(null);
  const currentIframeRef = useRef<HTMLIFrameElement>(null);
  const nextIframeRef = useRef<HTMLIFrameElement>(null);
  const [showNext, setShowNext] = useState(false);

  useEffect(() => {
    if (src !== currentSrc && !nextSrc) {
      // Start loading new src in hidden iframe
      setNextSrc(src);
      setShowNext(false);
    }
  }, [src, currentSrc, nextSrc]);

  useEffect(() => {
    if (!nextSrc || !nextIframeRef.current) return;

    const nextIframe = nextIframeRef.current;
    let swapped = false;

    const handleLoad = () => {
      if (swapped) return;

      // Wait for fonts to be ready in the new iframe
      const iframeWindow = nextIframe.contentWindow;
      if (!iframeWindow) return;

      const iframeDocument = iframeWindow.document;
      if (iframeDocument.fonts && iframeDocument.fonts.ready) {
        iframeDocument.fonts.ready
          .then(() => {
            if (swapped) return;
            swapped = true;
            // Swap: show new, hide old
            setShowNext(true);
            setCurrentSrc(nextSrc);
            setNextSrc(null);
          })
          .catch(() => {
            // Fallback: swap after timeout
            if (swapped) return;
            swapped = true;
            setTimeout(() => {
              setShowNext(true);
              setCurrentSrc(nextSrc);
              setNextSrc(null);
            }, 200);
          });
      } else {
        // No fonts API, swap immediately after load
        swapped = true;
        setShowNext(true);
        setCurrentSrc(nextSrc);
        setNextSrc(null);
      }
    };

    nextIframe.addEventListener('load', handleLoad);
    return () => nextIframe.removeEventListener('load', handleLoad);
  }, [nextSrc]);

  return (
    <>
      {/* Current visible iframe */}
      <iframe
        ref={currentIframeRef}
        title={title}
        src={currentSrc}
        className="fixed inset-0 z-[60] h-[100dvh] w-full max-w-full border-0 bg-[#f8f9ff] transition-opacity duration-200"
        style={{ opacity: showNext ? 0 : 1, pointerEvents: showNext ? 'none' : 'auto' }}
      />
      
      {/* Next iframe (hidden while loading) */}
      {nextSrc && (
        <iframe
          ref={nextIframeRef}
          title={`${title} (loading)`}
          src={nextSrc}
          className="fixed inset-0 z-[61] h-[100dvh] w-full max-w-full border-0 bg-[#f8f9ff] transition-opacity duration-200"
          style={{ opacity: showNext ? 1 : 0, pointerEvents: showNext ? 'auto' : 'none' }}
        />
      )}
    </>
  );
}
