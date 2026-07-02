import type { SessionUser } from "./auth-types";

const SESSION_COOKIE = "andreu_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function apiInternal() {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export { SESSION_COOKIE, SESSION_MAX_AGE };

export async function loginWithBackend(username: string, password: string) {
  const res = await fetch(`${apiInternal()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as { ok: boolean; token: string; user: SessionUser };
}

export async function fetchSessionUser(token: string) {
  const res = await fetch(`${apiInternal()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: SessionUser };
  return data.user;
}
