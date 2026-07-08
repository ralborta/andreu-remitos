import { NextResponse } from "next/server";

const API =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

/** Proxy público del QR Baileys para vincular.nivel41.com */
export async function GET() {
  try {
    const res = await fetch(`${API.replace(/\/$/, "")}/api/vincular/whatsapp/qr`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "proxy error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
