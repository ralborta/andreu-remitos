import { isAdminAuthed } from "@/lib/auth-admin";
import { listRooms } from "@/lib/rooms";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthed();
  const rooms = authed ? listRooms() : [];
  const publicBase =
    process.env.DEMO_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_DEMO_BASE_URL?.replace(/\/$/, "") ||
    "";

  return (
    <AdminClient
      initiallyAuthed={authed}
      initialRooms={rooms}
      publicBase={publicBase || ""}
    />
  );
}
