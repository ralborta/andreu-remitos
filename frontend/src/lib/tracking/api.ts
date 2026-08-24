import type { LinkStatus, PositionInput, PublicTripPayload } from "./types";

function apiBase() {
  if (typeof window !== "undefined") return "/backend";
  return process.env.API_INTERNAL_URL?.replace(/\/$/, "") || "http://localhost:3001";
}

async function trackingFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null && init.body !== "";
  const res = await fetch(`${apiBase()}/api/tracking/public/${token}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(hasBody && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message || (data as { error?: string }).error || res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export async function fetchPublicTrip(token: string) {
  return trackingFetch<{ linkStatus: LinkStatus; trip: PublicTripPayload | null }>(token, "");
}

export async function postConsent(token: string, consentVersion: string) {
  return trackingFetch<{ ok: boolean; sessionId: string }>(token, "/consent", {
    method: "POST",
    body: JSON.stringify({ consentVersion }),
  });
}

export async function postStart(
  token: string,
  body: { confirmDriver: boolean; confirmVehicle: boolean },
) {
  return trackingFetch<{ ok: boolean; sessionId: string; status: string; duplicate?: boolean }>(
    token,
    "/start",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postHeartbeat(token: string, pageVisibility: "visible" | "hidden") {
  return trackingFetch<{ ok: boolean; status: string; serverTime: string }>(token, "/heartbeat", {
    method: "POST",
    body: JSON.stringify({ pageVisibility }),
  });
}

export async function postPositionsBatch(token: string, positions: PositionInput[]) {
  return trackingFetch<{
    ok: boolean;
    accepted: number;
    duplicates: number;
    status: string;
    lastSequence: number;
  }>(token, "/positions/batch", {
    method: "POST",
    body: JSON.stringify({ positions }),
  });
}

export async function postStop(token: string, reason?: string) {
  return trackingFetch<{ ok: boolean; status: string }>(token, "/stop", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function postArrive(token: string) {
  return trackingFetch<{ ok: boolean; status: string }>(token, "/arrive", {
    method: "POST",
  });
}

export async function postIncident(
  token: string,
  body: {
    type: string;
    text?: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
  },
) {
  return trackingFetch<{ ok: boolean; incidenciaId: string; codigo: string | null }>(
    token,
    "/incidents",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postPod(
  token: string,
  body: {
    deliveryOutcome: string;
    receiverName: string;
    receiverDocument?: string;
    observations?: string;
    imageUrl?: string;
  },
) {
  return trackingFetch<{ ok: boolean; status: string; podId: string | null }>(token, "/pod", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadPhoto(token: string, file: Blob, filename = "photo.jpg") {
  const fd = new FormData();
  fd.append("file", file, filename);
  return trackingFetch<{ ok: boolean; url: string; filename: string }>(token, "/upload", {
    method: "POST",
    body: fd,
  });
}

export function mediaUrl(path: string) {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/backend")) return path;
  if (path.startsWith("/api/")) return `/backend${path}`;
  return path;
}
