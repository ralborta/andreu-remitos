import { NextResponse } from "next/server";
import { isAdminAuthed } from "../../../../lib/auth-admin";
import { createRoom, deleteRoom, extendRoom, listRooms } from "../../../../lib/rooms";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.json({ rooms: listRooms() });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  if (action === "extend") {
    const room = extendRoom(String(body.token || ""), Number(body.days) || 3);
    if (!room) return NextResponse.json({ error: "Room no encontrada" }, { status: 404 });
    return NextResponse.json({ room });
  }

  if (action === "delete") {
    const ok = deleteRoom(String(body.token || ""));
    if (!ok) return NextResponse.json({ error: "Room no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const company = String(body.company || "").trim();
  const contactName = String(body.contactName || "").trim();
  if (!company || !contactName) {
    return NextResponse.json({ error: "Empresa y contacto son obligatorios" }, { status: 400 });
  }

  const room = createRoom({
    company,
    contactName,
    contactEmail: body.contactEmail ? String(body.contactEmail) : undefined,
    contactPhone: body.contactPhone ? String(body.contactPhone) : undefined,
    painPoint: body.painPoint ? String(body.painPoint) : undefined,
    days: body.days ? Number(body.days) : 3,
    createdBy: body.createdBy ? String(body.createdBy) : "vendedor",
  });

  return NextResponse.json({ room }, { status: 201 });
}
