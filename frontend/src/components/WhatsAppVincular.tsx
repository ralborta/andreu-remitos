"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BRAND } from "@/lib/brand";

const QR_POLL_MS = 4000;

type QrResponse = {
  ok?: boolean;
  connected?: boolean;
  can_send?: boolean;
  session_stale?: boolean;
  qr_stale?: boolean;
  qr_available?: boolean;
  image_base64?: string;
  phone?: string | null;
  message?: string;
};

function fmtPhone(raw?: string | null) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return raw;
  if (d.startsWith("54911")) {
    return `+54 9 11 ${d.slice(5, 9)}-${d.slice(9)}`;
  }
  return d.startsWith("+") ? raw : `+${d}`;
}

function QrFrame({ src, loading }: { src?: string | null; loading?: boolean }) {
  return (
    <div className="wa-qr-frame">
      <div className="wa-qr-frame__inner flex min-h-[318px] min-w-[318px] items-center justify-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`Código QR WhatsApp ${BRAND.name}`}
            className="block rounded-xl bg-white"
            width={306}
            height={306}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <RefreshCw className="animate-spin text-[#25d366]" size={28} />
            <p className="text-sm text-[#8696a0]">
              {loading ? "Generando código QR…" : "Esperando código QR del bot…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function WhatsAppVincular() {
  const [data, setData] = useState<QrResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vincular/qr", { cache: "no-store" });
      const json = (await res.json()) as QrResponse;
      setData(json);
      if (json.connected && json.can_send !== false) {
        setQrImage(null);
        setLoading(false);
        return;
      }
      if (json.image_base64) {
        setQrImage(json.image_base64);
        setLoading(false);
        return;
      }
      setQrImage(null);
      setLoading(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el QR");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), QR_POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const phoneFmt = fmtPhone(data?.phone);
  const ready = Boolean(data?.connected && data?.can_send !== false);
  const stale = Boolean(data?.session_stale);
  const qrStale = Boolean(data?.qr_stale);
  const waitingQr = !ready;

  return (
    <div className="surface-dark min-h-screen bg-[#0b141a] text-[#e9edef]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <header className="mb-8 flex flex-col items-center text-center">
          <Brand variant="stack" size="lg" className="mb-5" />
          <p className="rounded-full border border-[#25d366]/35 bg-[#25d366]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#25d366]">
            Conexión WhatsApp · {BRAND.name}
          </p>
          <h1 className="mt-4 text-2xl font-semibold">
            Vincular el bot de {BRAND.name}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-[#8696a0]">
            Esta página es de <strong className="text-[#e9edef]">{BRAND.name}</strong> (
            {BRAND.productName}). Escaneá el QR con el teléfono del bot para conectar
            remitos y viajes por WhatsApp.
          </p>
          {phoneFmt && (
            <p className="mt-3 font-mono text-sm tracking-wide text-[#e9edef]">{phoneFmt}</p>
          )}
        </header>

        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[#222d34] bg-[#111b21] p-8 shadow-xl">
          {error && (
            <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          {ready ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25d366]/20 text-[#25d366]">
                <MessageCircle size={32} />
              </div>
              <p className="text-lg font-medium text-[#25d366]">WhatsApp de {BRAND.name} listo</p>
              {phoneFmt && <p className="font-mono text-sm">{phoneFmt}</p>}
              <p className="max-w-xs text-sm text-[#8696a0]">
                Ya podés probar mandando un mensaje al bot. Mantené el teléfono con internet.
              </p>
            </div>
          ) : (
            <>
              {stale && (
                <p className="mb-4 max-w-sm rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
                  La sesión anterior expiró. Escaneá el QR para volver a conectar.
                </p>
              )}
              {qrStale && (
                <p className="mb-4 max-w-sm rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
                  El QR expiró. Se generará uno nuevo en unos segundos — tocá Actualizar.
                </p>
              )}
              <QrFrame src={qrImage} loading={loading} />
              <p className="mt-6 text-center text-sm text-[#8696a0]">
                {data?.message || "Escaneá con WhatsApp → Dispositivos vinculados"}
              </p>
              {waitingQr && (
                <p className="mt-2 animate-pulse text-xs text-[#25d366]">Esperando escaneo…</p>
              )}
            </>
          )}
        </div>

        {waitingQr && (
          <ol className="mt-8 space-y-3 text-sm text-[#8696a0]">
            {[
              `Abrí WhatsApp en el teléfono que va a usar el bot de ${BRAND.name}`,
              "Menú → Dispositivos vinculados → Vincular dispositivo",
              "Si dice «No puede vincular dispositivos», desvinculá otros dispositivos viejos y esperá 1 minuto",
              "Apuntá la cámara al código QR de arriba (debe estar recién generado)",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25d366]/20 text-xs font-semibold text-[#25d366]">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-8 inline-flex items-center justify-center gap-2 self-center rounded-xl border border-[#222d34] px-4 py-2 text-sm text-[#8696a0] hover:text-white"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>

        <p className="mt-6 text-center text-xs text-[#667781]">
          Página externa de vinculación · {BRAND.name} {BRAND.tagline} · {BRAND.productName}
        </p>
      </div>
    </div>
  );
}
