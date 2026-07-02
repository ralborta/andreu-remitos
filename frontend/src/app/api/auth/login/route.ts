import { NextRequest, NextResponse } from "next/server";
import {
  loginWithBackend,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  try {
    const data = await loginWithBackend(username, password);
    const res = NextResponse.json({ ok: true, user: data.user });
    res.cookies.set(SESSION_COOKIE, data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
