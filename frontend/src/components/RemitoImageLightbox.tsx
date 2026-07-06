"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, X, ZoomIn } from "lucide-react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function RemitoImagePreview({
  src,
  alt,
  className,
  hint = "Clic para ampliar",
  inlineZoom = true,
}: {
  src: string;
  alt: string;
  className?: string;
  hint?: string;
  /** Zoom con rueda en el panel sin abrir lightbox (no se pierde al editar campos). */
  inlineZoom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);

  function onWheelInline(e: React.WheelEvent) {
    if (!inlineZoom) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((s) => Math.min(4, Math.max(1, Number((s + delta).toFixed(2)))));
  }

  return (
    <>
      <div
        className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-black/30"
        onWheel={onWheelInline}
      >
        <button
          type="button"
          onClick={() => !inlineZoom && setOpen(true)}
          onDoubleClick={() => setOpen(true)}
          className="relative block w-full cursor-zoom-in text-left"
          aria-label={`${hint}: ${alt}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={className ?? "max-h-[min(42vh,360px)] w-full origin-top object-contain object-top transition-transform duration-75"}
            style={inlineZoom && scale > 1 ? { transform: `scale(${scale})` } : undefined}
          />
        </button>
        {inlineZoom && scale > 1 && (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white/90">
            {Math.round(scale * 100)}% · doble clic pantalla completa
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn size={12} />
          {inlineZoom ? "Rueda para zoom · doble clic ampliar" : hint}
        </span>
      </div>
      <RemitoImageLightbox src={src} alt={alt} open={open} onClose={() => setOpen(false)} initialScale={scale} />
    </>
  );
}

export function RemitoImageLightbox({
  src,
  alt,
  open,
  onClose,
  initialScale = 1,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  initialScale?: number;
}) {
  const [scale, setScale] = useState(initialScale);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) {
      resetView();
      return;
    }
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, resetView, initialScale]);

  function clampScale(next: number) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  }

  function zoomBy(delta: number) {
    setScale((s) => clampScale(Number((s + delta).toFixed(2))));
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((s) => clampScale(Number((s + delta).toFixed(2))));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function onPointerUp() {
    dragging.current = false;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white/90">{alt}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(-0.25)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            aria-label="Alejar"
          >
            <Minus size={18} />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-white/70">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.25)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            aria-label="Acercar"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            aria-label="Restablecer zoom"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-lg p-2 text-white/80 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-label="Cerrar visor"
      />

      <div
        ref={viewportRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: scale > 1 ? (dragging.current ? "grabbing" : "grab") : "zoom-in" }}
        onDoubleClick={() => (scale > 1 ? resetView() : setScale(2))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-75"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      <p className="shrink-0 border-t border-white/10 px-4 py-2 text-center text-[11px] text-white/50">
        Rueda del mouse o botones para zoom · doble clic para 2× / restablecer · arrastrá cuando esté ampliado
        <Maximize2 size={12} className="ml-1 inline opacity-60" />
      </p>
    </div>
  );
}
