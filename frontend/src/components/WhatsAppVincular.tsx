"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BRAND } from "@/lib/brand";

/** Poll de estado (no reemplaza el QR en pantalla). */
const STATUS_POLL_MS = 6000;
/**
 * Mantener el mismo QR fijo este tiempo aunque el bot ya haya generado otro.
 * Encelulares lentos la vinculación tarda: si el QR cambia a mitad, falla.
 */
const QR_HOLD_MS = 90_000;

type QrResponse = {
  ok?: boolean;
  connected?: boolean;
  can_send?: boolean;
  session_stale?: boolean;
  qr_stale?: boolean;
  qr_available?: boolean;
  image_base64?: string;
  qr_updated_at?: string | null;
  phone?: string | null;
  message?: string;
};

type PinnedQr = {
  image: string;
  updatedAt: string;
  pinnedAt: number;
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

function QrFrame({
  src,
  loading,
  secondsLeft,
}: {
  src?: string | null;
  loading?: boolean;
  secondsLeft?: number | null;
}) {
  return (
    <div className="wa-qr-frame">
      <div className="wa-qr-frame__inner flex min-h-[318px] min-w-[318px] flex-col items-center justify-center gap-3">
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Código QR WhatsApp ${BRAND.name}`}
              className="block rounded-xl bg-white"
              width={306}
              height={306}
            />
            {typeof secondsLeft === "number" ? (
              <p
                className={
                  secondsLeft <= 15
                    ? "text-base font-semibold tabular-nums text-amber-300"
                    : "text-base font-semibold tabular-nums text-[#25d366]"
                }
              >
                {secondsLeft}s — QR fijo (no cambia solo)
              </p>
            ) : null}
          </>
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
  const [pinned, setPinned] = useState<PinnedQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const pinnedRef = useRef<PinnedQr | null>(null);

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const applyResponse = useCallback((json: QrResponse, forceNew: boolean) => {
    setData(json);

    if (json.connected && json.can_send !== false) {
      setPinned(null);
      setLoading(false);
      return;
    }

    const current = pinnedRef.current;
    // Solo el tiempo local decide el hold: no usar qr_stale del server (corta el QR a mitad).
    const holdExpired = !current || Date.now() - current.pinnedAt >= QR_HOLD_MS;

    if (json.image_base64 && (forceNew || holdExpired || !current)) {
      const next: PinnedQr = {
        image: json.image_base64,
        updatedAt: json.qr_updated_at || new Date().toISOString(),
        pinnedAt: Date.now(),
      };
      pinnedRef.current = next;
      setPinned(next);
      setLoading(false);
      return;
    }

    if (current && !holdExpired) {
      // Mantener el QR en pantalla aunque el servidor ya tenga otro.
      setLoading(false);
      return;
    }

    if (!json.image_base64) {
      setPinned(null);
      pinnedRef.current = null;
      setLoading(true);
      return;
    }

    setLoading(false);
  }, []);

  const refresh = useCallback(
    async (forceNew = false) => {
      if (forceNew) {
        setLoading(true);
        setPinned(null);
        pinnedRef.current = null;
      }
      setError(null);
      try {
        const res = await fetch("/api/vincular/qr", { cache: "no-store" });
        const json = (await res.json()) as QrResponse;
        applyResponse(json, forceNew);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el QR");
        setLoading(false);
      }
    },
    [applyResponse],
  );

  useEffect(() => {
    void refresh(true);
    const t = setInterval(() => void refresh(false), STATUS_POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pinned) {
      setSecondsLeft(null);
      return;
    }
    const left = Math.max(0, Math.ceil((QR_HOLD_MS - (Date.now() - pinned.pinnedAt)) / 1000));
    setSecondsLeft(left);
    if (left === 0) {
      void refresh(true);
    }
    // tick fuerza recálculo cada segundo
  }, [pinned, tick, refresh]);

  const phoneFmt = fmtPhone(data?.phone);
  const ready = Boolean(data?.connected && data?.can_send !== false);
  const stale = Boolean(data?.session_stale);
  const qrStale = Boolean(data?.qr_stale) && !pinned;
  const waitingQr = !ready;
  const qrImage = pinned?.image ?? null;

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
                  El QR expiró. Tocá Actualizar para pedir uno nuevo y escaneá sin apurarte.
                </p>
              )}
              {qrImage && (
                <p className="mb-4 max-w-sm rounded-lg bg-[#25d366]/10 px-3 py-2 text-center text-sm text-[#d1f4e0]">
                  En celulares lentos: este QR se queda fijo ~90s. No toques «Pedir QR nuevo»
                  mientras escaneás.
                </p>
              )}
              <QrFrame src={qrImage} loading={loading} secondsLeft={secondsLeft} />
              <p className="mt-6 text-center text-sm text-[#8696a0]">
                {data?.message || "Escaneá con WhatsApp → Dispositivos vinculados"}
              </p>
              {waitingQr && qrImage && (
                <p className="mt-2 animate-pulse text-xs text-[#25d366]">Esperando escaneo…</p>
              )}
            </>
          )}
        </div>

        {waitingQr && (
          <ol className="mt-8 space-y-3 text-sm text-[#8696a0]">
            {[
              `Abrí WhatsApp (actualizado) en el teléfono del bot de ${BRAND.name}`,
              "Menú → Dispositivos vinculados → Vincular dispositivo",
              "Si dice «No puede vincular», desvinculá dispositivos viejos, esperá 1 minuto y reintentá",
              "Apuntá la cámara y esperá: el QR de arriba no cambia solo durante el conteo",
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
          onClick={() => void refresh(true)}
          className="mt-8 inline-flex items-center justify-center gap-2 self-center rounded-xl border border-[#222d34] px-4 py-2 text-sm text-[#8696a0] hover:text-white"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Pedir QR nuevo
        </button>

        <p className="mt-6 text-center text-xs text-[#667781]">
          Página externa de vinculación · {BRAND.name} {BRAND.tagline} · {BRAND.productName}
        </p>
      </div>
    </div>
  );
}
