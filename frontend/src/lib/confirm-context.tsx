"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default" | "warning";
  /** Un solo botón (reemplaza alert nativo). */
  alert?: boolean;
};

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  }
  return ctx;
}

const VARIANT_ICON: Record<NonNullable<ConfirmOptions["variant"]>, string> = {
  danger: "var(--red)",
  warning: "var(--amber)",
  default: "var(--violet)",
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [pending, close]);

  const variant = pending?.variant ?? (pending?.alert ? "warning" : "default");
  const iconColor = VARIANT_ICON[variant];
  const isDanger = variant === "danger";
  const isAlert = !!pending?.alert;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-[#05030a]/75 backdrop-blur-[3px]"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="panel relative z-10 w-full max-w-md animate-in p-5 shadow-2xl ring-1 ring-[var(--violet)]/25"
          >
            <div className="flex gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1"
                style={{
                  color: iconColor,
                  background: `${iconColor}18`,
                  boxShadow: `inset 0 0 0 1px ${iconColor}40`,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-title"
                  className="font-[var(--font-display)] text-lg font-semibold text-white"
                >
                  {pending.title ?? (isDanger ? "Confirmar acción" : "Aviso")}
                </h2>
                <p id="confirm-desc" className="mt-2 text-sm leading-relaxed text-[var(--text-dim)]">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {!isAlert && (
                <button
                  type="button"
                  className="btn-ghost px-4 py-2 text-sm font-medium"
                  onClick={() => close(false)}
                >
                  {pending.cancelLabel ?? "Cancelar"}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                className={clsx(
                  "px-4 py-2 text-sm font-semibold text-white transition",
                  isDanger
                    ? "rounded-[10px] bg-[var(--red)] hover:brightness-110 active:translate-y-px"
                    : "btn-primary",
                )}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? (isAlert ? "Entendido" : isDanger ? "Eliminar" : "Aceptar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
