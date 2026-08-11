"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-white">No se pudo cargar esta vista</h2>
      <p className="max-w-md text-sm text-[var(--text-dim)]">
        {error.message || "Error inesperado. Probá recargar."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-[var(--violet)] px-4 py-2 text-sm font-medium text-white"
      >
        Reintentar
      </button>
    </div>
  );
}
