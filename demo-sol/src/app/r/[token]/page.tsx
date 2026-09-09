import Link from "next/link";
import { getRoom, isExpired } from "../../../lib/rooms";
import { DemoRoomApp } from "../../../components/DemoRoomApp";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const room = getRoom(token);

  if (!room) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Demo no encontrada</h1>
          <p className="mt-2 text-[var(--text-dim)]">
            El link no existe o fue eliminado. Pedile uno nuevo a tu contacto SOL.
          </p>
        </div>
      </div>
    );
  }

  if (isExpired(room)) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-8">
          <div className="text-xs uppercase tracking-wider text-[var(--warn)]">Demo expirada</div>
          <h1 className="mt-2 text-2xl font-semibold">{room.company}</h1>
          <p className="mt-3 text-sm text-[var(--text-dim)]">
            Esta sala demo venció el{" "}
            {new Date(room.expiresAt).toLocaleString("es-AR")}. Pedile a tu
            ejecutivo SOL que la extienda o genere una nueva.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block text-sm text-[var(--accent-2)]"
          >
            Acceso vendedor →
          </Link>
        </div>
      </div>
    );
  }

  return <DemoRoomApp room={room} />;
}
