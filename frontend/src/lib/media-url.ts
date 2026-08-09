/** Reescribe URLs de media del bot/API para el navegador (same-origin /backend). */
export function browsableMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  if (u.startsWith("/backend/")) return u;
  if (u.startsWith("/api/media/")) return `/backend${u}`;

  const botFile = u.match(/\/v1\/files\/([a-fA-F0-9]+)/i);
  if (botFile) return `/backend/api/media/bot/${botFile[1]}`;

  if (u.startsWith("http://") || u.startsWith("https://")) {
    try {
      const parsed = new URL(u);
      if (/bot/i.test(parsed.hostname) || parsed.pathname.includes("/v1/files/")) {
        const id = parsed.pathname.match(/\/v1\/files\/([a-fA-F0-9]+)/i)?.[1];
        if (id) return `/backend/api/media/bot/${id}`;
      }
    } catch {
      /* ignore */
    }
  }

  return u;
}
