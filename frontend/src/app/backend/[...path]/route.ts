import { NextRequest, NextResponse } from "next/server";

const API =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

const HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "host",
  "content-length",
]);

async function proxy(req: NextRequest, path: string[]) {
  const target = `${API.replace(/\/$/, "")}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  // Undici a veces no reenvía Cookie; forzar desde el request de Next.
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(target, init);
    const outHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!HOP_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value);
    });
    // Asegurar que el browser pueda leer el nombre del archivo en fetch+blob
    const cd = res.headers.get("content-disposition");
    if (cd) outHeaders.set("content-disposition", cd);
    outHeaders.set("access-control-expose-headers", "Content-Disposition");
    return new NextResponse(res.body, { status: res.status, headers: outHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "proxy error";
    return NextResponse.json(
      { error: `No se pudo conectar con la API (${API}): ${msg}` },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
