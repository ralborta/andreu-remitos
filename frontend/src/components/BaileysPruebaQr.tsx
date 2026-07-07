"use client";

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Smartphone } from "lucide-react";

type Phase = "starting" | "qr" | "connecting" | "connected";

/** QR decorativo (no escaneable / no vincula ninguna sesión real). */
function FakeQrSvg() {
  const cells: boolean[] = [];
  const size = 29;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= size - 7 && y < 7) ||
        (x < 7 && y >= size - 7);
      const finderBorder =
        inFinder &&
        (x === 0 ||
          y === 0 ||
          x === 6 ||
          y === 6 ||
          x === size - 7 ||
          x === size - 1 ||
          y === size - 7 ||
          y === size - 1);
      const finderCore =
        inFinder &&
        x >= 2 &&
        x <= 4 &&
        y >= 2 &&
        y <= 4 &&
        !(x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) &&
        !(x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3);
      const hash = (x * 17 + y * 31 + x * y) % 5;
      cells.push(finderBorder || finderCore || (!inFinder && hash < 2));
    }
  }

  const cell = 10;
  const pad = 16;
  const dim = size * cell + pad * 2;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      className="rounded-xl bg-white shadow-inner"
      aria-hidden
    >
      <rect width={dim} height={dim} fill="#fff" rx="12" />
      {cells.map((on, i) => {
        if (!on) return null;
        const x = (i % size) * cell + pad;
        const y = Math.floor(i / size) * cell + pad;
        return <rect key={i} x={x} y={y} width={cell} height={cell} fill="#111" />;
      })}
    </svg>
  );
}

const STEPS = [
  "Abrí WhatsApp en tu teléfono",
  "Tocá Menú o Configuración → Dispositivos vinculados",
  "Tocá Vincular un dispositivo",
  "Apuntá la cámara a este código QR",
];

export function BaileysPruebaQr() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("qr"), 1800);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "qr") return;
    const loop = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(loop);
  }, [phase]);

  useEffect(() => {
    if (phase !== "qr" || tick < 2) return;
    setPhase("connecting");
    const t = setTimeout(() => setPhase("connected"), 3200);
    return () => clearTimeout(t);
  }, [phase, tick]);

  const restart = () => {
    setTick(0);
    setPhase("starting");
    setTimeout(() => setPhase("qr"), 1800);
  };

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
            <MessageCircle size={30} />
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#8696a0]">
            Conexión de prueba · Baileys
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Vincular WhatsApp</h1>
          <p className="mt-2 text-sm text-[#8696a0]">
            Entorno de prueba para mostrar el flujo de vinculación. No conecta ningún número real.
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[#222d34] bg-[#111b21] p-8 shadow-xl">
          {phase === "starting" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <RefreshCw className="animate-spin text-[#25d366]" size={36} />
              <p className="text-lg font-medium">Iniciando sesión Baileys…</p>
              <p className="text-sm text-[#8696a0]">Generando código QR</p>
            </div>
          )}

          {phase === "qr" && (
            <>
              <FakeQrSvg />
              <p className="mt-6 text-center text-sm text-[#8696a0]">
                Escaneá con WhatsApp para vincular este dispositivo
              </p>
              <p className="mt-2 animate-pulse text-xs text-[#25d366]">
                Esperando escaneo…
              </p>
            </>
          )}

          {phase === "connecting" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="relative">
                <Smartphone size={48} className="text-[#25d366]" />
                <RefreshCw
                  size={20}
                  className="absolute -right-1 -top-1 animate-spin text-[#8696a0]"
                />
              </div>
              <p className="text-lg font-medium">Conectando a WhatsApp…</p>
              <p className="text-sm text-[#8696a0]">Sincronizando mensajes</p>
            </div>
          )}

          {phase === "connected" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25d366]/20 text-[#25d366]">
                <MessageCircle size={32} />
              </div>
              <p className="text-lg font-medium text-[#25d366]">Conexión de prueba establecida</p>
              <p className="max-w-xs text-sm text-[#8696a0]">
                Baileys mantiene la sesión y reenvía los mensajes al servidor configurado.
              </p>
              <button
                type="button"
                onClick={restart}
                className="mt-4 rounded-lg border border-[#2a3942] px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942]"
              >
                Ver de nuevo
              </button>
            </div>
          )}
        </div>

        {phase === "qr" && (
          <ol className="mt-8 space-y-3 text-sm text-[#8696a0]">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25d366]/20 text-xs font-semibold text-[#25d366]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        <footer className="mt-10 text-center text-xs text-[#667781]">
          Baileys es la librería open source que usa WhatsApp Web por debajo.
          <br />
          Esta es una conexión de prueba — no afecta sesiones activas en producción.
        </footer>
      </div>
    </div>
  );
}
