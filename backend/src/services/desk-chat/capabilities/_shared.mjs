/** Helpers de fecha/zona para desk-chat capabilities (determinísticos). */
export const TZ = "America/Argentina/Buenos_Aires";

export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dayKey(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function workingIds(ctx) {
  const ws = ctx?.workingSet;
  if (!ws) return [];
  if (Array.isArray(ws.entityIds) && ws.entityIds.length) return ws.entityIds.map(String);
  if (Array.isArray(ws.podIds) && ws.podIds.length) return ws.podIds.map(String);
  return [];
}
