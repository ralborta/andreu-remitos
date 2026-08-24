import type { TrackingStep } from "./types";

const PREFIX = "sol-tracking-step:";

export function loadPersistedStep(token: string): TrackingStep | null {
  try {
    const v = sessionStorage.getItem(`${PREFIX}${token}`);
    return v as TrackingStep | null;
  } catch {
    return null;
  }
}

export function persistStep(token: string, step: TrackingStep) {
  try {
    sessionStorage.setItem(`${PREFIX}${token}`, step);
  } catch {
    /* ignore */
  }
}

export function clearPersistedStep(token: string) {
  try {
    sessionStorage.removeItem(`${PREFIX}${token}`);
  } catch {
    /* ignore */
  }
}
