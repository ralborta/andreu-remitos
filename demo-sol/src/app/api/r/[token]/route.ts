import { NextResponse } from "next/server";
import { getRoom, isExpired } from "@/lib/rooms";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const room = getRoom(token);
  if (!room) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({
    room,
    expired: isExpired(room),
  });
}
