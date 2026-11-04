"use client";

import { useEffect, useRef } from "react";

/** 
 * Single persistent iframe that swaps content internally.
 * Never creates a new document - fetches HTML and replaces body content.
 */
export function StitchFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentSrcRef = useRef(src);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Initial load: let iframe load normally
    if (isInitialMount.current) {
      isInitialMount.current = false;
      currentSrcRef.current = src;
      return;
    }

    // Subsequent navigations: fetch and swap content
    if (src !== currentSrcRef.current) {
      const iframeWindow = iframe.contentWindow;
      const iframeDocument = iframe.contentDocument;
      
      if (!iframeWindow || !iframeDocument) return;

      console.log(`[StitchFrame] Swapping content: ${currentSrcRef.current} → ${src}`);

      // Fetch new HTML
      fetch(src, { credentials: 'include' })
        .then(response => response.text())
        .then(html => {
          // Parse new HTML
          const parser = new DOMParser();
          const newDoc = parser.parseFromString(html, 'text/html');

          // Replace title
          iframeDocument.title = newDoc.title;

          // Replace body content
          if (iframeDocument.body && newDoc.body) {
            iframeDocument.body.innerHTML = newDoc.body.innerHTML;
            
            // Copy body classes/attributes
            iframeDocument.body.className = newDoc.body.className;
            Array.from(newDoc.body.attributes).forEach(attr => {
              if (attr.name !== 'class') {
                iframeDocument.body.setAttribute(attr.name, attr.value);
              }
            });
          }

          // Execute new scripts
          const scripts = newDoc.querySelectorAll('script');
          scripts.forEach(oldScript => {
            const newScript = iframeDocument.createElement('script');
            
            if (oldScript.src) {
              newScript.src = oldScript.src;
            } else {
              newScript.textContent = oldScript.textContent;
            }
            
            Array.from(oldScript.attributes).forEach(attr => {
              newScript.setAttribute(attr.name, attr.value);
            });
            
            // Append to trigger execution
            iframeDocument.body.appendChild(newScript);
          });

          // Update current src
          currentSrcRef.current = src;
          
          console.log(`[StitchFrame] Content swapped successfully`);
        })
        .catch(error => {
          console.error(`[StitchFrame] Failed to fetch ${src}:`, error);
          // Fallback: full reload
          iframe.src = src;
          currentSrcRef.current = src;
        });
    }
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      className="fixed inset-0 z-[60] h-[100dvh] w-full max-w-full border-0 bg-slate-50"
    />
  );
}
