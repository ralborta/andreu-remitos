import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-server";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/backend", "/conexion-prueba"];

/** Hosts que solo sirven la pantalla de conexión de prueba (URL neutra para compartir). */
const CONEXION_PRUEBA_HOSTS = new Set([
  "logistica-vincular.wd75db.easypanel.host",
  "vincular.nivel41.com",
]);

function hostName(request: NextRequest) {
  return request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = hostName(request);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  if (CONEXION_PRUEBA_HOSTS.has(host)) {
    if (pathname === "/" || pathname === "") {
      return NextResponse.rewrite(new URL("/conexion-prueba", request.url));
    }
    if (pathname === "/conexion-prueba" || pathname.startsWith("/conexion-prueba/")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (pathname.startsWith("/login") && request.cookies.get(SESSION_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
