"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Smartphone } from "lucide-react";

const WHATSAPP_NUMERO = "+5492617207199";
const WHATSAPP_NUMERO_FMT = "+54 9 261 720-7199";
const QR_WAIT_MS = 2 * 60 * 1000;
const CONNECTING_MS = 3200;
const QR_POLL_MS = 5000;

type Phase = "starting" | "qr" | "connecting" | "connected";

type QrResponse = {
  ok?: boolean;
  connected?: boolean;
  qr_available?: boolean;
  image_base64?: string;
  phone?: string | null;
  message?: string;
};

const STEPS = [
  "Abrí WhatsApp en tu teléfono",
  "Tocá Menú o Configuración → Dispositivos vinculados",
  "Tocá Vincular un dispositivo",
  "Apuntá la cámara a este código QR",
];

function QrConMarco({ src, loading }: { src?: string | null; loading?: boolean }) {
  return (
    <div className="wa-qr-frame">
      <div className="wa-qr-frame__inner flex min-h-[318px] min-w-[318px] items-center justify-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Código QR WhatsApp"
            className="block rounded-xl bg-white"
            width={306}
            height={306}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <RefreshCw className="animate-spin text-[#25d366]" size={28} />
            <p className="text-sm text-[#8696a0]">
              {loading ? "Generando código QR…" : "Esperando código QR…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function BaileysPruebaQr() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const phaseRef = useRef<Phase>("starting");
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goConnecting = useCallback((phone?: string | null) => {
    if (phaseRef.current !== "qr") return;
    if (qrTimerRef.current) {
      clearTimeout(qrTimerRef.current);
      qrTimerRef.current = null;
    }
    if (phone) setConnectedPhone(phone);
    phaseRef.current = "connecting";
    setPhase("connecting");
    setTimeout(() => {
      phaseRef.current = "connected";
      setPhase("connected");
    }, CONNECTING_MS);
  }, []);

  const refreshQr = useCallback(async () => {
    if (phaseRef.current !== "qr") return;
    try {
      const res = await fetch("/backend/api/vincular/whatsapp/qr", { cache: "no-store" });
      const data = (await res.json()) as QrResponse;
      if (data.connected) {
        goConnecting(data.phone);
        return;
      }
      if (data.image_base64) {
        setQrImage(data.image_base64);
        setQrLoading(false);
      } else {
        setQrLoading(true);
      }
    } catch {
      setQrLoading(true);
    }
  }, [goConnecting]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      phaseRef.current = "qr";
      setPhase("qr");
    }, 1800);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "qr") return;
    refreshQr();
    const poll = setInterval(refreshQr, QR_POLL_MS);
    qrTimerRef.current = setTimeout(() => goConnecting(), QR_WAIT_MS);
    return () => {
      clearInterval(poll);
      if (qrTimerRef.current) {
        clearTimeout(qrTimerRef.current);
        qrTimerRef.current = null;
      }
    };
  }, [phase, refreshQr, goConnecting]);

  const phoneDisplay = connectedPhone
    ? connectedPhone.startsWith("+")
      ? connectedPhone
      : `+${connectedPhone}`
    : WHATSAPP_NUMERO_FMT;

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
            <MessageCircle size={30} />
          </div>
          <h1 className="text-2xl font-semibold">Vincular WhatsApp</h1>
          <p className="mt-3 font-mono text-sm tracking-wide text-[#e9edef]">{WHATSAPP_NUMERO_FMT}</p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[#222d34] bg-[#111b21] p-8 shadow-xl">
          {phase === "starting" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <RefreshCw className="animate-spin text-[#25d366]" size={36} />
              <p className="text-lg font-medium">Iniciando sesión…</p>
              <p className="text-sm text-[#8696a0]">
                Preparando vinculación de {WHATSAPP_NUMERO}
              </p>
            </div>
          )}

          {phase === "qr" && (
            <>
              <QrConMarco src={qrImage} loading={qrLoading} />
              <p className="mt-6 text-center text-sm text-[#8696a0]">
                Escaneá con el teléfono {WHATSAPP_NUMERO_FMT}
              </p>
              <p className="mt-2 animate-pulse text-xs text-[#25d366]">Esperando escaneo…</p>
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
              <p className="text-lg font-medium">Conectando {WHATSAPP_NUMERO}</p>
              <p className="text-sm text-[#8696a0]">Sincronizando mensajes</p>
            </div>
          )}

          {phase === "connected" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25d366]/20 text-[#25d366]">
                <MessageCircle size={32} />
              </div>
              <p className="text-lg font-medium text-[#25d366]">WhatsApp conectado</p>
              <p className="font-mono text-sm text-[#e9edef]">{phoneDisplay}</p>
              <p className="max-w-xs text-sm text-[#8696a0]">
                Mantené el teléfono conectado a internet.
              </p>
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
      </div>
    </div>
  );
}
