import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, fetchSessionUser } from "@/lib/auth-server";

function demoSolBase() {
  return (
    process.env.DEMO_SOL_URL ||
    process.env.DEMO_PUBLIC_BASE_URL ||
    "https://sol.nivel41.com/demo"
  ).replace(/\/$/, "");
}

function demoSolPassword() {
  return process.env.DEMO_SOL_ADMIN_PASSWORD || "sol-demo-2026";
}

function publicBase() {
  return (
    process.env.DEMO_PUBLIC_BASE_URL ||
    process.env.DEMO_SOL_URL ||
    "https://sol.nivel41.com/demo"
  ).replace(/\/$/, "");
}

async function requireSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return fetchSessionUser(token);
}

/** Cookie jar for demo-sol admin session (server-side). */
async function demoSolAuthedFetch(path: string, init?: RequestInit) {
  const base = demoSolBase();
  const loginRes = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: demoSolPassword() }),
    cache: "no-store",
  });
  if (!loginRes.ok) {
    throw new Error("No se pudo autenticar contra demo-sol");
  }
  const getSetCookie = (
    loginRes.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const setCookie = typeof getSetCookie === "function" ? getSetCookie.call(loginRes.headers) : [];
  const cookieHeader =
    setCookie.map((c) => c.split(";")[0]).join("; ") ||
    loginRes.headers.get("set-cookie")?.split(";")[0] ||
    "";

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  return res;
}

export async function GET() {
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const res = await demoSolAuthedFetch("/api/admin/rooms");
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    const rooms = (data.rooms || []).map(
      (r: { token: string; company: string; contactName: string; expiresAt: string; public?: boolean }) => ({
        ...r,
        link: `${publicBase()}/${r.token}`,
      }),
    );
    return NextResponse.json({
      rooms,
      publicBase: publicBase(),
      publicLink: `${publicBase()}/public`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error demo-sol" },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const user = await requireSession();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const payload =
      body.action === "extend" || body.action === "delete"
        ? body
        : { ...body, createdBy: user.username || "sol-ui" };

    const res = await demoSolAuthedFetch("/api/admin/rooms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    if (data.room?.token) {
      data.link = `${publicBase()}/${data.room.token}`;
      data.room.link = data.link;
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error demo-sol" },
      { status: 502 },
    );
  }
}
