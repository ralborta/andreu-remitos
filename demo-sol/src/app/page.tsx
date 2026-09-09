import Link from "next/link";
import { ensurePublicDemoRoom, PUBLIC_DEMO_TOKEN, publicBaseUrl } from "../lib/rooms";

export const dynamic = "force-dynamic";

export default function Home() {
  ensurePublicDemoRoom();
  const base = publicBaseUrl();
  const publicLink = `${base || ""}/r/${PUBLIC_DEMO_TOKEN}`;
  const demoPath = `/r/${PUBLIC_DEMO_TOKEN}`;

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-8 text-center shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--violet)]">
          SOL · Empliados
        </div>
        <h1 className="mt-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Demo pública de la mesa
        </h1>
        <p className="mt-3 text-sm text-[var(--text-dim)]">
          Sin login. Entrá a la mesa interactiva con descripción y flujo de cada agente.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={demoPath}
            className="btn-primary inline-block px-5 py-3 text-center text-sm"
          >
            Abrir demo pública →
          </Link>
          <p className="break-all rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left text-xs text-[var(--text-dim)]">
            Link para compartir:
            <br />
            <span className="font-medium text-[var(--text)]">
              {base ? publicLink : `…/r/${PUBLIC_DEMO_TOKEN}`}
            </span>
          </p>
          <Link href="/admin" className="text-xs text-[var(--text-faint)] hover:text-[var(--violet)]">
            Acceso vendedor (admin)
          </Link>
        </div>
      </div>
    </div>
  );
}
