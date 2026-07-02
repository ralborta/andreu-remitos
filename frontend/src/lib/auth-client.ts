import type { SessionUser } from "./auth-types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const res = await fetch("/backend/api/auth/me", { credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("No se pudo cargar la sesión");
  const data = (await res.json()) as { user: SessionUser };
  return data.user;
}

export async function logoutSession() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
