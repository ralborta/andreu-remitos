import { redirect } from "next/navigation";
import { ensurePublicDemoRoom, PUBLIC_DEMO_TOKEN } from "../../lib/rooms";

export const dynamic = "force-dynamic";

/** Atajo público permanente: /demo → /r/sol-public */
export default function PublicDemoRedirect() {
  ensurePublicDemoRoom();
  redirect(`/r/${PUBLIC_DEMO_TOKEN}`);
}
