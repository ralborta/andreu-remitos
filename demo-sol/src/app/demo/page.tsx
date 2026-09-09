import { redirect } from "next/navigation";
import { ensurePublicDemoRoom, PUBLIC_DEMO_TOKEN } from "../../lib/rooms";

export const dynamic = "force-dynamic";

/** /demo/demo → /demo/public */
export default function PublicDemoRedirect() {
  ensurePublicDemoRoom();
  redirect(`/${PUBLIC_DEMO_TOKEN}`);
}
