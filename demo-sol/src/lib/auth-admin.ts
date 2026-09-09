import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "sol_demo_admin";

function secret() {
  return process.env.DEMO_ADMIN_PASSWORD || "sol-demo-admin";
}

export function adminToken(): string {
  return crypto.createHmac("sha256", secret()).update("ok").digest("hex");
}

export function checkPassword(password: string): boolean {
  return password === secret();
}

export async function isAdminAuthed(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === adminToken();
}

export { COOKIE as ADMIN_COOKIE };
