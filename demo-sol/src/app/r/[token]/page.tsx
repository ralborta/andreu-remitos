import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Compat: /demo/r/:token → /demo/:token */
export default async function LegacyRoomRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/${token}`);
}
